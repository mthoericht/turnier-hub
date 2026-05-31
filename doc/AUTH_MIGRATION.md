# Auth-Migration zu AWS Cognito

> Status: **Implementiert (Phasen A–I, F–G Cutover-vorbereitet)** hinter einem pluggable Auth-Adapter — Dev/Tests laufen
> weiter über den `local`-Pfad; die AWS-Produktion nutzt Cognito. Offen bleiben nur der **Hard-Removal** des
> `local`-Pfads und das anschließende Droppen von `passwordHash` (⏸️ Phase G).
> Bezug: ergänzt die AWS-Zielarchitektur in [`infra/README.md`](../infra/README.md) (Cognito statt
> Eigenbau-JWT für Produktion). Dieses Dokument beschreibt die Ablösung der
> **gesamten Authentifizierung (Signup, Login, Session, Rollen)** durch **AWS Cognito** inkl.
> **Cognito-Lambda-Trigger**.
> Cloud-Verifikation: [`infra/README.md`](../infra/README.md) §2–§5 (Smoke-Skripte + Browser-Checks).

## Kurz

Das selbstgebaute Auth-System (`bcrypt`, HS256-JWT-Signing, Login-Lockout, Auth-Rate-Limit,
`tokenVersion`-Revocation) wird durch einen **Cognito User Pool** ersetzt. Cognito übernimmt
Passwort-Hashing, Passwort-Policy, E-Mail-Verifizierung, Account-Recovery, Lockout und
Token-Ausstellung. Die App-spezifische Logik (Invite-Code, Schul-Zuordnung, RDS-User-Anlage,
Bestandsnutzer-Migration) wandert in **Cognito-Lambda-Trigger**.

Damit fällt genau die Security-Logik weg, die für AWS ohnehin reduziert wird (Lockout,
Auth-Rate-Limit im Cognito-Pfad).

---

## Entscheidungen

| Thema | Entscheidung |
| ----- | ------------ |
| Identity Provider | **AWS Cognito User Pool** ersetzt eigenen Signup/Login/Password-Store |
| App-Datenhoheit | **RDS/Prisma bleibt System of Record** für Domänendaten; interne `User`-Tabelle bleibt bestehen |
| User-Verknüpfung | Neue Spalte **`User.cognitoSub` (unique)**; bestehende Fremdschlüssel (`Player.userId`, `SchoolClass.userId`, `Tournament.userId`, `AdminAuditLog.actorUserId`) bleiben unverändert |
| Frontend-Flow | **Variante B — eigene Vue-Formulare + Cognito-SDK** (deutsche UI bleibt erhalten); Hosted UI nur als Fallback |
| Client-Lib | **`aws-amplify` (Auth)** für Login, Token-Refresh, Logout |
| Token-Verifikation (Backend) | **Verifier-Adapter** (`AUTH_VERIFIER=local\|cognito`, analog Memory/Dynamo-Adaptern): `cognito` nutzt **`aws-jwt-verify`** gegen Cognito-JWKS (RS256), `local` behält den HS256-Pfad für Dev/Tests. AWS-Lambdas laufen im `cognito`-Modus. |
| Rollen-Quelle | **Postgres bleibt führend** (`User.role`) — minimal-invasiv, Admin-UI unverändert, kein Cognito-Group-Call nötig |
| Bestandsnutzer | **Re-Onboarding** — kein Import; Nutzer registrieren sich neu über Cognito (Bestand als unkritisch eingestuft). **UserMigration-Trigger entfällt.** |
| IaC | Neuer **`CognitoStack`** (AWS CDK, TypeScript), analog vorhandener Stacks unter `infra/` |
| Region | **eu-central-1 (Frankfurt)** — konsistent mit [`infra/README.md`](../infra/README.md) |

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
- ⏸️ bewusst zurückgestellt (bis zu einer späteren Phase)

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
| ✅ | Neuer `infra/lib/cognito-stack.ts`: User Pool (E-Mail-Sign-in case-insensitive, `autoVerify` E-Mail, Passwort-Policy min 8 + Groß/Klein/Ziffer, `accountRecovery` E-Mail, Self-Signup an, MFA off), App-Client (Public, `generateSecret: false`, `userSrp`, Token-Validity 1 h / Refresh 30 d). |
| ✅ | **Keine** Cognito-Groups (Rolle bleibt Postgres-geführt). Custom Attribute **`custom:schoolId`** + `preferredUsername` als Standard-Attribut angelegt. |
| ✅ | Trigger-Lambdas registriert: `PreSignUpFunction` (ohne VPC, nur Invite-Check) + `PostConfirmationFunction` (im VPC mit `appSecurityGroup`, DB-Zugriff). Secret-Read-Grants (Invite/DB) gesetzt. |
| ✅ | Outputs `UserPoolId` + `UserPoolClientId`; in `infra/bin/infra.ts` als `${namePrefix}-cognito` verdrahtet. `cdk synth` grün, beide Trigger bündeln sauber. |

### Phase C — Lambda-Trigger implementieren

| | Schritt |
| - | ------- |
| ✅ | **PreSignUp** (`server/src/lambda/cognito/preSignUp.ts`): validiert `inviteCode` aus `ClientMetadata` gegen `INVITE_CODE`, sonst Ablehnung. Schul-Validierung erfolgt in PostConfirmation (DB-frei gehalten). |
| ✅ | **PostConfirmation** (`server/src/lambda/cognito/postConfirmation.ts`): upsert der RDS-`User`-Zeile per E-Mail (`cognitoSub`, `preferred_username`→`username`, `custom:schoolId`→`schoolId`, Default-Schule als Fallback). Idempotent; Default-Rolle `USER`. |
| ✅ | `User.passwordHash` auf optional (`String?`) umgestellt (Cognito-User haben keinen lokalen Hash); Login-Handler mit Null-Guard ergänzt. Server-Unit-Tests grün (55). |
| ➖ | **UserMigration / PreTokenGeneration:** entfallen (Re-Onboarding + Rolle aus Postgres). |
| ✅ | **AWS-Laufzeit-Lücke geschlossen (Phase-5-Bootstrap, geteilt mit api/sse-Lambda):** neuer `server/src/runtime/secrets.ts` (`getSecretString` + idempotentes `bootstrapSecretsIntoEnv`) löst `DATABASE_URL` (RDS-Secret + `DB_PROXY_ENDPOINT`, TLS, `connection_limit=1`), `INVITE_CODE` und `JWT_SECRET` aus Secrets Manager in `process.env`. Alle vier Entry-Module (`httpHandler`, `sseHandler`, `preSignUp`, `postConfirmation`) rufen es per Top-Level-`await` **vor** dem dynamischen Import von `app.ts`/`db.ts` auf; lokal/Tests No-op (Env bereits gesetzt → kein AWS-Call). IAM-Read-Grants + Env-ARNs bereits in Phase B/D verdrahtet. Server-Unit-Tests grün (55). |

### Phase D — Backend-Auth umbauen

| | Schritt |
| - | ------- |
| ✅ | **Verifier-Adapter** `server/src/auth/tokenVerifier.ts`: Interface `TokenVerifier` + `LocalTokenVerifier` (HS256, `tokenVersion`-Check) + `CognitoTokenVerifier` (`aws-jwt-verify`, Access-Token, `cognitoSub`-Lookup in Postgres). Lazy-Resolver `getTokenVerifier()` über `AUTH_VERIFIER`, Test-Seam `setTokenVerifierForTests`. |
| ✅ | `server/src/middleware/auth.ts` + `server/src/realtime/sseEndpoint.ts` (`authenticateSseToken`) nutzen jetzt den Verifier; `req.userId`/`req.userRole` kommen aus dem Adapter. Direkte `jwt`/`JWT_SECRET`-Nutzung dort entfernt. |
| ✅ | `server/src/config.ts`: `AUTH_VERIFIER`, `COGNITO_USER_POOL_ID`, `COGNITO_CLIENT_ID` ergänzt; `JWT_SECRET`-Pflicht nur noch im `local`-Modus, Cognito-IDs Pflicht im `cognito`-Modus (Prod). `server/.env.example` dokumentiert den Schalter. |
| ✅ | `aws-jwt-verify` als Server-Dependency; `infra/lib/lambda-stack.ts` setzt `AUTH_VERIFIER=cognito` + `COGNITO_USER_POOL_ID`/`COGNITO_CLIENT_ID` (Cross-Stack aus `CognitoStack`). `cdk synth` grün. |
| ⏸️ | **Bewusst zurückgestellt (durch Adapter-Entscheidung):** `auth/token.ts`, `state/lockoutStore.ts`, Auth-Rate-Limit, `tokenVersion`, `signup`/`login`/`revoke-sessions` bleiben als **`local`-Pfad für Dev/Tests** bestehen. Hard-Removal erst nach vollständigem Cutover (Phase G/Cleanup), wenn Dev/Tests auf einen Cognito-/Mock-Pfad umgestellt sind. |
| ✅ | Verifikation: `tsc -p server` grün, 55 Server-Unit-Tests grün, 20 Client-Integration-Tests grün (Login/Signup/Me/Revoke/Rate-Limit/Lockout über `local`-Verifier). |

### Phase E — Frontend umbauen

| | Schritt |
| - | ------- |
| ✅ | **Client-Provider-Adapter** (analog Backend, `VITE_AUTH_PROVIDER=local\|cognito`): `client/src/auth/authProvider.ts` (Interface + lazy Resolver), `localAuthProvider.ts` (bestehende `/api/auth/*` + `localStorage`), `cognitoAuthProvider.ts` + `cognitoConfig.ts` (`aws-amplify`, dynamisch importiert). `aws-amplify` als Client-Dependency. |
| ✅ | `client/src/stores/auth.ts` delegiert an den Provider (`login`/`signup`/`confirmSignup`/`logout`/`hydrate→restore`); `signup` liefert `SignupResult` (auth vs. `needsConfirmation`). |
| ✅ | **`http.ts` + `realtimeClient.ts` bewusst unverändert:** der Cognito-Provider spiegelt den Access-Token via `fetchAuthSession` in dieselbe `localStorage`-Ablage; Token-Refresh übernimmt Amplify. Router-Guard (`getToken()` sync) bleibt funktionsfähig. |
| ✅ | `SignupView.vue`: Invite-Code als `clientMetadata.inviteCode`, `custom:schoolId` + `preferred_username` als User-Attribute; **E-Mail-Bestätigungsschritt** ergänzt (nur im Cognito-Modus aktiv, danach Auto-Login). `LoginView.vue` unverändert (E-Mail/Passwort). |
| ✅ | `authApi.ts` bleibt (Schools-Liste + `/me` + lokaler Pfad weiter genutzt). `client/.env.example`: `VITE_AUTH_PROVIDER` + `VITE_COGNITO_*` dokumentiert. |
| ✅ | Verifikation: `npm run lint -w client` grün, `npm run build -w client` grün (Amplify wird nur im Cognito-Modus als Async-Chunk geladen), 48 Client-Unit-Tests grün. `vue-tsc --build` zeigt nur **vorbestehende** Fehler (`AdminSchoolDialog.vue`, `vitest.config.ts` Tooling-Typskew), keine in den Auth-Dateien. |

### Phase F — Admin & Rollen

| | Schritt |
| - | ------- |
| ✅ | Entschieden: Postgres-Rolle bleibt → **keine Cognito-Calls**, `routes/admin.ts` bleibt funktional unverändert (Rollenwechsel weiterhin über `User.role`). |
| ✅ | „Mindestens ein Admin"-Schutz greift weiter: `PATCH /api/admin/users/:id/role` blockiert Demotion des letzten Admins (`409`, `Mindestens ein Admin muss erhalten bleiben`) — abgedeckt durch `tests/client/integration/admin.api.test.ts`. |
| ✅ | Erster Admin nach Cutover: `npm run db:promote-admin -- --email <user@example.com> --yes` — siehe [`infra/README.md`](../infra/README.md) §5. Kein Self-Service-Admin. |

### Phase G — Bestandsnutzer (Re-Onboarding)

| | Schritt |
| - | ------- |
| ✅ | Entschieden: **kein Import**. Bestehende Nutzer registrieren sich nach dem Cutover neu über Cognito (PreSignUp + PostConfirmation legen `User` mit `cognitoSub` an). |
| ✅ | **Cutover kommunizieren** (Checkliste für Betreiber): |
| | 1. **Vor Cutover:** Nutzer informieren, dass Login/Passwort nicht übernommen werden; Registrierung mit **Einladungscode** + E-Mail-Bestätigung nötig ist. |
| | 2. **Am Cutover-Tag:** SPA mit `VITE_AUTH_PROVIDER=cognito` deployen; Smoke-Test gemäß [`infra/README.md`](../infra/README.md) §2–§5. |
| | 3. **Ersten Admin setzen:** `db:promote-admin` (Phase F). |
| | 4. **Nach Cutover:** Domänendaten (Turniere/Spieler) bleiben im Katalog; `createdBy` zeigt ggf. noch alte interne User-IDs — nur Anzeige, kein Zugriffsproblem. |
| ⏸️ | **`User.passwordHash` entfernen** — erst nach vollständigem Cutover **und** Hard-Removal des `local`-Auth-Pfads (Dev/Tests dann Cognito-Mock oder Testcontainers). Bis dahin Spalte optional (`String?`) belassen. Ablauf wenn bereit: (1) `bcrypt`/`signup`/`login`/`token.ts`/`lockoutStore` entfernen, (2) `passwordHash` aus `schema.prisma` streichen, (3) `npm run db:push` (+ Test-DB), (4) Integrationstests auf Cognito-/Mock-Pfad umstellen. |
| ⏸️ | Optional: verwaiste Alt-`User`-Zeilen (ohne `cognitoSub`) nach Übergangsfrist per SQL prüfen/löschen — nur wenn keine FK-Referenzen mehr benötigt werden (`Player.userId` etc. zeigen dann auf verwaiste IDs). |

### Phase H — Tests anpassen

| | Schritt |
| - | ------- |
| ✅ | **CognitoTokenVerifier-Test** (`tests/server/unit/cognitoTokenVerifier.test.ts`): `aws-jwt-verify` + Prisma gemockt; verifizierter Access-Token → `cognitoSub`-Lookup → Identität, unbekannter `sub` → `null`, JWKS-Fehler → `null` (3 Tests). |
| ✅ | **Neue Trigger-Lambdas getestet:** `cognitoPreSignUp.test.ts` (Invite-Code akzeptiert/getrimmt/abgelehnt/fehlend/unkonfiguriert, 5 Tests) + `cognitoPostConfirmation.test.ts` (School-Link, Default-Fallback, unbekannte School, Nicht-Confirm-Trigger, fehlende Attribute; `db.js` gemockt, 5 Tests). |
| ✅ | **Secret-Bootstrap-Test** (`tests/server/unit/secretsBootstrap.test.ts`): `@aws-sdk/client-secrets-manager` gemockt; `DATABASE_URL`-Build (URL-encoding + Proxy-Endpoint), `{value}`-Parsing, Plain-String-Fallback, No-op bei gesetzter Env, Einmal-/Cache-Verhalten (4 Tests). |
| ✅ | **Client-`auth`-Test** (`tests/client/unit/cognitoAuthProvider.test.ts`): `aws-amplify/auth` + `authApi`/`http`/`cognitoConfig` gemockt; Login→Token-Spiegelung→`/me`, Signup→`clientMetadata.inviteCode`+Attribute, Confirm, Logout, Restore mit/ohne Session (7 Tests). |
| ➖ | `tests/server/unit/sseEndpoint.test.ts`: kein separater Cognito-Mock nötig — `authenticateSseToken` delegiert an den (getesteten) `TokenVerifier`; der bestehende Test deckt weiter den `local`-Pfad ab. |
| ⏸️ | **Lockout-/Auth-Rate-Limit-Tests bleiben** (testen den weiter aktiven `local`-Pfad). Entfernung erst beim Hard-Removal nach Cutover (konsistent mit der Adapter-Entscheidung in Phase D). |
| ✅ | Verifikation: **72 Server-Unit-Tests grün** (55 + 17 neue), **55 Client-Unit-Tests grün** (48 + 7 neue), `tsc -p server` grün, `npm run lint -w client` grün. |

### Phase I — Cleanup & Doku

| | Schritt |
| - | ------- |
| ✅ | `infra/README.md` + Root-Docs aktualisiert (AWS-Deploy, Smoke-Skripte, Cognito; `MIGRATION_AWS.md` entfernt). |
| ✅ | `server/.env.example` (`AUTH_VERIFIER` + `COGNITO_*`, `LOGIN_LOCKOUT_TABLE` entfernt) + `client/.env.example` (`VITE_AUTH_PROVIDER` + `VITE_COGNITO_*`) auf Cognito ausgerichtet. |
| ✅ | `AGENTS.md` / `README.md` Auth-Abschnitte aktualisiert (pluggable Auth-Adapter, Cognito-Trigger, Secret-Bootstrap, neue Pfade). |
| ✅ | DynamoDB-Tabelle `login_lockout` entfernt: `data-stack.ts` (Tabelle), `infra/bin/infra.ts` (Prop), `lambda-stack.ts` (Prop + `LOGIN_LOCKOUT_TABLE`-Env, `LOCKOUT_STORE` → `memory`); Brute-Force-Schutz übernimmt Cognito. Lockout-**Code** (`state/lockoutStore.ts`, `MemoryLockoutStore`) bleibt für den `local`-Pfad bis zum Hard-Removal. |

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
