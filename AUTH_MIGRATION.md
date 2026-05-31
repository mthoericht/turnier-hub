# Auth-Migration zu AWS Cognito

> Status: **Analyse / Plan** — noch kein Code geändert.
> Bezug: ergänzt bzw. ändert die in [`MIGRATION_AWS.md`](MIGRATION_AWS.md) getroffene Entscheidung,
> dass JWT-Auth im Eigenbau in der Lambda bleibt. Dieses Dokument beschreibt die Ablösung der
> **gesamten Authentifizierung (Signup, Login, Session, Rollen)** durch **AWS Cognito** inkl.
> **Cognito-Lambda-Trigger**.

## Kurz

Das selbstgebaute Auth-System (`bcrypt`, HS256-JWT-Signing, Login-Lockout, Auth-Rate-Limit,
`tokenVersion`-Revocation) wird durch einen **Cognito User Pool** ersetzt. Cognito übernimmt
Passwort-Hashing, Passwort-Policy, E-Mail-Verifizierung, Account-Recovery, Lockout und
Token-Ausstellung. Die App-spezifische Logik (Invite-Code, Schul-Zuordnung, RDS-User-Anlage,
Bestandsnutzer-Migration) wandert in **Cognito-Lambda-Trigger**.

Damit fällt genau die Security-Logik weg, die in `MIGRATION_AWS.md` ohnehin als „zu reduzieren"
markiert ist.

---

## Entscheidungen

| Thema | Entscheidung |
| ----- | ------------ |
| Identity Provider | **AWS Cognito User Pool** ersetzt eigenen Signup/Login/Password-Store |
| App-Datenhoheit | **RDS/Prisma bleibt System of Record** für Domänendaten; interne `User`-Tabelle bleibt bestehen |
| User-Verknüpfung | Neue Spalte **`User.cognitoSub` (unique)**; bestehende Fremdschlüssel (`Player.userId`, `SchoolClass.userId`, `Tournament.userId`, `AdminAuditLog.actorUserId`) bleiben unverändert |
| Frontend-Flow | **Variante B — eigene Vue-Formulare + Cognito-SDK** (deutsche UI bleibt erhalten); Hosted UI nur als Fallback |
| Client-Lib | **`aws-amplify` (Auth)** für Login, Token-Refresh, Logout |
| Token-Verifikation (Backend) | **`aws-jwt-verify`** gegen Cognito-JWKS (RS256) in `auth.ts` + `sseEndpoint.ts` |
| Rollen-Quelle | **Postgres bleibt führend** (`User.role`) — minimal-invasiv, Admin-UI unverändert, kein Cognito-Group-Call nötig |
| Bestandsnutzer | **Re-Onboarding** — kein Import; Nutzer registrieren sich neu über Cognito (Bestand als unkritisch eingestuft). **UserMigration-Trigger entfällt.** |
| IaC | Neuer **`CognitoStack`** (AWS CDK, TypeScript), analog vorhandener Stacks unter `infra/` |
| Region | **eu-central-1 (Frankfurt)** — konsistent mit `MIGRATION_AWS.md` |

---

## Ist-Stand (was ersetzt wird)

| Baustein | Datei(en) | Cognito-Pendant |
| --- | --- | --- |
| Signup (Invite-Code, eindeutige E-Mail/Username, School-Pflicht) | `server/src/routes/auth.ts` (`signupHandler`) | User Pool + **PreSignUp**- & **PostConfirmation**-Trigger |
| Login (bcrypt-Vergleich) | `server/src/routes/auth.ts` (`loginHandler`) | Cognito `InitiateAuth` (SRP / `USER_PASSWORD_AUTH`) |
| Passwort-Hashing | `bcrypt.hash` / `bcrypt.compare` | Cognito-intern (**entfällt**) |
| JWT signieren (HS256, `{ sub, tv }`, 7 d) | `server/src/auth/token.ts` | Cognito ID-/Access-/Refresh-Token (RS256) |
| Token prüfen + `tokenVersion`-Abgleich | `server/src/middleware/auth.ts` | `aws-jwt-verify` gegen Cognito-JWKS |
| SSE-Auth über `?token=` | `server/src/realtime/sseEndpoint.ts` (`authenticateSseToken`) | gleiches Muster, Cognito-Access-Token verifizieren |
| Login-Lockout (Memory/Dynamo) | `server/src/routes/auth.ts` + `server/src/state/lockoutStore.ts` | **entfällt** (Cognito Lockout / Advanced Security) |
| Auth-Rate-Limit | `server/src/middleware/authRateLimit.ts` | **entfällt** für Auth (WAF + Cognito übernehmen) |
| Session-Revoke | `revoke-sessions` + `tokenVersion` | Cognito `GlobalSignOut` / Token-Revocation |
| Rolle ADMIN/USER + Admin-Verwaltung | `server/prisma/schema.prisma` (`User.role`), `server/src/routes/admin.ts` | Postgres behalten **oder** Cognito-Groups |
| School-Zuordnung bei Signup | `server/src/routes/auth.ts`, `User.schoolId` | Custom Attribute `custom:schoolId` + Trigger |
| Client-Auth-Store / API | `client/src/stores/auth.ts`, `client/src/api/authApi.ts`, `client/src/views/LoginView.vue`, `client/src/views/SignupView.vue` | `aws-amplify` Auth + angepasster Store |

**Kritischer Punkt:** `User.id` (cuid) ist Fremdschlüssel in mehreren Tabellen. Cognito hat eine
eigene `sub` (UUID). Deshalb wird die interne `User`-Zeile beibehalten und über `cognitoSub`
gemappt, statt alle Fremdschlüssel umzuschreiben.

---

## Zielarchitektur

```
        Browser (SPA)
            │  aws-amplify Auth (SRP)
            ▼
     ┌─────────────────┐     Tokens (ID/Access/Refresh, RS256)
     │  Cognito User   │◄───────────────────────────────┐
     │     Pool        │                                 │
     │  ┌───────────┐  │   Lambda-Trigger:               │
     │  │ Groups:   │  │   - PreSignUp (Invite + School) │
     │  │ admin/user│  │   - PostConfirmation (RDS-User) │
     │  └───────────┘  │   - UserMigration (Bestand)     │
     └────────┬────────┘   - PreTokenGeneration (Claims) │
              │                                           │
              ▼ schreibt/liest                            │
     ┌─────────────────┐                                  │
     │  RDS Postgres   │   User.cognitoSub ⇄ Cognito.sub  │
     │  (Prisma)       │                                  │
     └─────────────────┘                                  │
                                                          │
        api-Lambda  ── verifiziert Access-Token via ──────┘
        sse-Lambda     aws-jwt-verify (JWKS, gecacht)
```

### Cognito-Lambda-Trigger (Kern der Migration)

| Trigger | Ersetzt heute | Aufgabe |
| --- | --- | --- |
| **PreSignUp** | Invite-Code-Check, Schul-Validierung, Duplikat-Check | Lehnt Registrierung ohne gültigen `INVITE_CODE` (übergeben als ClientMetadata) und ohne gültige `custom:schoolId` ab |
| **PostConfirmation** | `prisma.user.create(...)` | Legt RDS-`User`-Zeile mit `cognitoSub`, E-Mail, Username, `schoolId` an (inkl. `ensureDefaultSchool`) |

> **Entfällt:** Ein **UserMigration**-Trigger ist durch die Re-Onboarding-Entscheidung nicht
> nötig. Eine **PreTokenGeneration**-Anpassung ist nicht erforderlich, da die Rolle weiterhin
> aus Postgres gelesen wird (kein Rollen-Claim im Token).

---

## Frontend-Varianten

| | Variante A: Hosted UI / OAuth-Redirect | Variante B: Eigene Formulare + SDK *(gewählt)* |
| --- | --- | --- |
| UI | Redirect zu Cognito-Seite | Bestehende `LoginView.vue` / `SignupView.vue` bleiben |
| Client-Lib | `aws-amplify` (OIDC) | `aws-amplify` Auth |
| Deutsche UI / Styling | nur begrenzt anpassbar | voll erhalten |
| Aufwand Frontend | mittel (Redirect-Flow, Callback-Route) | gering–mittel (Form ruft SDK statt `authApi.ts`) |
| Token-Refresh | Amplify automatisch | Amplify automatisch |

Der Wechsel von 7-Tage-localStorage-JWT zu kurzlebigem Access-Token + Refresh ist der einzige
echt **neue** Frontend-Baustein; Amplify übernimmt den Refresh weitgehend automatisch.

---

## Was wegfällt / bleibt / neu kommt

**Entfernen (Security-Reduktion):**
- `bcrypt`, `server/src/auth/token.ts` (`signToken`), HS256-`JWT_SECRET` für App-Token
- `server/src/state/lockoutStore.ts` + Login-Lockout-Logik in `auth.ts`, DynamoDB-Tabelle `login_lockout`
- Auth-Teil von `server/src/middleware/authRateLimit.ts` (nicht-auth-bezogene Limits können bleiben)
- `tokenVersion` + `revoke-sessions` (Cognito übernimmt Revocation)

**Bleibt:**
- `requireAdmin`, Zod-Validierung, CORS, Helmet, Body-Limits
- RDS/Prisma, alle Domänen-Tabellen, School-Konzept
- SSE-Endpoint (nur Token-Verifikation austauschen)

**Neu:**
- `CognitoStack` (CDK): User Pool, App-Client, Groups, Trigger-Lambdas, optional Domain
- `aws-jwt-verify` in `auth.ts` + `sseEndpoint.ts`
- `User.cognitoSub`-Spalte + Prisma-Migration
- `aws-amplify` im Client
- Admin-Rollenwechsel ruft ggf. Cognito-Group-APIs (`AdminAddUserToGroup` / `AdminRemoveUserFromGroup`)

---

## Status-Legende

- ✅ erledigt / entschieden
- 🔄 in Arbeit
- ⬜ offen
- ⚠️ blockiert / Entscheidung nötig
- ➖ entfällt durch getroffene Entscheidung

## Migrationsschritte

### Phase A — Schema & Vorbereitung

| | Schritt |
| - | ------- |
| ✅ | `server/prisma/schema.prisma`: `User.cognitoSub String? @unique` ergänzt; via `npm run db:push` + `db:push:test` auf Dev- und Test-DB angewendet, Prisma-Client regeneriert, `tsc -p server` grün. |
| ✅ | Entscheidung Rollen-Quelle: **Postgres bleibt führend** (`User.role`), kein Cognito-Group-Mapping. |
| ✅ | Entscheidung Bestandsnutzer: **Re-Onboarding** (kein Import, keine UserMigration). |

### Phase B — CognitoStack (CDK)

| | Schritt |
| - | ------- |
| ⬜ | Neuer `infra/lib/cognito-stack.ts`: User Pool (Passwort-Policy, E-Mail-Verifizierung, Self-Signup an/aus), App-Client (Public, ohne Secret), Domain optional. |
| ⬜ | Cognito-Groups `admin` / `user` anlegen; Custom Attribute `custom:schoolId`. |
| ⬜ | Trigger-Lambdas als separate Functions registrieren; im VPC mit RDS-Zugriff + Secrets-Manager-Rechten. |
| ⬜ | Outputs: `UserPoolId`, `UserPoolClientId`, Region — für Client- und API-Konfiguration. |

### Phase C — Lambda-Trigger implementieren

| | Schritt |
| - | ------- |
| ⬜ | **PreSignUp:** `INVITE_CODE` (ClientMetadata) + `custom:schoolId` validieren, sonst Ablehnung. |
| ⬜ | **PostConfirmation:** RDS-`User` anlegen (`cognitoSub`, E-Mail, Username, `schoolId`), `ensureDefaultSchool` berücksichtigen. Neue Nutzer erhalten Default-Rolle `USER`. |
| ➖ | **UserMigration / PreTokenGeneration:** entfallen (Re-Onboarding + Rolle aus Postgres). |

### Phase D — Backend-Auth umbauen

| | Schritt |
| - | ------- |
| ⬜ | `server/src/middleware/auth.ts`: Cognito-Token via `aws-jwt-verify` (JWKS gecacht) prüfen; `req.userId` + `req.userRole` aus `cognitoSub`-Lookup in Postgres (Rolle bleibt DB-geführt). |
| ⬜ | `server/src/realtime/sseEndpoint.ts` (`authenticateSseToken`): gleiche Cognito-Verifikation. |
| ⬜ | `server/src/routes/auth.ts`: `signup`/`login`/`revoke-sessions` entfernen; `me` beibehalten (liest RDS-User). |
| ⬜ | Entfernen: `auth/token.ts`, `state/lockoutStore.ts`, Auth-Rate-Limit, `tokenVersion`-Feld + zugehörige Logik. |
| ⬜ | `server/src/config.ts`: Cognito-Env (`COGNITO_USER_POOL_ID`, `COGNITO_CLIENT_ID`, Region) ergänzen; `JWT_SECRET`/Lockout-Werte entfernen. |

### Phase E — Frontend umbauen

| | Schritt |
| - | ------- |
| ⬜ | `aws-amplify` einbinden + Konfiguration (UserPoolId/ClientId/Region) via `VITE_*`. |
| ⬜ | `client/src/stores/auth.ts`: Login/Signup/Logout/Hydrate auf Amplify Auth umstellen; Token-Refresh nutzen. |
| ⬜ | `client/src/api/http.ts`: Access-Token aus Amplify holen (statt `localStorage`-JWT); SSE-URL mit Cognito-Access-Token. |
| ⬜ | `LoginView.vue` / `SignupView.vue`: Invite-Code als ClientMetadata, `schoolId` als `custom:schoolId` übergeben; E-Mail-Bestätigungs-Flow ergänzen. |
| ⬜ | `client/src/api/authApi.ts`: an Cognito anpassen oder entfernen (Schools-Liste bleibt evtl. eigener Endpoint). |

### Phase F — Admin & Rollen

| | Schritt |
| - | ------- |
| ✅ | Entschieden: Postgres-Rolle bleibt → **keine Cognito-Calls**, `routes/admin.ts` bleibt funktional unverändert (Rollenwechsel weiterhin über `User.role`). |
| ⬜ | Sicherstellen, dass der „Mindestens ein Admin"-Schutz weiter greift (DB-seitig, bereits vorhanden). |
| ⬜ | Erster Admin nach Cutover: per `db:seed` oder manuellem `User.role = ADMIN`-Update setzen (kein Self-Service-Admin). |

### Phase G — Bestandsnutzer (Re-Onboarding)

| | Schritt |
| - | ------- |
| ✅ | Entschieden: **kein Import**. Bestehende Nutzer registrieren sich nach dem Cutover neu über Cognito (PreSignUp + PostConfirmation legen `User` mit `cognitoSub` an). |
| ⬜ | Cutover kommunizieren (Nutzer müssen sich mit Invite-Code neu registrieren). |
| ⬜ | Alte `User.passwordHash`-Spalte nach erfolgreichem Cutover entfernen (Prisma-Migration). |
| ⬜ | Optional: verwaiste Alt-`User`-Zeilen (ohne `cognitoSub`) nach Übergangsfrist bereinigen oder Domänendaten neuen Accounts zuordnen. |

### Phase H — Tests anpassen

| | Schritt |
| - | ------- |
| ⬜ | Server-Auth-Tests: JWKS-Verifier stubben / Cognito-Token mocken; Lockout- & Auth-Rate-Limit-Tests entfernen. |
| ⬜ | `tests/server/unit/sseEndpoint.test.ts`: Cognito-Token-Mock. |
| ⬜ | Client-`auth`-Tests: Amplify-Auth mocken. |
| ⬜ | Neue Trigger-Lambdas: Unit-Tests (PreSignUp-Ablehnung, PostConfirmation-User-Anlage). |

### Phase I — Cleanup & Doku

| | Schritt |
| - | ------- |
| ⬜ | `MIGRATION_AWS.md` aktualisieren (Auth-Entscheidung „JWT bleibt" → „Cognito"). |
| ⬜ | `server/.env.example` + `client/.env.example` auf Cognito-Variablen umstellen. |
| ⬜ | `AGENTS.md` / `README.md` Auth-Abschnitte aktualisieren. |
| ⬜ | DynamoDB-Tabelle `login_lockout` aus `infra/lib/data-stack.ts` entfernen (falls nicht mehr genutzt). |

---

## Getroffene Entscheidungen

- **Rollen-Quelle:** ✅ Rolle bleibt in **Postgres** (`User.role`). Admin-UI unverändert, kein
  Cognito-Group-Mapping, kein zusätzliches IAM-Recht für die api-Lambda.
- **Bestandsnutzer:** ✅ **Re-Onboarding** — kein Cognito-Import, keine `UserMigration`. Nutzer
  registrieren sich nach dem Cutover neu (Bestand als unkritisch eingestuft).

## Offene Entscheidungen / Risiken

- **Token-Lebensdauer/Refresh:** Wechsel von 7-Tage-localStorage-JWT zu kurzlebigem Access-Token
  + Refresh → erfordert Frontend-Anpassung (Amplify automatisiert das).
- **Kosten:** Advanced Security Features (adaptive Auth / Compromised-Credentials) kosten extra;
  Basis-Cognito liegt im Free-Tier-Bereich.
- **`INVITE_CODE`:** als ClientMetadata an `signUp` übergeben und im PreSignUp-Trigger prüfen
  (nicht als sichtbares User-Attribut speichern).
- **VPC/Latenz:** Trigger-Lambdas mit RDS-Zugriff müssen in den VPC (Cold-Start beachten);
  `PostConfirmation`/`UserMigration` benötigen Postgres, `PreSignUp` ggf. nur für School-Check.
