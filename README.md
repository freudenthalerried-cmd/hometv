# HomeTV – Fire TV App

Werbefreier Film-Browser für Fire TV. Quellen: Pornhub und RedTube (öffentliche Webmaster-APIs, offizielle Einbett-Player), gemischt und ohne Duplikate.
Nur Filme ≥ 10 Min. Reihen laden beim Scrollen endlos nach. Quellen einzeln abschaltbar unter Einstellungen.

## Installieren (Downloader)
URL in Downloader eingeben:

    https://github.com/freudenthalerried-cmd/hometv/releases/download/firetv/AbendKino.apk

**Downloader-Code: `2001529`** (aftv.news/2001529)

Updates: in der App unter Einstellungen → „Jetzt aktualisieren“ (App prüft beim Start automatisch).
Beim ersten Update einmal „Unbekannte Apps installieren“ für AbendKino erlauben.

## Bedienung
- OK: abspielen / Pause · ◀ ▶: ±15 s · ▲ ▼: ±2 min · Zurück: Player schließen
- Menü-Taste ☰: Film merken („Meine Liste“)

## Lernfunktion
Tags der angesehenen Filme werden gewichtet (≥ 5 Min. geschaut = +, < 45 s = −, gemerkt = ++),
ältere Vorlieben verblassen langsam. Daraus entstehen „Für dich“ und die Kategorie-Auswahl am Start.
Zurücksetzen unter Einstellungen.

## Build
GitHub Actions (`.github/workflows/firetv-apk.yml`) baut bei jedem Push und aktualisiert das Release `firetv`.

## Weitere Funktionen
- **Paar-Spiele** (3 Stufen: Romantisch / Prickelnd / Heiß): Liebeswürfel, Wahrheit oder Pflicht,
  Heiße Karten (mit Timer), Ich hab noch nie, Stellungs-Roulette, Massage-Reise (geführt, mit Timer)
- **Zufall**: startet sofort einen passenden, noch nicht gesehenen Film
- **Weiterschauen**: Filme starten dort, wo du aufgehört hast
- **PIN-Sperre** beim Start (4 Pfeiltasten), **Diskret-Modus** (Vorschaubilder unscharf)
- **Mindestlänge** 10/20/30 min, **Sleep-Timer** 30/60/90 min
- **Filme**: kostenlose deutsche Spielfilme, Tatort, Fernsehfilme und Dokus in voller Länge aus den
  Mediatheken (ARD, ZDF, arte, 3sat, ORF …) über die MediathekViewWeb-Suche – legal, HD, ohne Werbung

## Inhalte ohne Update ändern
`content.json` enthält alle Spieltexte, Kategorien und Film-Reihen (nur Daten, kein Code).
Auf GitHub bearbeiten und speichern → nach ca. 1 Minute veröffentlicht → beim nächsten App-Start übernommen.
Ungültige Einträge werden ignoriert, dann gelten die eingebauten Inhalte.

## HomeTV (Startbild)
Uhr, Wetter (Open-Meteo, Ort in Einstellungen), ORF-Nachrichten, Kacheln: Filme, Kameras (Tapo per RTSP-Kamerakonto,
nur im Heimnetz), Radio (Liste in content.json), Suche, Privat. **Privat**: Passwort-Abfrage zur Tarnung – 3× schnell OK
schaltet frei, beim Zurück zu Home wird wieder gesperrt. Die öffentliche Suche findet nur Mediathek-Filme.

## Comedy, Netzkino, Apps
- **Comedy**: ganze Sendungen aus den Mediatheken (heute-show, extra 3, Die Anstalt, Willkommen Österreich, Kabarett …) und
  offizielle YouTube-Kanäle (Liste in content.json → "youtube": [Name, Kanal-ID]).
- **Netzkino** in „Filme“: ganze Kinofilme gratis und legal (offizieller YouTube-Kanal).
- **Deine Apps** am Startbild: Netflix, Prime Video, Disney+, Joyn … direkt starten.

## Favoriten & Lernen
**★ Favoriten**: deine Sendungen (vorbelegt: Pufpaffs Happy Hour, Oberösterreich heute, Servus Nachrichten, Der Wegscheider, Sommerhaus der Stars, Die Geissens) mit „🆕 Neu hinzugefügt“ (letzte 14 Tage, noch nicht gesehen), Gemerkte und Bestbewertete.
Sendung hinzufügen per Namen oder bei jedem Film ☰ → „Sendung abonnieren“; ☰ ▼ = 1–5 Sterne.
Sendungen privater Sender kommen über die YouTube-Suche am Gerät – nur Videos vom offiziellen Kanal.
**🎓 Lernen**: planet schule, alpha Lernen, Quarks, Lesch & Co, nano, Planet Wissen, Wissen macht Ah!, simpleclub, MrWissen2go, Kurzgesagt.

## Geprüft-Liste (Privat)
GitHub spielt täglich jedes Kandidaten-Video wirklich ab (App-Code, App-Player, Werbeblocker) und veröffentlicht nur Videos, die in 720p+ liefen (verified.json). Standard in der App: „Nur geprüfte Videos“ (Einstellungen).

## Interaktiver Film (Privat → 🎬 Film)
Du entscheidest die Handlung (Berghütte, Erstes Date, Urlaub); zu jeder Entscheidung läuft eine passende, geprüfte Szene, danach geht die Geschichte weiter. Startet eine Szene nicht, wird sie automatisch ersetzt.

## Player
Privat-Videos werden vorab geprüft (gelöscht, privat, gesperrt, Kopierschutz → ausgeblendet). Startet eines nicht, kommt nach max. ~20 s automatisch das nächste der Reihe. ☰ → „⚠ Geht nicht“ meldet ein Video; Einstellungen zeigen die Quellen-Statistik. Der Selbsttest (Einstellungen, täglich auch automatisch) prüft jede Kategorie bis zur Videodatei – direkt am Fire TV.
Startet sofort; oben rechts steht immer, ob Pause, Lädt oder Springe. ◀ ▶ ▲ ▼ spulen mit kleinem Vorschaubild (bei normalen Videodateien),
danach geht es von selbst weiter (OK = sofort). Pornhub, RedTube, XVideos und XNXX laufen im eigenen Player ohne Werbung (fällt eine Datei aus, nimmt er automatisch die nächste), beste Qualität (720p+, kein 360p).

## Nachrichten
Live-TV (ORF 2, ServusTV mit Servus Nachrichten, tagesschau24, DW English), ZIB, Tagesschau, heute journal, Tagesthemen, Weltspiegel
und YouTube-Nachrichten (tagesschau, ZDFheute, DW News und BBC News auf Englisch mit Untertiteln). Ist die ServusTV-App installiert, gibt es einen Knopf dafür.

## Prüfung & Updates
Jeder Film, jedes YouTube-Video und jeder Live-Sender wird vor dem Anzeigen am Gerät geprüft (Live alle 10 Min., sonst täglich); was nicht läuft, wird ausgeblendet.
Updates werden beim Start und alle 6 Stunden gesucht und automatisch geladen; Android verlangt danach einmal „Installieren“.
Einstellungen → 📋 Update-Protokoll zeigt alle Prüfungen, Downloads, Installationen und Inhalts-Updates.

## Musik, YouTube & Entspannung
Musik nach Stimmung (SomaFM, Radio Swiss – werbefrei; Liste in content.json "music") und Radio.
**YouTube**: offizielle Doku-Kanäle (Terra X, ZDFinfo, MDR DOK, Netzkino …), ohne Shorts ("youtube_rubrik").
**🌿 Entspannung**: Natur- und Tierdokus in voller Länge, auf Wunsch mit Lounge-Musik ("entspannung").
**Filme**: viele Doku-Reihen; Gebärdensprache, Audiodeskription, OmU/Originalfassung und Trailer werden ausgefiltert, HD bevorzugt, Vorschaubilder auf allen Karten.

## Interaktive Geschichten
In den Paar-Spielen: die App erzählt, ihr entscheidet mit ◀ ▶, mit Aufgaben und Timer (Berghütte, Hotelzimmer, Masseur-Abend).
Weitere Geschichten in content.json → games.stories.

## Lernen & Ähnliche
Kein manuelles Bewerten: die App lernt aus dem Verhalten – fast ganz geschaut = stark +, früh abgebrochen = −,
länger in der Vorschau angesehen = leicht +, Suchen. ☰ auf einem Video: Abspielen · Ähnliche · Merken.
