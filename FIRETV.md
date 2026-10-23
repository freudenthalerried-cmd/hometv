# FIRETV – Projektnotiz HomeTV (Fire-TV-App)

Kurzüberblick für spätere Sitzungen. Besitzer: Stefan (Ried in der Riedmark, 4312). Antworten kurz, Deutsch, ehrliches Feedback.

## Installation / Update
- Fire TV → App **Downloader** → Code **2001529** → installieren (führt immer auf die neueste APK).
- APK + Daten liegen im Release `firetv` von `freudenthalerried-cmd/hometv`:
  `AbendKino.apk`, `version.json`, `content.json`, `verified.json`.
- Die App sucht beim Start und alle 6 h nach Updates und lädt sie automatisch (Android verlangt 1× „Installieren“).

## Aufbau
- Android-WebView-App (Java, `app/src/main/java/at/sf/abendkino/MainActivity.java`), Oberfläche in `app/src/main/assets/`:
  `index.html` (Kern), `home.js` (Startseite, Musik, YouTube, Comedy, Entspannung), `news.js` (Nachrichten/Live),
  `shows.js` (Favoriten-Sendungen, Lernen, YouTube-Suche), `film.js` (interaktiver Film), `games.js` (Paar-Spiele),
  `rate.js` (☰-Menü, Sterne, Ähnliche), `inject.js` (Player: werbefreier Eigenplayer, Spulen mit Vorschau, Statusanzeige).
- Privat-Bereich: 3× OK beim Passwort-Feld.

## Privat-Videos (Hauptfunktion)
- Quellen: **XNXX, XVideos, Pornhub** (Videoseite statt Embed → 720p/1080p). **RedTube aus** (läuft am Fire TV meist nicht, in Einstellungen einschaltbar).
  Verworfen nach Tests: YouPorn (API tot), Eporner, Tube8, SpankBang, HQporner, xHamster, PornTrex, YouJizz, Tnaflix, Porn.com, SunPorno, Txxx, HClips, Upornia.
- **Keine 480p**: nur 720p+ (Vorab-Prüfung verwirft `lowq`).
- **Geprüft-Liste** (`verified.json`): GitHub spielt jeden **Montag** alle Listen-Videos + neue Kandidaten wirklich ab; nur was in 720p+ lief, kommt auf die Liste.
  App zeigt standardmäßig nur diese („Nur geprüfte Videos“). Sperrt eine Seite den US-Testserver komplett, bleiben ihre Videos bis 10 Tage.
- Am Gerät zusätzlich: Vorab-Prüfung jedes Videos, automatisches Überspringen, Quelle schaltet sich ab bei 4 von 5 Fehlschlägen, ☰ „⚠ Geht nicht“.

## Restliches Programm
- Mediatheken (MediathekViewWeb): Filme, Dokus, Comedy, Lernen, Entspannung **nur HD**; Nachrichten auch SD.
- **ZIB, ServusTV (Live, Servus Nachrichten, Wegscheider) und ORF-Inhalte immer behalten** (Wunsch des Besitzers; vom US-Testserver oft nicht abrufbar).
- Kein Kaminfeuer, keine Gebärdensprache/OmU, keine Kamera in der Oberfläche.

## Tests
- Lokal: Playwright mit Mock-Bridge (72 App-Tests, Player-Tests).
- GitHub Actions: `apk.yml` (Build, versionCode 100 + Lauf), `content.yml`, `verified.yml` (Geprüft-Liste + neue Kandidaten + restliches Programm, Montag),
  `source-test.yml` (Quellen-Test, Montag + bei Änderungen). Workflows lassen sich nicht per API starten (403) – Push löst sie aus.
- Wöchentliche Kontrolle durch Claude: geplante Aufgabe Montag 8:47 (Wien).

## Offen
- Kamera-Code (CameraActivity.java, media3) und gespeicherte Tapo-Passwörter ganz löschen? → wartet auf OK des Besitzers.
