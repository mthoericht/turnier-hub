# To-do: Offline-Desktop-App mit gemeinsamem LAN-Betrieb

## Für morgen offen — Dokumentation (Arbeit auf Nutzerwunsch beendet)

Stand 23.10.2026: Der Nutzer hat die heutige Arbeit ausdrücklich beendet.
Die Dokumentationsüberarbeitung bleibt als To-do offen; keine weiteren Builds,
Tests, Commits oder Pushes wurden dafür ausgeführt.

- [ ] README verständlich kürzen und den aktuellen Electron-Ablauf erklären:
  `dev`/`desktop:dev`, eigener Server und Entwicklungsbestand, `pack` versus `dist`,
  Mac-arm64-Priorität, LAN-Nutzung und Host-Verwaltung.
- [ ] Security-Dokumentation entschlacken; obsolete Login-/JWT-/Invite-/Rollen-
  und Schulverwaltungsbeschreibungen entfernen. Tatsächliche Origin-/Host-/IPC-
  und Dateizugriffsgrenzen beibehalten und korrekt erklären; keine Schutzmaßnahmen
  im Code im Rahmen dieser Dokumentationsaufgabe abbauen.
- [ ] Datenpfade, Backup-/Schema-Grenzen und offene Abnahmen konsistent darstellen.
- [ ] Server-/Prisma-/Ansible-/Storybook-Dokumentation, AGENTS.md und diesen Plan
  auf widersprüchliche Altangaben prüfen; alle relevanten Verweise kontrollieren.

Bereits begonnen: Vier **unfertige, noch nicht abschließend geprüfte Entwürfe**
für README.md, desktop/README.md, doc/SECURITY.md und doc/SECURITY_DE.md liegen
im Arbeitsordner `/Users/marcus/.codex/worktrees/ea01/turnier-hub`. Eine zusätzliche
Kopie ist im Hauptprojekt unter `.local/documentation-drafts-20261023/` gesichert.
Diese Entwürfe sind noch **nicht in die aktiven Dokumente des Hauptordners übernommen**;
einige geplante Verweise benötigen noch die zugehörigen Dokumente/Prüfung.
Die aktive Dokumentation im Hauptordner bleibt bis zur Fortsetzung unverändert,
abgesehen von dieser Wiedereinstiegsnotiz. Die funktionierende kontofreie App
und die bereits geprüfte Hauptordner-Integration bleiben erhalten.


Arbeitsstand: 23.10.2026. Dieses Dokument ist der dauerhafte Arbeitsplan für den geplanten Umbau. Nach anfänglicher reiner Dokumentation wurde der kleine Mac-arm64-Prototyp ausdrücklich zur Umsetzung freigegeben. Erbrachte Nachweise stehen unten; der größere Umbau bleibt offen.

## Aktueller Wiedereinstieg: einheitlicher Hauptordner

Der Nutzer hat die Integration in `/Users/marcus/gitRoot/turnier-hub` ausdrücklich
beauftragt. Die separat bearbeitete Version wird nach Sicherung und Abgleich der
vorhandenen Änderungen übernommen; kein Commit/Push, keine Bestandsmigration.
Die folgenden aktuellen Angaben ersetzen frühere Prototyp-/Login-Zwischenstände.

- Kontofreie App einschließlich Host-Verwaltung umgesetzt. Login, Registrierung,
  Benutzer/Rollen/Schulmandanten, Erstelleranzeigen und eigene/alle Filter entfernt.
- Vollständiges Backup/Restore, automatische Sicherung vor Austausch, bestätigtes
  Zurücksetzen, optionale Seeds nur bei leerem Bestand; keine privilegierten LAN-APIs.
- Host-IP und Verbindungsinformationen liegen in der Host-Verwaltung, kein Banner.
- `npm run dev` und `npm run desktop:dev` starten dieselbe lokale Electron-Host-App
  mit eigenem Server auf Port 3220 und eigener `.local/desktop-dev/`-Datenbank.
  Kein separater Starter oder Wechsel in einen anderen Projektordner erforderlich.
- `desktop:pack:mac` und `desktop:dist:mac` bauen denselben Quellstand. Das gebaute
  Paket benutzt standardmäßig Port 3210 und eigene Standalone-Daten.
- Auth-Tests, API-Integration, WebSocket-Tests und Storybook-Verweise angepasst:
  51 Server- und 91 Client-/Integrations-/Storybook-Tests bestanden auf neuer
  temporärer Datenbank. 19 Desktop-Speicher-/Backup-Tests bestanden zuvor.
- Alte Entwicklungs-/Test-/Prototypdaten bleiben unverändert. Das neue Schema wird
  nur auf frische Test- oder Build-Datenbanken angewandt, nicht auf Altbestände.
- Hauptordner-Abnahme bestanden: `dev`/`desktop:dev`, `desktop:pack:mac` und
  `desktop:dist:mac` dort tatsächlich ausgeführt. Native Dev-App auf Port 3220 und
  gebaute App auf Standardport 3210 zeigen Dashboard und Host-Verwaltung ohne Login.
  51 Server-, 91 Client-/Integrations-/Storybook- und 19 Desktop-Tests im Hauptordner
  bestanden; Paket-Smokes für Host-Verwaltung, Fehlerstarts, LAN und Persistenz bestanden.
- Ursprüngliche Änderungen unter `.local/integration-backup-20261023-160308/`
  gesichert. Keine Commits/Pushes. Kein separater Starter mehr erforderlich.
- Noch offen: neuer echter Zweitgerät-Test, Windows, Signierung, versionierte
  Schema-Updates sowie umfassende Offline-/Release-Abnahme.

## Ziel und Arbeitsweise

Turnier-Hub soll als Electron-App auf Windows und macOS vollständig offline starten. Auf einem Gastgeber-Laptop starten der lokale Webserver und die bestehende Vue-Oberfläche automatisch. Andere Geräte im selben LAN/WLAN öffnen die angezeigte Netzwerkadresse im Browser und erhalten Änderungen über die bestehenden WebSockets. Im normalen Betrieb werden weder Internet noch separat installiertes Node.js oder Entwicklungswerkzeuge benötigt.

Die eingebettete SQLite-Datenbankdatei und die Turnierlogik bleiben zentral auf dem Gastgeber. Alle Geräte greifen über den lokalen App-Webserver auf den gemeinsamen Bestand zu; es gibt keinen separaten SQLite-Datenbankserver. Local Storage ist keine gemeinsame Hauptdatenbank. Verbundene Geräte dürfen den gemeinsamen Bestand ohne Benutzerkonten bearbeiten. Schulklassen bleiben erhalten; Benutzerverwaltung und schulbezogene Trennung entfallen. Ein vollständiges Beenden der Gastgeber-App beendet den Netzwerkbetrieb.

- Aufgaben erst als `[x]` markieren, wenn das Ergebnis und die zugehörigen Abschlusskriterien geprüft sind. Prüfnachweise mit Datum, App-Version, Betriebssystem/Architektur und Ergebnis ergänzen.
- Etappen der Reihe nach bearbeiten; aktuell zuerst den Mac-arm64-Prototyp und unmittelbar danach ein echtes zweites LAN-Gerät prüfen. Windows folgt später; ein Mac-Test bestätigt keine Windows-Unterstützung.
- Bestehende Vue-, Express-, Pinia-, Shared- und Turnier-Service-Struktur weiterverwenden. Keine pauschale Neuschreibung der Architektur.
- Vor Eingriffen Arbeitsstand prüfen und fremde Änderungen erhalten. Entwicklungs-, Test- und echte Bestandsdaten strikt trennen.
- Frischer Datenbestand ist zulässig; eine Migration alter Bestandsdaten ist nicht erforderlich. Vorhandene Datenbanken dennoch nicht ungefragt löschen, zurücksetzen oder überschreiben.

## Ausgangslage im Repository

Diese Hinweise beschreiben die Ausgangslage vor dem Prototyp. Änderungen daran sind in den Fortschrittsnachweisen festgehalten:

- `server/src/index.ts` startet HTTP und WebSockets und legt derzeit eine Standardschule an. `server/src/app.ts` liefert die gebaute SPA aus `client/dist` aus.
- `server/src/config.ts` verlangt im Produktionsmodus unter anderem JWT-, Invite- und Origin-Konfiguration. `server/src/db.ts` erzeugt den Prisma Client; das Schema nutzt SQLite.
- `server/prisma/schema.prisma` enthält `User`, `UserRole`, `School`, `AdminAuditLog` sowie `userId`-/`schoolId`-Bezüge in Fachdaten. Klassennamen sind aktuell durch `@@unique([schoolId, name])` je Schule eindeutig. Ältere Dokumentation nennt teilweise noch Eindeutigkeit je Ersteller; für Übernahmen ist das tatsächlich vorliegende Schema maßgeblich.
- REST-Routen filtern bereits nach Schulzuordnung, zusätzlich zu `scope=all|own`. Gemeinsamer Zugriff erfordert daher mehr als das Entfernen der Login-Ansicht.
- `client/src/api/http.ts`, der Auth-Store und Router verwenden Tokens. Der WebSocket-Hub prüft JWT und Origin; der Client verbindet tokenabhängig und erneuert nach Reconnect seine Abonnements, lädt dabei bisher nicht ausdrücklich alle verpassten Daten nach.
- `client/src/theme/fonts.css` lädt DM Sans und Outfit über Google Fonts. Eine Offline-Fertigstellung muss diese externe Abhängigkeit auflösen.
- `db:deploy` verwendet aktuell `prisma db push`; es gibt noch keinen versionierten Migrationsablauf für installierte Desktop-Datenbanken. Die vorhandenen Startskripte setzen teilweise Umgebungsvariablen in POSIX-Syntax.
- `doc/TODO.md` ist die historische Turnier-Checkliste und bleibt getrennt von diesem Plan.

## 0. Entscheidungen und Prüfumfang festhalten

- [ ] Unterstützte Windows-/macOS-Versionen und konkrete Testgeräte festlegen.
- [x] Entwicklungs-/Testplattform festgehalten (23.10.2026): Mac M4 mit Apple Silicon, Architektur arm64.
- [x] Aktuelle Priorität bestätigt (23.10.2026): zunächst ausschließlich den Mac-M4-/arm64-Prototyp paketieren und prüfen. Windows bleibt späteres primäres Auslieferungsziel; Windows-Paketierung wird jetzt nicht vorgezogen.
- [x] Datenhaltung bestätigt (23.10.2026): eingebettete SQLite-Datenbankdatei zentral auf dem Gastgeber, gemeinsamer Zugriff ausschließlich über den lokalen App-Webserver; kein separater SQLite-Datenbankserver und kein Local Storage als gemeinsame Hauptdatenbank. Umsetzung und Prüfung bleiben offen.
- [ ] Verbindliche Release-Matrix bestätigen: Windows ist primäres Auslieferungsziel; Windows 11 x64 ist vorläufige Planungsannahme. Konkrete Windows-Version, Hardware und echter Windows-Testrechner sowie unterstützte OS-Mindestversionen bleiben zu bestätigen. Intel-Mac und Windows ARM sind vorerst keine festen Paketziele.
- [x] Verhalten beim Fensterschließen entschieden (23.10.2026): App vollständig beenden, Server sauber stoppen und alle LAN-/WebSocket-Verbindungen beenden; kein Weiterlaufen im Hintergrund, auch unter macOS. Umsetzung und Abnahme bleiben offene Aufgaben in den folgenden Etappen.
- [ ] Portstrategie entscheiden: bevorzugter Port, Konfliktbehandlung, gegebenenfalls Ersatzport und sichtbare tatsächliche Adresse.
- [x] Datenstart entschieden (23.10.2026): keine Migration alter Bestandsdaten erforderlich; frischer Datenbestand ist zulässig. Vorhandene Datenbanken bleiben ohne gesonderten Löschauftrag erhalten.
- [x] Seed-Erhalt und Zugang entschieden (23.10.2026): bestehendes Seed-Skript als wiederverwendbare Grundlage erhalten und später an das vereinfachte Schema ohne Benutzer-/Schulmandanten anpassen. Beispieldaten über eine kleine sichtbare App-Option (z. B. „Beispieldaten laden“) ausdrücklich und optional einfügen, nicht automatisch beim ersten oder normalen Start und nicht ausschließlich per Entwicklerkommando. Umsetzung und Prüfung bleiben offen.
- [ ] Verhalten von „Beispieldaten laden“ bei bereits gefüllter Datenbank entscheiden; weder Löschung noch Überschreibung unterstellen.
- [x] Fensterdarstellung entschieden (23.10.2026): normales, frei vergrößerbares/verkleinerbares App-Fenster mit responsiver Oberfläche; kein Vollbildzwang, keine starre Fenstergröße und keine unnötig große Mindestgröße. Tatsächliche Plattformgrenzen bleiben bestehen. Der Nutzer hat dem Start des kleinen Electron-Prototyp-Tests zugestimmt.
- [x] Netzwerkadresse entschieden (23.10.2026): im Gastgeber-Fenster gut sichtbar anzeigen, damit weitere Geräte die Oberfläche im LAN-Browser öffnen können. Umsetzung und Abnahme separat nachweisen.
- [x] Backup-Zugang und Umfang entschieden (23.10.2026): vollständigen fachlichen Datenbestand gemeinsam exportieren/importieren, nicht getrennt nach Bereichen. Ausschließlich die Desktop-App am Gastgeber nutzt dafür lokale Dateidialoge und das Dateisystem über einen vertrauenswürdigen Desktop-Kanal. LAN-Browser dürfen Backup/Restore nicht ausführen; keine neue Benutzerverwaltung einführen. Spieler-XLSX-Import/-Export bleibt gesondert erhalten. Umsetzung und Prüfung bleiben offen.
- [x] Erststart entschieden (23.10.2026): ohne weitere Nachfrage automatisch eine leere Datenbank im vorgesehenen beschreibbaren Benutzer-/App-Datenordner des Gastgeber-Laptops anlegen und die App direkt öffnen; keine Entwicklerwerkzeuge oder zusätzliche Laufzeitinstallation nötig. Folgestarts verwenden die bestehende Datenbank und initialisieren oder überschreiben sie niemals neu. Beispieldaten bleiben ausschließlich über die separate Option verfügbar. Umsetzung und Prüfung bleiben offen.
- [x] Schriftbereitstellung entschieden (23.10.2026): aktuell extern geladene Schriftarten lokal mit der App ausliefern; keinerlei Online-Schriftabruf, auch nicht beim ersten Start. Umsetzung und Prüfung bleiben offen.
- [x] Frühen LAN-Test entschieden (23.10.2026): direkt nach dem ersten lauffähigen Electron-Prototyp einen kurzen Test mit einem zweiten LAN-Gerät durchführen, bevor Backup/Export und weiterer Feinschliff implementiert werden. Die Testdurchführung bleibt offen, bis ein echtes zweites Gerät beteiligt war.
- [ ] Regel für gleichzeitiges Speichern derselben Daten festlegen, insbesondere konkurrierende Ergebnisänderungen; verständliche Rückmeldung und konsistenter Serverstand als Abnahmekriterium definieren.
- [ ] Paketformat, manuelle Offline-Updates und spätere optionale Update-Funktion entscheiden. Ein Online-Updater darf keine Betriebs- oder Startvoraussetzung werden.

**Abschlusskriterium:** Entscheidungen mit Datum und Begründung hier oder in verlinkten Entscheidungsnotizen festgehalten; weiterhin offene Punkte ausdrücklich benannt. Vor abhängigen Arbeiten muss die jeweilige Entscheidung vorliegen.

### Entscheidungsnotizen vom 23.10.2026

- Direkt nach dem ersten lauffähigen Electron-Prototyp folgt ein kurzer Test mit einem echten zweiten LAN-Gerät. Dieser Nachweis geht der Implementierung von Backup/Export und weiterem Feinschliff voraus. Lokale Simulationen ersetzen ihn nicht.
- Die aktuell extern geladenen Schriftarten werden lokal mit der App ausgeliefert. Online-Schriftabrufe sind ausgeschlossen, einschließlich beim ersten Start ohne Cache. Diese Richtung ist beschlossen; lokale Dateien, Einbindung und Offline-Prüfung sind noch umzusetzen.
- Beim ersten Start wird ohne weitere Nachfrage eine leere Datenbank im vorgesehenen beschreibbaren Benutzer-/App-Datenordner des Gastgeber-Laptops angelegt; anschließend öffnet sich die App direkt. Dafür sind weder Entwicklerwerkzeuge noch die Installation zusätzlicher Laufzeiten nötig. Bei Folgestarts wird die bestehende Datenbank verwendet, niemals neu initialisiert oder überschrieben. Eine vorhandene, aber nicht lesbare oder beschädigte Datenbank gilt nicht als fehlende Datenbank und darf nicht still ersetzt werden. Sichere versionierte Schema-Updates bleiben davon getrennt; Beispieldaten werden weiterhin nur über die separate Option geladen.
- Backup und Restore umfassen jeweils den gesamten fachlichen Datenbestand gemeinsam. Sie stehen ausschließlich in der Desktop-App auf dem Gastgeber-Laptop über lokale Dateidialoge und das lokale Dateisystem zur Verfügung. Privilegierte Gastgeber-Funktionen werden über einen vertrauenswürdigen Desktop-Kanal abgegrenzt; ausgeblendete Browser-Buttons genügen nicht, und die allgemeine LAN-API darf diese Funktionen nicht ungeschützt anbieten. Verbundene LAN-Browser dürfen weder Backup noch Restore ausführen. Daraus entsteht keine neue Benutzerverwaltung. Der bestehende Spieler-XLSX-Import/-Export bleibt eine separate Fachfunktion.
- Alte Klassen, Spieler und Turniere müssen nicht migriert werden; ein frischer Datenbestand ist zulässig. Dies erlaubt keine ungefragte Löschung vorhandener Datenbanken. Die Erstinitialisierung einer neuen Datenbank und sichere Schema-Updates späterer Desktop-Versionen bleiben erforderlich.
- Das vorhandene Seed-Skript soll als wiederverwendbare Grundlage erhalten bleiben. Es wird an das spätere Schema ohne Benutzer und Schulmandanten angepasst und ausdrücklich getestet. Beispieldaten werden über eine kleine sichtbare Option in der App (z. B. „Beispieldaten laden“) eingefügt, nicht ausschließlich per Entwicklerkommando. Weder beim ersten noch beim normalen Start werden sie automatisch geladen. Das Verhalten bei bereits gefüllter Datenbank ist noch offen; Löschen oder Überschreiben ist damit nicht beschlossen.
- Ein normales, frei skalierbares App-Fenster mit responsiver Oberfläche ist gewünscht, ohne starre Größe, Vollbildzwang oder unnötig große Mindestgröße. Schmale und breite Fenster sind zu prüfen; Betriebssystemgrenzen bleiben bestehen. Die Netzwerkadresse soll im Gastgeber-Fenster gut sichtbar sein. Der Nutzer hat den kleinen Electron-Prototyp und den unmittelbar folgenden Zweitgerät-Test inzwischen ausdrücklich zur Umsetzung freigegeben; der größere Umbau bleibt davon getrennt.
- Der Nutzer bestätigt SQLite als zentrale Datenhaltung auf dem Gastgeber: eine eingebettete Datenbankdatei, kein separater SQLite-Datenbankserver. Desktop-Oberfläche und verbundene Browser nutzen den lokalen App-Webserver für den gemeinsamen Zugriff. Local Storage übernimmt nicht die Rolle der gemeinsamen Hauptdatenbank. Dies bestätigt die Architekturentscheidung, nicht deren bereits erfolgte Umsetzung.
- Der vorhandene Entwicklungs-/Testrechner ist ein Mac M4 (Apple Silicon arm64). Diese Plattform bildet die aktuelle macOS-Arbeitsgrundlage.
- Windows ist das primäre Auslieferungsziel. Der Nutzer vermutet eine aktuelle Windows-Version auf einem normalen Intel-Prozessor; deshalb wird zunächst mit Windows 11 x64 geplant. Dies ist ausdrücklich eine vorläufige Annahme und keine bestätigte Hardware- oder Supportzusage. Konkrete Version/Hardware und ein echter Windows-Testrechner fehlen noch. Intel-Mac und Windows ARM sind vorerst keine festen Paketziele; OS-Mindestversionen bleiben offen.
- Fensterschließen soll auf beiden Betriebssystemen einschließlich macOS die gesamte App beenden. Server und sämtliche LAN-/WebSocket-Verbindungen müssen dabei sauber beendet werden. Hintergrundbetrieb ist ausgeschlossen. Die Entscheidung ist getroffen; ihre Implementierung und Prüfung sind noch nicht erfolgt.

## 1. Kleinen Electron-Prototyp mit bestehendem Server nachweisen

Diese Etappe erhält zunächst Authentifizierung, Schulmodell und Turnierfunktionen. Prototypdaten bleiben von echten Daten getrennt; eventuell nötige temporäre Konfiguration gehört nicht als Geheimnis ins Release-Paket.

- [x] Minimalen Electron-Einstieg und reproduzierbare Entwicklungsskripte ergänzen, ohne den bestehenden Web-Entwicklungsablauf unnötig umzubauen. Mac-arm64-Build und Start nachgewiesen.
- [x] Oberfläche in einem normalen, frei skalierbaren App-Fenster öffnen; keinen Vollbildstart, keine starre Größe und keine unnötig große Mindestgröße vorgeben. Darstellung bei 430 und 1200 Pixel Breite geprüft und visuell kontrolliert.
- [x] Bestehenden Express-/WebSocket-Server mit der durch Electron mitgelieferten Laufzeit starten; Bereitschaft abwarten, bevor die Vue-SPA lädt. Im Prototyp läuft der Server im Electron-Hauptprozess, um keinen separaten Node-Prozess oder verwaiste Kindprozesse zu benötigen; der Renderer bleibt isoliert.
- [x] Gebaute SPA, Server, Shared-Paket und Laufzeitabhängigkeiten für Mac arm64 paketieren; Start nach Entpacken des ZIPs unter `/private/tmp/` außerhalb des Repositorys samt SQLite-/WebSocket-/Neustartprüfung bestanden. Andere Plattformen bleiben offen.
- [x] Prisma Client und native darwin-arm64-Bibliothek außerhalb des App-Archivs mitliefern; SQLite-Lesen/Schreiben im paketierten Mac-Prototyp geprüft, keine Engine-Downloads beim Start. Andere Plattformen bleiben separat offen.
- [x] Schreibbaren Prototyp-Datenordner außerhalb des App-Pakets verwenden und SQLite dort initialisieren; initiale Anlage und Neustart in getrennten temporären App-Datenordnern geprüft. Normaler Mac-Pfad: `~/Library/Application Support/Turnier-Hub Prototyp/`.
- [x] Produktionskonfiguration des bestehenden Servers explizit bereitstellen, ohne manuelle `.env`-Bearbeitung. Getrennte zufällige Prototyp-Zugangskonfiguration wird lokal erzeugt; Repository-`.env` bleibt ungenutzt.
- [x] Server für LAN-Zugriff binden, passende Origins konfigurieren und Netzwerkadresse im Gastgeber-Fenster anzeigen. HTTP und WebSockets über die eigene LAN-Schnittstelle des Macs geprüft; echter Zweitgerät-Test bleibt offen.
- [ ] Installation/Erststart ohne separat installiertes Node.js und ohne Entwicklungswerkzeuge auf sauberem macOS-Zielsystem prüfen. Paketierte Mac-App auf dem Entwicklungs-Mac bereits gestartet; dies ist kein Clean-Machine-Nachweis.
- [ ] Windows-Paketierung und Start ohne Node.js/Entwicklungswerkzeuge später auf echtem Windows-Testgerät nachweisen; aktuell zurückgestellt.
- [x] Browseroberfläche auf einem echten zweiten Gerät im selben WLAN öffnen und Live-Änderungen prüfen. Nutzerbestätigung vom 23.10.2026: „Ja. Funktioniert.“ Gerätetyp und Betriebssystem wurden nicht genannt.
- [ ] Vollständige Mehrgeräte-Abnahme mit dokumentierten CRUD-, Ergebnis-/Timer- und Abbruch-/Reconnect-Szenarien durchführen; die kurze Nutzerbestätigung ersetzt diese ausführliche Abnahme nicht.
- [x] Prototyp durch Fensterschließen vollständig beenden; Prozessende, geschlossene HTTP-/WebSocket-Verbindungen und Wiederverwendbarkeit des Ports beim Neustart im paketierten Mac-Prototyp geprüft.

**Abschlusskriterium / Freigabepunkt für den nächsten Umbau:** Aktuell muss der paketierte Mac-Prototyp in einem normalen Fenster mit SQLite und einem echten zweiten LAN-Gerät funktionieren; Start, Lesen/Schreiben, Live-Änderung und Beenden sind zu protokollieren. Vor Backup/Export und Feinschliff zuerst diesen Zweitgerät-Test abschließen. Windows-Nachweis folgt gemäß neuer Priorität später und bleibt eine eigene offene Plattformaufgabe. Bekannte Paketierungsprobleme müssen gelöst oder ausdrücklich bewertet sein.

## 2. Desktop-Lebenszyklus und lokale Datenhaltung stabilisieren

- [ ] Einzelinstanz sicherstellen: zweiter Start aktiviert die vorhandene App und startet keinen zweiten schreibenden Server für dieselbe Datenbank.
- [ ] Start-/Stop-Schnittstellen für HTTP, WebSockets und Prisma mit sauberer Freigabe von Verbindungen und Dateien schaffen.
- [ ] Zustände „Startet“, „Bereit“, „Fehler“ und „Beendet“ anzeigen; fehlende Ressourcen, belegten Port, nicht beschreibbaren Datenordner und beschädigte Datenbank verständlich behandeln.
- [ ] Bei fehlgeschlagenem Start aufräumen; keine verwaisten Prozesse, hängenden Ports oder automatische Endlosschleifen erzeugen. Diagnoseprotokolle lokal auffindbar machen.
- [ ] Entschiedenes Verhalten beim Fensterschließen implementieren: gesamte App einschließlich Server und aller LAN-/WebSocket-Verbindungen sauber beenden, auch unter macOS; kein Hintergrundbetrieb. Menü und Betriebssystem-Beenden konsistent behandeln.
- [ ] Persistenten Datenordner je Betriebssystem festlegen, etwa über Electron `userData`; Datenbank, Einstellungen, Logs und Sicherungen klar zuordnen. Pfade mit Leerzeichen/Umlauten und Standardbenutzerrechte prüfen.
- [ ] `DATABASE_URL` vor Prisma-Initialisierung auf den persistenten Pfad setzen. Entwicklungs- und Testdatenbanken bleiben getrennt.
- [ ] Beim ersten Start ohne weitere Nachfrage automatisch eine leere Datenbank samt Schema im vorgesehenen beschreibbaren Benutzer-/App-Datenordner anlegen und danach die App direkt öffnen; ohne Internet, Prisma-Download, Entwicklerwerkzeuge, zusätzliche Laufzeitinstallation oder manuelle CLI-Befehle. Keine Demodaten automatisch laden.
- [ ] Bei Folgestarts die vorhandene Datenbank weiterverwenden und niemals neu initialisieren oder überschreiben; vorhandene unlesbare/beschädigte Dateien als Fehler behandeln statt durch einen leeren Bestand zu ersetzen. Sichere versionierte Schema-Updates separat durchführen.
- [ ] Versionierten, mitgelieferten Schema-Update-Ablauf einführen; Ausgangsversion erkennen, Schritte geordnet anwenden und Wiederholung sicher behandeln. `db push`/`force-reset` nicht als unbeaufsichtigten Desktop-Update-Mechanismus verwenden.
- [ ] Vor Updates konsistente Sicherung erstellen; Fehler/Unterbrechungen abfangen und Wiederherstellung ermöglichen. Unbekannte neuere Schemaversionen erkennen und unsichere Downgrades verhindern.
- [ ] Electron-Fenster mit isoliertem Renderer und ohne Node-Zugriff betreiben; benötigte Desktop-Funktionen über eine enge Schnittstelle anbieten. Fremde Navigation und neue Fenster kontrolliert behandeln.

**Abschlusskriterium:** Der erste Start legt ohne Nachfrage eine leere Datenbank im vorgesehenen App-Datenordner an und öffnet die App ohne zusätzliche Werkzeuge/Laufzeiten. Folgestarts nutzen den bestehenden Bestand ohne Neuinitialisierung oder Überschreibung; Beispieldaten erscheinen nur nach expliziter Auswahl. Wiederholte Starts, zweiter App-Start, belegter Port, Startfehler und vollständiges Beenden funktionieren nachvollziehbar. Daten überstehen Neustart und App-Ersetzung; Erstinitialisierung und versioniertes Update funktionieren offline an separaten Testkopien.

## 3. Vereinfachtes Datenmodell und frischen Bestand vorbereiten

- [ ] Zielmodell ohne Benutzerkonten, Rollen, Ersteller und Schulmandanten festlegen; `SchoolClass`, Spieler, Turniere, Teams, Mitgliedschaften und Spiele samt Beziehungen erhalten.
- [ ] Neue Eindeutigkeitsregel für Klassennamen im gemeinsamen Bestand festlegen und mit Seed- sowie Importdaten prüfen. Eine Zusammenführung alter Schulbestände gehört nicht zum beschlossenen Umfang.
- [ ] Abhängigkeiten und Löschkaskaden von `User`, `School` und `AdminAuditLog` prüfen. Konten/Schulen nicht durch einfache Löschung entfernen, wenn dadurch Fachdaten kaskadierend verloren gingen.
- [ ] Sichere Schemaänderung zum Entfernen von `userId`, `schoolId`, zugehörigen Relationen/Indizes, `UserRole`, Auth- und Admin-Audit-Modellen vorbereiten; Reihenfolge mit API-/Typänderungen abstimmen.
- [ ] Für den frischen Start eine neue separate Datenbank anlegen; vorhandene alte Datenbanken auffindbar und unverändert erhalten. Kein stilles Überschreiben oder Löschen.
- [ ] Bestehendes Seed-Skript (`server/scripts/seed.ts` und `server/src/seed/demoSeed.ts`) für Klassen, Spieler und alle drei Turniermodi erhalten und an das vereinfachte Schema ohne Benutzer-/Schulmandanten anpassen; zugehörige Root-Skripte weiter nutzbar halten.
- [ ] Kleine sichtbare App-Option „Beispieldaten laden“ auf Grundlage der wiederverwendbaren Seed-Logik anbieten; ohne Entwicklerkommando bedienbar. Verhalten für einen gefüllten Bestand erst nach der offenen Entscheidung umsetzen.
- [ ] Seed gezielt auf einer separaten frischen Testdatenbank ausführen und Beziehungen, Kader, Spiele sowie alle drei Turniermodi prüfen. Normaler App-Start bleibt ohne automatische Demodaten; erneute Seed-Ausführung darf nicht ungefragt echte Daten zurücksetzen.
- [ ] Repräsentative Testbestände im neuen gemeinsamen Schema mit Spielern ohne Klasse, Kadern, Ergebnissen und Timerzuständen für spätere versionierte Desktop-Updates anlegen.

**Abschlusskriterium:** Eine frische Datenbank startet ohne Demodaten; über die sichtbare App-Option lassen sich ohne Entwicklerkommando gültige Klassen, Spieler und alle drei Turniermodi ohne Benutzer-/Schulmandanten laden. Das bestehende Seed-Skript bleibt als wiederverwendbare Grundlage nutzbar und geprüft. Das zuvor ausdrücklich entschiedene Verhalten bei gefülltem Bestand ist separat getestet; keine ungefragte Löschung oder Überschreibung. Vorhandene alte Datenbanken bleiben unangetastet. Keine verwaisten Referenzen; Schema und erzeugter Prisma Client passen zusammen. Eine Migration alter Bestandsdaten ist kein Abnahmekriterium; sichere Updates künftiger Desktop-Datenbanken bleiben erforderlich.

## 4. Authentifizierung und Schultrennung schrittweise entfernen

Jeden Teilschritt über Server, Shared-Typen, Client und Tests konsistent abschließen. Die Reihenfolge innerhalb dieser Etappe mit Etappe 3 abstimmen.

- [ ] REST-Auth-/Admin-Routen und Middleware entfernen: Login, Signup, Invite-Code, Rollenprüfung, Sitzungswiderruf, Token-Versionen, Passwort-Hashing, Benutzer-/Schulverwaltung und Admin-Audit-Funktionen.
- [ ] In Klassen-, Spieler- und allen Turnier-Routen Benutzer-/Schulabfragen, Filter und Schreibzuordnungen entfernen; auch Teamtransfer, Mitgliedschaften, Import, Statistik-/Dashboarddaten und Existenzprüfungen berücksichtigen.
- [ ] Klassen-, Spieler- und Turnierlisten auf den gesamten lokalen Bestand umstellen; `scope=all|own` und dessen Parser/API-Optionen entfernen.
- [ ] Schulstartlogik und schulbezogene Hilfsfunktionen entfernen; fachliche Prüfung von IDs, Mitgliedschaften und Turnierzuständen beibehalten.
- [ ] Shared-Typen bereinigen: `AuthUser`, `UserRole`, `CreatedBy`, `createdBy`-Felder und `formatCreator` sowie Auth-/Admin-DTOs und Exporte entfernen. Katalog- und Turnier-DTOs weiter aus `@turnier-hub/shared` beziehen.
- [ ] Client-Auth-/Admin-APIs, Auth-Store, Router-Guards, Login-/Signup-/Admin-Ansichten und zugehörige Navigation entfernen; Dashboard direkt erreichbar machen.
- [ ] Tokenablage `turnier_hub_token`, Bearer-Header, `skipAuth` und Logout-/401-Weiterleitungen bereinigen; veraltete lokale Tokenreste gezielt entfernen, ohne andere lokale Einstellungen zu löschen.
- [ ] Erstelleranzeigen einschließlich Tabellen, Tooltips und Kaderlisten sowie „Alle/Eigene“-Umschalter, Schulfilter und zugehörige Stores/Composables entfernen. Klassenfilter, Suche und Sortierung erhalten.
- [ ] Bearbeitungsfreigaben wie `canUserEditTournament` vom Login lösen; jedes verbundene Gerät kann den gemeinsamen Bestand bedienen.
- [ ] Auth-/Admin-Tests, Storybook-Stories, Mocks, Fixtures, Seed- und Clear-Skripte sowie Test-DB-Helfer anpassen. Fachliche Testabdeckung erhalten und neue kontofreie API-Flows prüfen.
- [ ] Nicht mehr benötigte Auth-Pakete/Typdefinitionen und Konfigurationen samt Lockfile bereinigen; `JWT_SECRET`, `INVITE_CODE`, `DEFAULT_SCHOOL_NAME`, Auth-Limits und Lockout-Einstellungen aus Laufzeitkonfiguration und Beispielen entfernen.
- [ ] Mit gezielter Repository-Suche restliche Auth-/Rollen-/Ersteller-/Schulmandanten-Abhängigkeiten prüfen und beabsichtigte historische Hinweise kennzeichnen. Schulklassen dabei nicht versehentlich entfernen.

**Abschlusskriterium:** Frischer Desktop- und Browserstart benötigen weder Konto noch Token. CRUD und Turnierbetrieb funktionieren im gemeinsamen Bestand ohne Schulfilter. Ausgebaute Funktionen haben keine aktiven Routen, UI-Einträge oder ungenutzten Laufzeitabhängigkeiten mehr.

## 5. LAN und Live-Synchronisierung ohne JWT fertigstellen

- [ ] Explizite LAN-Bindung, lokale Fensteradresse und angezeigte Netzwerkadresse aufeinander abstimmen; Loopback-Adresse nicht als Adresse für andere Geräte ausgeben.
- [ ] Bei mehreren Netzwerkschnittstellen passende Adressen verständlich anzeigen; fehlendes LAN, VPN-/virtuelle Adapter und Adresswechsel behandeln. Lokale Einzelplatznutzung bleibt ohne Netzwerk möglich.
- [ ] REST und WebSocket über denselben Gastgeber und Port erreichbar halten; SPA-Routen und Assets auch bei direktem Browseraufruf korrekt ausliefern.
- [ ] HTTP-Origin-/Host-Regeln und WebSocket-Upgrade-Prüfungen ohne JWT neu gestalten. Tatsächliche Loopback-/LAN-Adressen und Port berücksichtigen; erlaubte und abgewiesene Origins einschließlich fehlendem Origin testen. Keine pauschale Wildcard als Ersatz für ein geprüftes Konzept.
- [ ] JWT-URL-Parameter und Benutzerbezug aus WebSocket-Metadaten entfernen. Pfad-, Payload-, Nachrichten- und Abonnementvalidierung sowie passende Größen-/Ratenlimits beibehalten.
- [ ] Realtime-Verbindung beim App-/Seitenstart herstellen und nach Verbindungsabbruch ohne Auth-Store wiederaufbauen; Abonnements erneut senden.
- [ ] Nach Reconnect aktuelle aktive Turnier-, Katalog-, Listen- und Dashboarddaten abrufen, damit während der Unterbrechung verpasste Ereignisse aufgeholt werden.
- [ ] Bestehendes Zusammenführen ungespeicherter Score-Entwürfe auch beim Wiederverbinden erhalten; keine unbemerkte Überschreibung während des Tippens. Gelöschte Spiele und konkurrierende gespeicherte Änderungen gemäß gewählter Regel behandeln.
- [ ] Verbindungsstatus und fehlgeschlagene Schreibvorgänge sichtbar machen; keine erfolgreiche Speicherung vortäuschen. Reconnect darf keine ungewollt doppelten Mutationen auslösen.
- [ ] `tournamentChanged`, `catalogChanged` und `tournamentsChanged` mit mehreren Browsern prüfen; zentrale SQLite-Schreibzugriffe konsistent halten, keine replizierte Browser-Hauptdatenbank einführen.
- [ ] Windows-/macOS-Firewall und WLAN-Client-Isolation praktisch prüfen; verständliche Hilfe für erlaubten LAN-Zugriff anbieten. Keine Router-Portfreigabe oder Internetveröffentlichung voraussetzen.

**Abschlusskriterium:** Mindestens Gastgeber plus zweites Gerät bearbeiten offline im selben LAN denselben Bestand und sehen Live-Änderungen. Nach WLAN-Unterbrechung und Serverneustart wird der aktuelle Stand geladen; lokale Ergebnisentwürfe bleiben bei automatischen Aktualisierungen erhalten.

## 6. Offline-Ressourcen und bestehende Funktionen erhalten

- [ ] Beschlossene lokale Schriftbereitstellung umsetzen: Google-Fonts-Import in `client/src/theme/fonts.css` durch mitgelieferte lokale Schriften ersetzen; benötigte Schnitte, Lizenzen, CSS-Pfade und Fallbacks prüfen. Keinerlei Online-Schriftabruf zulassen, auch nicht beim ersten Start ohne Cache.
- [ ] Produktionsoberfläche und Paket auf externe Fonts, CDNs, Bilder, Skripte, Telemetrie, Remote-APIs und automatische Downloads prüfen; nötige Ressourcen lokal mitliefern oder Abhängigkeiten entfernen.
- [ ] Gesamten Erststart mit leerem Browser-/App-Cache und blockiertem Internet prüfen. Keine Build-, Installations- oder Engine-Downloads zur Laufzeit.
- [ ] Klassen-/Spielerverwaltung mit Suche, Sortierung und Klassenzuordnung sowie Mannschaftsverwaltung und Kadertransfer erhalten.
- [ ] Spieler-XLS/XLSX-Import und XLSX-Export mit `Vorname`, `Name`, `Klasse` erhalten; `append`, `replace_players` und `reset_all` auf den gemeinsamen Bestand abstimmen. Destruktiven Umfang klar anzeigen und bestätigen lassen; XLSX ersetzt kein vollständiges Backup.
- [ ] Alle drei Turniermodi prüfen: `GROUP_KO` mit mehreren Gruppen/Qualifikation, `DIRECT_KO` mit nicht durch zwei teilbaren Teilnehmerzahlen/Freilosen und `ROUND_ROBIN` mit parallelen Runden. Einzelspieler als Teams erhalten.
- [ ] Gruppenneuerzeugung, KO-Aufstieg, Ranglisten, Umbenennung, automatische Fertigstellung und „alle Spiele löschen“ mit bisherigen Schutzdialogen prüfen.
- [ ] Timer Start/Pause/Fortsetzen/Ende/Abbruch und Ende ohne vorherigen Start erhalten; KO-Sieger weiterhin aus gespeicherten Ergebnissen bestimmen. Lokaler Sekundentakt ohne sekündliche Netzwerkabfragen bleibt erhalten.
- [ ] Verhalten laufender Timer bei Schlafmodus, Gastgeberneustart und unterschiedlich eingestellten Geräteuhren festlegen und prüfen; serverseitigen Zustand und Browseranzeige konsistent halten.
- [ ] Responsive Browsernutzung sowie Tastaturbedienung, Fokusführung und zugängliche Status-/Fehleranzeigen auch für neue Desktop- und Sicherungsdialoge prüfen.

**Abschlusskriterium:** Kernfunktionen laufen mit gesperrtem Internet und ohne gecachte Fremdressourcen; Timer, Turniermodi und Spielerdateiaustausch bestehen die dokumentierten Regressionstests.

## 7. Vollständiges Backup und Restore anbieten

- [ ] Beschlossenen gemeinsamen Sicherungsumfang umsetzen: vollständige Fachdaten inklusive Klassen, Spieler, Turniere, Teams, Kader, Spiele, Ergebnisse und Timer sowie erforderliche Einstellungen in einem vollständigen Export/Import statt nach Bereichen getrennten Backups; Format-/Schemaversion und Prüfmetadaten aufnehmen.
- [ ] Konsistente SQLite-Sicherung während des Betriebs ermöglichen, etwa durch koordinierte Schreibpause oder geeigneten Snapshot; WAL-/Begleitdateien berücksichtigen. Keine unkoordinierte Kopie einer schreibenden Datenbank.
- [ ] Verständlichen vollständigen Export und Restore ausschließlich in der Desktop-App am Gastgeber mit lokalen Dateidialogen und Dateisystemzugriff bereitstellen; verbundene Browser währenddessen passend informieren. Spieler-XLSX-Import/-Export gesondert erhalten.
- [ ] Backup-/Restore-Aufrufe über einen vertrauenswürdigen Desktop-Kanal absichern und dessen aufrufenden Kontext prüfen; keine ungeschützten Endpunkte in der allgemeinen LAN-API anbieten. Ausblenden von Buttons genügt nicht. Keine Benutzerkonten oder Rollen dafür einführen.
- [ ] Mit einem verbundenen LAN-Browser auch direkte/konstruierte Aufrufe prüfen: weder Backup-Export noch Restore darf ausführbar sein oder Zugriff auf Gastgeber-Dateien ermöglichen; der reguläre gemeinsame Turnierbetrieb bleibt möglich.
- [ ] Restore-Datei vor Austausch auf Format, Vollständigkeit, Integrität, unterstützte Version und Fachreferenzen prüfen; beschädigte oder zu neue Dateien ohne Veränderung des Bestands ablehnen.
- [ ] Vor jedem Restore automatisch eine konsistente Sicherung des aktuellen Bestands erstellen; erst danach kontrolliert austauschen. Bei Fehlern bisherigen Bestand wiederherstellen und Ursache anzeigen.
- [ ] Schreibzugriffe während Restore koordinieren, Prisma-/Dateihandles sauber schließen und danach Clients aktualisieren beziehungsweise neu verbinden.
- [ ] Roundtrip zwischen unterstützten Windows-/macOS-Paketen testen; Ergebnisse, Beziehungen und Timer vor/nach Restore vergleichen. Abbruch, fehlende Schreibrechte und unzureichenden Speicherplatz prüfen.

**Abschlusskriterium:** Vollständiger Backup-/Restore-Roundtrip des gesamten fachlichen Bestands gelingt offline ausschließlich über die Desktop-App am Gastgeber mit lokalen Dateidialogen. LAN-Browser können beide Funktionen auch durch direkte Aufrufe nicht ausführen; die Abgrenzung ist technisch geprüft und benötigt keine Benutzerverwaltung. Spieler-XLSX-Import/-Export bleibt separat funktionsfähig. Ungültige Sicherungen verändern nichts; vor Restore existiert eine überprüfbare Sicherung und ein getesteter Wiederherstellungsweg.

## 8. Pakete, Updates und Release vorbereiten

- [ ] Für jede beschlossene OS-/Architektur-Kombination reproduzierbare Build-/Paketierungsschritte einrichten; benötigte Prisma-Bestandteile und sämtliche Laufzeitressourcen im fertigen Paket kontrollieren.
- [ ] Plattformübergreifende Skripte bereitstellen; POSIX-Umgebungsvariablen-Syntax nicht ungeprüft in Windows-Abläufe übernehmen.
- [ ] Offline-Installation, Erststart, Betrieb und Deinstallation an sauberen Zielsystemen ohne Node.js, npm, Prisma CLI oder Entwicklungswerkzeuge testen. Vorgehen zum Erhalt/gezielten Entfernen persönlicher Daten bei Deinstallation dokumentieren.
- [ ] Offline-Update aus lokalem Installationspaket testen: Datenordner erhalten, Sicherung und Schema-Update ausführen, anschließend gemeinsamen LAN-Betrieb prüfen. Automatische Online-Prüfung darf Start und Betrieb nicht blockieren.
- [ ] Windows-Code-Signierung als Release-Aufgabe klären: benötigtes Zertifikat/Signierdienst, Zuständigkeit, Kosten und sichere Bereitstellung in der Build-Umgebung festhalten; kein vorhandenes Zertifikat voraussetzen.
- [ ] macOS-Signierung und Notarisierung als Release-Aufgabe klären: Apple-Developer-Zugang, Zertifikate, Berechtigungen und Build-Zugänge beschaffen/konfigurieren; Offline-Verifikation des verteilten Pakets einschließlich geeigneter beigefügter Notarisierungsnachweise prüfen.
- [ ] Signierung/Notarisierung und eventuell dafür nötige Online-Schritte beim Release getrennt vom vollständig offline möglichen Anwenderbetrieb dokumentieren. Verhalten von Gatekeeper/Windows-Schutzmechanismen auf frischen Systemen prüfen.
- [ ] Installationsartefakte mit Version, Architektur, Prüfsummen und benötigten Drittanbieter-Lizenzhinweisen bereitstellen; Release-Prüfnachweise zuordnen.

**Abschlusskriterium:** Für jede zugesagte Zielplattform liegt ein getestetes Paket vor. Installation, Start und Update sind ohne Laufzeit-Downloads möglich; Signierungsstatus und etwaige noch offene Release-Voraussetzungen sind ausdrücklich dokumentiert.

## 9. Technische Prüfung und Endabnahme

Die folgenden Prüfungen gehören zur späteren Implementierung. Für die alleinige Erstellung dieses Plans sind keine Builds oder Datenbankbefehle erforderlich.

- [ ] Nach substanziellen Client-Änderungen `npm run lint -w client` ausführen; bei Typänderungen zusätzlich `npx vue-tsc --build --noEmit` in `client/`.
- [ ] `npm run build` vom Repository-Root aus prüfen; Shared-, Server- und Client-Ausgabe sowie zusätzliche Desktop-Typ-/Paketprüfungen einbeziehen.
- [ ] Relevante Unit-Tests ausführen und anpassen: `npm run test:unit`, Client-Unit-Tests sowie insbesondere `realtimeHub`, `realtimeClient`, `tournamentDerive`, `matchElapsed`, `matchTimer`, KO- und Round-Robin-Logik.
- [ ] API-/Import-/Turnier-Integration nach Umbau mit isolierter Testdatenbank prüfen (`npm run test:integration`); entfernte Auth-/Admin-Flows durch kontofreie Flows ersetzen. Keine echte Datenbank an Test-Reset-Helfer anschließen.
- [ ] Gesamte passende Testsuite mit `npm run test` einschließlich angepasster Storybook-Fixtures prüfen; `npm run security:audit` nach Abhängigkeitsänderungen bewerten.
- [ ] Für jede Zielplattform Abnahmeprotokoll ausfüllen: Installation und Erststart offline; lokale Nutzung ohne LAN; Mehrgerätebetrieb im LAN ohne Internet; bidirektionale Änderungen; alle drei Turniermodi; Timer; XLSX; Backup/Restore.
- [ ] Fehlerfälle abnehmen: Portkonflikt, zweiter Start, Firewallblockade, WLAN-Abbruch/Reconnect, Schlafmodus, Serverfehler, ungültiges Backup und abgebrochenes Schema-Update.
- [ ] Persistenz abnehmen: App vollständig beenden und neu starten, Rechnerneustart, neues App-Paket installieren; Bestand, Beziehungen, gespeicherte Ergebnisse und definierter Timerzustand bleiben korrekt.
- [ ] Vereinbarte Fenster-Schließen-Semantik prüfen; nach vollständigem Beenden sind Browser nicht mehr verbunden und keine Serverprozesse oder offenen Ports übrig.
- [ ] Mit leerem Cache und blockiertem Internet Netzwerkzugriffe kontrollieren und bestätigen, dass keinerlei externe Anfrage für Kernfunktionen erfolgreich sein muss.

**Abschlusskriterium:** Alle zugesagten Plattformen bestehen die Abnahme mit konkreten Nachweisen. Verbleibende Fehler werden als offene Aufgaben mit Auswirkung geführt; keine pauschale Erledigt-Markierung trotz ungeprüfter Zielplattformen.

## 10. Dokumentation und Übergabe

- [ ] Englische `README.md` und `AGENTS.md` an den tatsächlichen Desktop-/LAN-Betrieb, neue Skripte, Datenpfade und Prüfabläufe anpassen; Entwicklerinstallation vom normalen Anwenderbetrieb unterscheiden.
- [ ] Server-Dokumentation, `server/.env.example`, Prisma-Hinweise und Sicherheitsdokumentation von veralteten Auth-/Schul-/Deployment-Annahmen bereinigen. Relevante Origin-, Eingabe- und WebSocket-Schutzmaßnahmen weiter erklären.
- [ ] Bestehende Ansible-/Webhosting-Anleitung hinsichtlich künftigem Support einordnen; keine unentschiedene Entfernung des alten Betriebswegs vorwegnehmen.
- [ ] Kurzanleitung erstellen: App starten, Adresse teilen, gemeinsames WLAN, Bearbeitung durch verbundene Geräte ohne Konten, Firewallhilfe, Fensterschließen versus vollständiges Beenden und Abhängigkeit vom Gastgeber erklären.
- [ ] Frischen Datenstart ohne erforderliche Altbestandsmigration, Erhalt vorhandener Datenbanken, optionale explizite Seed-Nutzung, Backup/Restore, Offline-Update, Datenordner und Wiederherstellung bei Fehlern dokumentieren.
- [ ] Diesen Plan mit tatsächlichen Ergebnissen und Prüfnachweisen aktualisieren; spätere Erweiterungen getrennt vom vereinbarten Umbau führen.

**Abschlusskriterium:** Eine Person ohne Entwicklungskenntnisse kann anhand der Anleitung offline installieren, ein Turnier mit einem zweiten LAN-Gerät betreiben, sichern, wiederherstellen und die App vollständig beenden.

## Fortschrittsnachweise

Bei Abschluss einer Aufgabe oder Etappe hier Einträge ergänzen, zum Beispiel mit folgendem Schema:

`Datum · Etappe/Aufgabe · App-Version/Änderungsreferenz · OS/Architektur · Prüfschritte und Ergebnis · verbleibende Punkte`

### 23.10.2026 · Mac-Prototyp 0.1.0 · darwin/arm64

- Nutzer bestätigt nach ausdrücklicher Rückfrage den erfolgreichen Test auf einem echten zweiten Gerät im selben WLAN mit automatisch sichtbaren Änderungen. Der frühe LAN-Machbarkeitsnachweis ist damit erbracht; genaue Geräte-/OS-Angaben und ausführliche Fachszenarien bleiben für die spätere Gesamt-Abnahme offen. Anschließend wurde die Fortsetzung mit den nächsten Punkten beauftragt.
- Implementiert: Electron-Fenster mit sichtbarer LAN-Leiste, gemeinsamem Server-Lebenszyklus, Einzelinstanz, getrennter SQLite-Datei, mitgelieferter leerer Schema-Vorlage, expliziter Prisma-Ressourcenpaketierung und lokalen Schriften samt Lizenzdateien. Authentifizierung und Schulmodell bleiben vorläufig erhalten. Kein Backup/Restore und kein größerer Auth-/Schema-Umbau implementiert.
- Paketierte `.app` auf diesem Apple-Silicon-Mac tatsächlich gestartet. Automatisierte Prüfung mit `desktop/smoke.mjs`: leere Fachdaten, Registrierung/Anmeldung, Klasse speichern/lesen, WebSocket-Broadcast, HTTP und WebSocket über Loopback sowie eigene IPv4-LAN-Adresse, Einzelinstanz, 430/1200-Pixel-Fenster, lokale Fonts, Fensterschließen beendet Prozess/HTTP/WebSockets, Neustart erhält Daten und Einstellungen. Nur separate temporäre Testdaten verwendet.
- `npm run desktop:dist:mac` erfolgreich: eigenständige Mac-App und `release/desktop/Turnier-Hub Prototyp-0.1.0-arm64-mac.zip` (ca. 150 MB). ZIP unter `/private/tmp/turnier-hub-relocated-d7f4i2q3/` entpackt und dieselben Prüfungen erneut bestanden. Bericht dieses unabhängigen Paketstarts: `/var/folders/pj/3k___h651zd104tq1pzh15cm0000gn/T/turnier-hub-desktop-smoke-ZqGZv8/report.json`. App enthält Electron/Node und Prisma; der Testrechner selbst besitzt weiterhin Entwicklungswerkzeuge, daher kein Nachweis für ein sauberes Fremdsystem.
- Normale paketierte App anschließend ohne Testdatenordner-Override geöffnet. Native UI-Prüfung bestätigt sichtbare LAN-Leiste mit `http://192.168.178.93:3210` und vorhandene Vue-Login-Seite. Für den manuellen Zweitgerät-Test geöffnet gelassen; die angezeigte IP kann sich mit dem Netzwerk ändern.
- Prüfbericht des Paketstarts: `/var/folders/pj/3k___h651zd104tq1pzh15cm0000gn/T/turnier-hub-desktop-smoke-QLJyOo/report.json`; dort auch Screenshots. Vue-Inhalte in schmalem/breitem Fenster visuell kontrolliert. Externe Renderer-Anfragen bei den Navigationsprüfungen blockiert, keine externen Ressourcen angefordert. Physisch getrennte Internetverbindung und sauberes Zielsystem noch nicht nachgewiesen.
- Bestanden: Produktionsbuild, Client-Lint, 55 Server-Unit-Tests einschließlich neuer Lifecycle-/Portkonflikt-Tests und 45 Client-Unit-Tests.
- Offen/fehlgeschlagen: kompletter Client-Typcheck meldet bereits vorhandenes ungenutztes `emit` in `client/src/components/admin/AdminSchoolDialog.vue:11`. Security-Audit meldet hohe/kritische Abhängigkeitsbefunde; keine pauschalen automatischen Updates durchgeführt. Beides ist vor einer Release-Freigabe zu bearbeiten.
- Weiterhin offen: echtes zweites LAN-Gerät, Windows, Clean-Machine-/physischer Offline-Installationstest, Signierung/Notarisierung und alle weiteren Umbauetappen. Nächste manuelle Prüfschritte stehen in `desktop/README.md`.
# Ergänzung: Host-Verwaltung (23.10.2026)

Der Nutzer hat die Host-Verwaltung nachträglich ausdrücklich beauftragt. Dies
ersetzt die frühere Einschränkung, Backup/Restore noch nicht zu implementieren.

- Host-Verwaltung ausschließlich in lokalen Electron-Fenstern: vollständiger Export,
  validierter Restore, optionale Beispieldaten nur bei leerem Bestand, bestätigtes
  Zurücksetzen, automatische Sicherung vor jedem Austausch und Wiederanlauf mit Rollback.
- Host-IP, LAN-/lokale Adresse, Port, Version und Datenordner sind in die Verwaltung
  verschoben; das dauerhafte Informationsbanner wurde entfernt.
- Einheitliche Dev-/Desktop-Skripte im Hauptprojekt ersetzen den früheren separaten Starter.
- Kontofreie Quelle und Host-Verwaltung mit ausschließlich temporären Daten geprüft;
  konkrete Prüfungen und Grenzen siehe `desktop/README.md`.
- Vollständige Alt-Testanpassung, neue echte Zweitgeräte-Abnahme, Windows,
  Schema-Updates und Signierung bleiben gesondert offen. Bestehende Entwicklungs-
  und alte Prototypdaten werden durch diese Arbeiten nicht verändert.

