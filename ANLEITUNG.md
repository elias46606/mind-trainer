# Mind Trainer – Einrichtung

Die App läuft sofort im Gastmodus. Für Accounts und dein Admin-Dashboard brauchst du einmal ein kostenloses Firebase-Projekt (Spark-Tarif, keine Kreditkarte nötig). Dauer: ca. 10–15 Minuten, am besten am Laptop.

## 1. Firebase-Projekt anlegen
1. Öffne console.firebase.google.com und melde dich mit deinem Google-Konto an.
2. „Projekt erstellen“ → Name z. B. `mind-trainer` → Google Analytics ausschalten → erstellen.

## 2. Anmeldung per E-Mail aktivieren
1. Links: **Build → Authentication → Jetzt starten**.
2. Reiter **Anmeldemethode** → **E-Mail/Passwort** → aktivieren → Speichern.

## 3. Datenbank anlegen
1. Links: **Build → Firestore Database → Datenbank erstellen**.
2. Standort: **europe-west3 (Frankfurt)** → **Im Produktionsmodus starten**.
3. Reiter **Regeln** → alles löschen → Inhalt der Datei `firestore.rules` einfügen → **Veröffentlichen**.

## 4. Web-App verbinden
1. Zahnrad oben links → **Projekteinstellungen** → unten „Deine Apps“ → Symbol `</>` (Web).
2. Name `Mind Trainer` → registrieren (Hosting **nicht** anhaken).
3. Kopiere das Objekt `firebaseConfig = { … }`.
4. Öffne `config.js` und ersetze `window.FIREBASE_CONFIG = {};` durch `window.FIREBASE_CONFIG = { …deine Werte… };`

Die Werte sind nicht geheim. Geschützt werden die Daten durch die Regeln aus Schritt 3.

## 5. Auf GitHub Pages veröffentlichen
1. Auf github.com ein neues **öffentliches** Repository `mind-trainer` anlegen.
2. **Add file → Upload files** → alle Dateien aus diesem Ordner hochladen → Commit.
3. **Settings → Pages** → Source: „Deploy from a branch“ → Branch `main`, Ordner `/ (root)` → Save.
4. Nach 1–2 Minuten läuft die App unter `https://DEIN-NAME.github.io/mind-trainer/`.

## 6. Domain freigeben
In Firebase: **Authentication → Einstellungen → Autorisierte Domains → Domain hinzufügen** → `DEIN-NAME.github.io`.
Ohne diesen Schritt schlagen Registrierung und Login fehl.

## 7. Dich selbst zum Admin machen
1. Öffne deine App und registriere dich ganz normal.
2. Firebase: **Authentication → Nutzer** → kopiere deine **Nutzer-UID**.
3. **Firestore Database → Daten → Sammlung starten** → Sammlungs-ID `admins` → Dokument-ID = deine UID → Feld `rolle` (String) = `owner` → Speichern.
4. App neu laden → auf der Startseite erscheint die Kachel **Admin-Dashboard**.

Dort siehst du: Nutzer gesamt, neue Nutzer pro Tag (14 Tage), aktiv heute / in 7 Tagen, Runden gesamt und eine Liste aller Nutzer mit „zuletzt aktiv“. E-Mail-Adressen stehen nur in der Firebase-Konsole.

## 8. Aufs iPhone holen
Safari → App-Adresse öffnen → **Teilen → Zum Home-Bildschirm**. Die App startet dann im Vollbild wie eine normale App.

## Updates
- Neue Fragen: in `questions.js` ans Ende der Kategorie anhängen, mit **neuer, eindeutiger ID** (z. B. `k23`). IDs nie ändern oder wiederverwenden – daran erkennt die App, welche Fragen ein Nutzer schon kennt.
- Danach die geänderte Datei auf GitHub hochladen. Bei größeren Änderungen in `sw.js` die Versionsnummer (`mind-trainer-v2` → `v3`) erhöhen.

## Wichtig, bevor du die App öffentlich teilst
Sobald fremde Personen ein Konto anlegen, verarbeitest du personenbezogene Daten (E-Mail-Adressen). In Deutschland brauchst du dann eine **Datenschutzerklärung** und in der Regel ein **Impressum**. Für einen Test mit Freunden und Klassenkameraden reicht das Hinweisen; vor einer breiten Veröffentlichung solltest du beides ergänzen.

Der kostenlose Spark-Tarif reicht für den Anfang locker aus. Die aktuellen Limits stehen in der Firebase-Konsole unter „Nutzung und Abrechnung“.
