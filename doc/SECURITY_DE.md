# Sicherheit

Zentrale Sicherheitsreferenz fuer `turnier-hub` (deutsche Version).

Diese Datei kombiniert:

- die priorisierte Sicherheits-Checkliste (ehemals `SECURITY_TODO.md`)
- das operative Runbook (ehemals `SECURITY_RUNBOOK.md`)

## Inhalt

- [Vertrauensgrenze und Deployment-Modell](#vertrauensgrenze-und-deployment-modell)
- [Sicherheits-Checkliste](#sicherheits-checkliste)
- [Sicherheits-Runbook](#sicherheits-runbook)
- [Automatisierte Abdeckung (Security-Tests)](#automatisierte-abdeckung-security-tests)
- [Produktions-Verifikationsprotokoll](#produktions-verifikationsprotokoll)
- [Abhaengigkeits-Risiko-Triage (Aktuell)](#abhaengigkeits-risiko-triage-aktuell)

---

## Vertrauensgrenze und Deployment-Modell

`turnier-hub` ist fuer **Single-Instance-Deployments innerhalb einer vertrauenswuerdigen Gruppe** ausgelegt (typischerweise eine Schule oder eine kleine Gruppe von Schulen).

### Kernannahmen

- **Keine Multi-Tenant-Isolation.** Alle authentifizierten Benutzer teilen den gesamten Katalog (Klassen, Spieler, Turniere). Es gibt keine schul- oder benutzerbezogene Datenisolation ueber die Ersteller-Zuordnung hinaus.
- **Einladungscode als Zugangstor.** Die Registrierung erfordert einen gemeinsamen Einladungscode. Falls der Code geleakt wird, kann sich jeder registrieren. Code stark waehlen, bei Aenderung der Gruppe rotieren und als Shared Secret behandeln.
- **Gemeinsames Editieren.** Jeder authentifizierte Benutzer darf Katalogeintraege und Turnierdaten erstellen, lesen, aendern und loeschen. Das `createdBy`-Feld ist rein informativ.
- **Admin-Rolle.** Admin-Only-Operationen (Schulverwaltung, Benutzerrolle/Schulzuweisung) sind durch die `ADMIN`-Rolle geschuetzt. Regulaere Benutzer koennen nicht auf `/api/admin`-Endpunkte zugreifen.

### Deployment-Hinweise

- Immer hinter **TLS** (HTTPS) deployen. Die App erzwingt HSTS nicht selbst; am Reverse-Proxy konfigurieren.
- Als **einzelner Node.js-Prozess** betreiben (oder bei verteiltem Setup auf Shared-State-Backends wechseln). In-Memory-Rate-Limiting, Lockout-Counter und Monitoring-State werden nicht zwischen Prozessen geteilt.
- Die App **nicht** direkt ohne Reverse-Proxy dem oeffentlichen Internet aussetzen.
- Alle authentifizierten Benutzer als vertrauenswuerdige Mitarbeitende innerhalb des Deployment-Umfelds behandeln.

### Auth-Backend und Realtime-Transport (zuerst lesen)

- **Pluggable Auth (`AUTH_VERIFIER`).** Der unten beschriebene JWT-Lebenszyklus,
  Login-Lockout, Auth-Rate-Limiting, `tokenVersion` und
  `POST /api/auth/revoke-sessions` gelten fuer den **`local`**-Verifier (Dev,
  Tests, Legacy-Single-VM). Im AWS-Deployment (`AUTH_VERIFIER=cognito`) werden
  Passwort-Hashing, Brute-Force-/Lockout-Schutz, Token-Ausstellung, Refresh und
  Revoke **von Cognito verwaltet**; der Einladungscode wird in der Cognito-
  Siehe [`AUTH_MIGRATION.md`](AUTH_MIGRATION.md).
- **Realtime ist SSE, nicht WebSocket.** Der alte `ws`-Hub (inkl. `WS_*`-Limits)
  wurde in der AWS-Migration (Phase 2) **entfernt**. Realtime laeuft jetzt ueber
  **Server-Sent Events** auf `GET /api/sse` — eine normale, langlebige
  HTTP-Antwort, authentifiziert ueber denselben Token-Verifier (`?token=<token>`).
  WebSocket-spezifische Hinweise aus aelteren Revisionen gelten nicht mehr; die
  SSE-Aequivalente stehen unten.

---

## Sicherheits-Checkliste

Praktische Checkliste zur Verbesserung der Sicherheitslage von `turnier-hub`.

### P0 - Hohe Prioritaet

- [x] Auth-Rate-Limiting fuer `POST /api/auth/login` und `POST /api/auth/signup` hinzugefuegt.
- [x] CORS auf explizite Allowlist eingeschraenkt (`CORS_ALLOWED_ORIGINS`).
- [x] Basis-Sicherheits-Header mit `helmet` aktiviert.
- [x] Konfigurierbares JSON-Request-Limit (`JSON_BODY_LIMIT`) hinzugefuegt.
- [x] Explizites Proxy-Trust (`TRUST_PROXY`) eingefuehrt, damit `req.ip` hinter Reverse-Proxy verlaesslich ist.
- [ ] Produktionswert fuer `TRUST_PROXY` mit echtem Deployment-Pfad verifizieren (in vielen Setups: `1` hinter Nginx).
- [x] SSE-Endpoint (`GET /api/sse`) authentifiziert das Token ueber den aktiven Verifier (identisch zu HTTP-Auth) und raeumt Listener beim Disconnect auf.
- [x] ~~WebSocket-Upgrade validiert `tokenVersion` / Origin / bricht sauber ab~~ — obsolet: der `ws`-Hub wurde entfernt (Realtime ist SSE).

### P1 - Mittlere Prioritaet

- [x] Progressive Backoff / temporaerer Login-Lockout bei wiederholten Fehlversuchen hinzugefuegt (`local`-Verifier; in AWS uebernimmt Cognito).
- [x] Alle mutierenden API-Routen auf strikte Request-Validierung geprueft (Laengen, Enums, erlaubte Zeichen).
- [x] JWT-Lebenszyklus geprueft (`local`-Verifier):
  - [x] Token-Ablaufpolitik gesetzt und dokumentiert.
  - [x] Secret-Rotation-Prozess definiert.
  - [x] Invalidation-Strategie fuer kritische Ereignisse (z. B. Passwort-Reset) definiert.
- [x] Strukturiertes Monitoring/Alerting fuer Spikes bei `401`, `403`, `429` hinzugefuegt (JSON-Security-Logs → CloudWatch Metric Filters in AWS).

### P2 - Laufende Haertung

- [x] Regelmaessige Dependency-Sicherheitsupdates aktiviert (Dependabot/Renovate).
- [x] CI-Sicherheitschecks hinzugefuegt (`npm audit`-Policy, Fail-Schwelle fuer kritische Findings).
- [x] Kurzen Operations-Runbook-Abschnitt fuer Incident Response hinzugefuegt (Auth-Abuse, IP-Blocks, Secret-Rotation).

### Schnelle Verifikations-Checkliste (Produktion)

- [ ] `CORS_ALLOWED_ORIGINS` enthaelt nur reale Frontend-Origin(s).
- [ ] `TRUST_PROXY` passt zur realen Proxy-Hop-Topologie.
- [ ] `JWT_SECRET` (local mode) und `INVITE_CODE` sind stark und kommen aus Secret-Management.
- [ ] Auth-Rate-Limits liefern `429` und enthalten `Retry-After` (local-Auth-Routen).
- [ ] Reverse-Proxy / CDN liefert `GET /api/sse` als langlebige Antwort (kein Buffering, kein vorzeitiger Timeout).

---

## Sicherheits-Runbook

Operatives Playbook fuer Produktions-Sicherheitspruefungen und Incident Response.

### Schnellreaktion (5 Minuten)

Verwenden bei laufendem Missbrauch oder auffaelligem Auth-Verhalten.

1. **Eindaemmen**
   - Local-Auth: `AUTH_LOGIN_MAX_REQUESTS`, `AUTH_IDENTIFIER_MAX_REQUESTS`, `LOGIN_LOCKOUT_*` verschaerfen.
   - Cognito (AWS): WAF-Rate-Regeln an CloudFront und ggf. Cognito-Advanced-Security verschaerfen.
   - Temporare Reverse-Proxy-/WAF-Blocks fuer auffaellige Quellen setzen.
2. **Verifizieren**
   - `401` -> `429` Verhalten auf `/api/auth/login` bestaetigen (local-Auth).
   - Security-Signal-Logs (`401`/`403`/`429`) bestaetigen und `TRUST_PROXY` auf korrekte Topologie pruefen.
3. **Wiederherstellen**
   - Local-Auth: bei Verdacht auf Account-Kompromittierung `POST /api/auth/revoke-sessions` ausfuehren; bei `JWT_SECRET`-Exposition rotieren und alle Instanzen neu starten.
   - Cognito (AWS): User global abmelden / Credentials im User-Pool zuruecksetzen; ggf. Cognito-App-Client-Einstellungen rotieren.
4. **Nachbereitung**
   - Strengere Limits beibehalten, bis Traffic stabil ist.
   - Vorfall und geaenderte Controls dokumentieren.
   - Schwellwerte gegen Wiederholung ueberpruefen.

### Zweck und Nutzung

- Diese Datei fuer Go-Live-Checks, regelmaessige Haertungsreviews und Sicherheitsvorfaelle verwenden.
- Checklisten-Abschnitt aktuell halten (Backlog + Source of Truth).
- Relevante Abschnitte nach Infrastruktur-Aenderungen erneut durchlaufen (Proxy/CDN/LB, Auth-Settings).

### Go-Live-Mindestcheckliste

- `JWT_SECRET` (local mode) und `INVITE_CODE` kommen aus Secret-Management (Secrets Manager in AWS).
- `CORS_ALLOWED_ORIGINS` enthaelt nur reale Frontend-Origin(s).
- `TRUST_PROXY` passt zur realen Proxy-Hop-Topologie.
- Auth-Schutz liefert bei wiederholten Fehlversuchen `429` + `Retry-After` (local-Auth) / Cognito + WAF-Limits in AWS aktiv.
- SSE-Pfad `GET /api/sse` funktioniert hinter Reverse-Proxy / CDN (langlebige, nicht gebufferte Antwort).
- Security-Telemetrie fuer HTTP (`401`/`403`/`429`) ist sichtbar.

### JWT- und Session-Modell

> Gilt fuer den **`local`**-Verifier. Mit `AUTH_VERIFIER=cognito` werden
> Token-Ausstellung/-Ablauf/-Refresh und Revoke von Cognito verwaltet, nicht
> ueber die folgenden Felder.

#### Aktuelle Policy

- Access-Token-Gueltigkeit ist `7d` (siehe `server/src/auth/token.ts`).
- JWT-Payload enthaelt `tv` (`tokenVersion`).
- `authMiddleware` validiert Token-`tv` gegen DB-Wert `User.tokenVersion`.

#### Session-Invalidierung (kritische Ereignisse)

- Endpoint: `POST /api/auth/revoke-sessions`.
- Verhalten: `tokenVersion` wird inkrementiert und ein frisches Token zurueckgegeben.
- Effekt: Alle zuvor ausgestellten Tokens dieses Users werden sofort ungueltig.

#### Empfohlene Nutzung

- Sessions nach Passwort-Reset oder bestaetigter Konto-Kompromittierung widerrufen.
- Fuer erzwungene Re-Authentifizierung auf allen Geraeten das neu zurueckgegebene Token auf dem ausloesenden Geraet nicht weiterverwenden.

#### SSE-Token-Transport

- SSE-Verbindungen authentifizieren sich ueber das Token als Query-Parameter (`GET /api/sse?token=<token>`), da `EventSource` keine eigenen Header setzen kann.
- **Hinweis:** Query-Strings koennen in Reverse-Proxy-Access-Logs, CDN-Logs und Browser-Verlauf erscheinen.
- **Mitigation:**
  - Reverse-Proxy / CDN so konfigurieren, dass **Query-Strings fuer den `/api/sse`-Pfad nicht geloggt** werden.
  - TLS end-to-end sicherstellen, damit Tokens nicht im Transit exponiert werden.
  - Der SSE-Handler verifiziert das Token beim Connect ueber den aktiven Verifier; mit dem `local`-Verifier lehnt die `tokenVersion`-Pruefung widerrufene Tokens ab (identisch zu HTTP-Auth).

### Secret-Rotation-Playbook

#### JWT-Secret-Rotation (local-Verifier)

1. Neues starkes Secret im Secret-Manager erzeugen.
2. Alle App-Instanzen mit neuem `JWT_SECRET` deployen.
3. Neuen Login-Flow verifizieren.
4. Erwartete Session-Invalidierung kommunizieren.
5. `401`-Spikes nach dem Rollout beobachten und Erholung sicherstellen.

Hinweis: Der `local`-Verifier nutzt Single-Key-Verification. Eine Rotation invalidiert bestehende Tokens global. Fuer nahtlose Rotation waere Multi-Key-Verification (`kid` + aktive/vorherige Secrets) erforderlich. Mit `AUTH_VERIFIER=cognito` uebernimmt Cognitos JWKS die Schluesselrotation; eine app-seitige `JWT_SECRET`-Rotation entfaellt.

### Reverse-Proxy- und `TRUST_PROXY`-Verifikation

Vor Go-Live und nach jeder Proxy-Topologie-Aenderung ausfuehren.

#### Erforderliche Forwarding-Header

- `X-Forwarded-For: $proxy_add_x_forwarded_for`
- `X-Forwarded-Proto: $scheme`
- `Host: $host`

#### Verifikationsschritte

1. `TRUST_PROXY` auf reale Hop-Anzahl setzen (typisch `1` bei Nginx direkt vor Node).
2. App neu starten.
3. Wiederholte ungueltige Login-Versuche gegen `/api/auth/login` senden.
4. Bestaetigen:
   - Erste Versuche liefern `401`,
   - wiederholte Versuche liefern `429` mit `Retry-After`,
   - serverseitige Client-IP-Zuordnung entspricht externer Quelladresse.

#### Troubleshooting

- Wenn alle Requests als localhost/Proxy-IP erscheinen: zuerst Header und `TRUST_PROXY` korrigieren.
- Wenn Limits zu streng/zu schwach wirken: Hop-Count und Upstream-Layer (CDN/LB) erneut pruefen.
- Verifikation nach Hinzufuegen/Entfernen von Proxy-Layern wiederholen.

### Incident-Playbooks

#### Auth-Missbrauch / Brute-Force

1. Spikes in `401`/`429` und fehlgeschlagene Login-Muster bestaetigen.
2. Local-Auth: `AUTH_LOGIN_MAX_REQUESTS`, `AUTH_IDENTIFIER_MAX_REQUESTS` und `LOGIN_LOCKOUT_*` verschaerfen. Cognito (AWS): WAF-Rate-Regeln / Advanced Security verschaerfen.
3. Temporare Edge-Blocks / Rate-Limits auf Reverse-Proxy oder WAF setzen.
4. Korrektes `TRUST_PROXY` waehrend der Mitigation verifizieren.

#### SSE-Missbrauch / Connection-Flood

1. Spikes bei `GET /api/sse`-Verbindungszahlen in Proxy-/CDN-/Lambda-Logs bestaetigen.
2. Reverse-Proxy-/WAF-Verbindungs- und Rate-Limits speziell fuer den `/api/sse`-Pfad setzen.
3. SSE-Listener werden beim Disconnect aufgeraeumt; anhaltende Floods werden am besten am Edge mitigiert.

### Monitoring- und Alert-Signale

- HTTP-Auth-bezogene Spikes: `401`, `403`, `429` (strukturierte JSON-Security-Logs; `recordHttpSecurityStatus`).
- SSE-Signale: anhaltendes Wachstum gleichzeitiger `/api/sse`-Verbindungen am Edge.
- Auf anhaltende Spikes alerten, nicht auf Einzelereignisse, um Rauschen zu reduzieren.

### Automatisierte Abdeckung (Security-Tests)

Aktuell vorhandene automatisierte Tests fuer zentrale Security-Controls:

- `tests/server/unit/appSecurity.test.ts`
  - prueft Basis-`helmet`-Header (X-Content-Type-Options, X-Frame-Options, X-DNS-Prefetch-Control, X-Download-Options)
  - validiert CORS-Allowlist-Verhalten (erlaubte Origins bekommen `204`; blockierte Origins bekommen `403`)
  - prueft JSON-Body-Limit-Durchsetzung (`413`)
  - prueft, dass keine Stack-Traces bei internen Fehlern geleakt werden
- `tests/server/unit/sseEndpoint.test.ts`
  - prueft SSE-Auth, Frame-Routing und Listener-Cleanup beim Disconnect ueber einen echten HTTP-Server
- `tests/server/unit/securityMonitoring.test.ts`
  - validiert strukturierte Security-Log-Emission fuer HTTP-Auth-Status-Codes (`401`/`403`/`429`)
- `tests/server/unit/configSecurityGuards.test.ts`
  - validiert Production-Config-Guards (`JWT_SECRET`, `INVITE_CODE`, CORS-Wildcard-Ablehnung)
- `tests/server/unit/cognitoPreSignUp.test.ts` / `cognitoPostConfirmation.test.ts` / `cognitoTokenVerifier.test.ts`
  - validieren Invite-Code-Gate, RDS-User-Anlage und Access-Token-→-internal-User-Mapping fuer Cognito
- `tests/client/integration/auth.api.test.ts`
  - validiert Login/Signup-Rate-Limits und progressiven Login-Lockout (`429` + `Retry-After`), local-Verifier
  - validiert Session-Revoke (`POST /api/auth/revoke-sessions`)

### Produktions-Verifikationsprotokoll

Kurze Vorlage zur Dokumentation finaler Go-Live-Checks.

Checkliste:

- `CORS_ALLOWED_ORIGINS` enthaelt nur reale Frontend-Origin(s).
- `TRUST_PROXY` passt zur realen Proxy-Hop-Topologie.
- `JWT_SECRET` (local mode) und `INVITE_CODE` sind stark und via Secret-Management eingebunden.
- Auth-Rate-Limits liefern `429` inklusive `Retry-After` (local-Auth) / Cognito + WAF-Limits in AWS aktiv.
- Reverse-Proxy / CDN liefert `GET /api/sse` als langlebige, nicht gebufferte Antwort.

Protokoll:

- Datum:
- Umgebung:
- Verifiziert durch:
- Notizen:

### Abhaengigkeits-Risiko-Triage (Aktuell)

Nach `npm run security:audit` diesen Abschnitt verwenden.

#### Prioritaet A - Bald aktualisieren

- **`vite` (hoch):** Dev-Server File-Read/Path-Traversal-Advisories. Auf gepatchte Version aktualisieren.
- **`prisma` / `@prisma/config` / `effect` (hoch, transitiv):** Prisma-Toolchain aktualisieren, um gepatchte transitive Versionen zu ziehen.
- **`defu` / `path-to-regexp` (hoch, transitiv):** ueber Lockfile-Refresh und Dependency-Updates aufnehmen.
- **`postcss` (mittel):** im regulaeren Dependency-Update auf gepatchte Version bringen.

#### Prioritaet B - Kein Upstream-Fix verfuegbar (`xlsx`)

- `xlsx` meldet derzeit hohe Advisories ohne verfuegbaren npm-Fix.
- Operative Mitigation:
  - nur erwartete XLS/XLSX-Formate akzeptieren (im Workflow bereits erzwungen),
  - Import-Payload-Groessen begrenzen,
  - importierte Dateien als untrusted Input behandeln,
  - Advisories fuer verfuegbare gepatchte Versionen beobachten.
- Bei jedem woechentlichen Dependency-Review/Dependabot-Zyklus neu bewerten.

#### Reihenfolge der Umsetzung

1. `npm audit fix` in einem Branch ausfuehren und Lockfile/Package-Updates pruefen.
2. Direkte Dependencies mit Advisories (z. B. `vite`, Prisma-Stack, `postcss`) gezielt aktualisieren.
3. Volle Checks laufen lassen: `npm run test:integration`, `npm run build`, `npm run security:audit`.
4. Falls `xlsx` weiter offen bleibt, Mitigation und Ausnahmebegruendung in diesem Dokument festhalten.
