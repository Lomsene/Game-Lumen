# AETHER: ECLIPSE

**Ein endloser Survival-Roguelite, in dem dein Licht alles ist: Leben, Sicht und Waffenreichweite.**

Du bist ein Lichtfunke in einer kreisrunden Arena voller Dunkelheit. Dein Licht verlöscht jede Sekunde ein Stück. Besiegte Feinde lassen neues Licht fallen, doch je heller du strahlst, desto mehr Feinde lockst du an. Deine Waffen feuern automatisch, du konzentrierst dich aufs Ausweichen, Positionieren und auf die richtigen Upgrades.

Das Spiel hat kein Ende: Die Dunkelheit wird mit jeder Minute stärker, und nach jedem Boss kommt ein noch mächtigerer. Die einzige Frage lautet: **Wie lange hält dein Licht?**

Läuft im Browser (Desktop & Smartphone) und als Android-App (Querformat).

---

## Inhalt

- [Steuerung](#steuerung)
- [Spielmechaniken](#spielmechaniken)
- [Klassen, Waffen & Upgrades](#klassen-waffen--upgrades)
- [Die Schmiede (Meta-Progression)](#die-schmiede-meta-progression)
- [Schwierigkeit & Balancing](#schwierigkeit--balancing)
- [Smartphone & Performance](#smartphone--performance)
- [Entwicklung](#entwicklung)
- [Android-APK bauen](#android-apk-bauen)
- [Projektstruktur](#projektstruktur)
- [Änderungen in Version 2.0](#änderungen-in-version-20)

---

## Steuerung

| Aktion | Tastatur / Maus | Touch |
|---|---|---|
| Bewegen | WASD, ZQSD, Pfeiltasten • linke Maustaste halten | Irgendwo ziehen (virtueller Joystick) |
| Dash | Leertaste, Shift, E, Rechtsklick | **DASH**-Knopf |
| Supernova | R oder F | **NOVA**-Knopf (füllt sich sichtbar) |
| Pause | ESC, P | ⏸ oben rechts • Android-Zurück-Taste |
| Gabe wählen | 1 / 2 / 3 • R = neu würfeln • S = überspringen | Karte antippen |
| Neustart nach Game Over | Enter | Knopf |

Angegriffen wird **automatisch**. In den Einstellungen kannst du auf dem Handy einen festen Joystick, den Linkshänder-Modus (Knöpfe links) und Vibration einstellen.

---

## Spielmechaniken

### 💡 Licht = Leben
- Dein Licht sinkt ständig. Der Verlust wächst mit der Spielzeit (2,6/s am Anfang, bis 10/s).
- Treffer kosten Licht. Bei 0 Licht ist der Run vorbei.
- Je mehr Licht du hast, desto **größer ist dein Lichtradius** (= Waffenreichweite) und desto **mehr Schaden** machst du (bis +80 %).
- Unter 32 % Licht pulsiert ein roter Warnrand.

### 💎 Drops
- **Blaue Kristalle** geben Licht, **goldene Splitter** sind die Währung der Schmiede.
- Beide gibt es **klein** und **groß**. Gewöhnliche Feinde lassen manchmal große Drops fallen, Elites immer einen großen Lichtkristall.
- Bosse überschütten die Arena mit **vielen großen Drops**.
- Große Drops werden aus größerer Entfernung angezogen und bleiben länger liegen. Kurz vor dem Verschwinden blinken Drops.
- Mit der Zeit lässt nicht mehr jeder Feind Licht fallen, damit Licht auch spät knapp bleibt.

### ⚡ Supernova
- Wird durch **Kills geladen** (Elites zählen 5-fach, ein Boss-Kill lädt sie sofort voll).
- Opfert **50 % deines aktuellen Lichts**, verwüstet alles im Umkreis, löscht alle feindlichen Geschosse und hinterlässt einen Ring aus Sonnenfeuern.
- Während des Schutzes (ca. 3 s) bist du unverwundbar und **verlierst kein Licht**.
- Jede weitere Supernova braucht 25 % mehr Kills.

### 💀 Endlose Bosse
- Nach jeweils ca. **2:30 Minuten ohne Boss** erscheint der nächste. Der HUD-Zähler zeigt „BOSS X IN m:ss“, 10 Sekunden vorher kommt eine Warnung.
- **Jeder Boss hat 2,5× so viel Leben wie der vorherige** und neue Fähigkeiten:

| # | Boss | Fähigkeiten |
|---|---|---|
| 1 | The First Dark | Geschossringe, Diener beschwören |
| 2 | The Eclipse | Spiralen, gezielte Fächer-Salven, Sturmangriff |
| 3 | The Void Sovereign | Ringe, Mörser-Regen, rotierendes Kreuzfeuer, Diener |
| 4 | The Hollow Star | Fächer, Sturmangriff, Schattenrisse, Spiralen |
| 5 | The Night Weaver | Kreuzfeuer, Spiralen, Mörser, Diener |
| 6 | The Light Eater | Ringe, Sturmangriff, Risse, Fächer, Mörser |
| 7+ | … II, III, … | Kombinieren die Fähigkeiten zweier Bosse |

- Bosse haben 2–4 Phasen. Jede Phase greift schneller an, ab Phase 3 kommen Doppelangriffe.
- Gefährliche Angriffe sind **angekündigt**: Sturmangriffe zeigen eine orange Bahn, Mörser einen schrumpfenden Ring.

### Weitere Ereignisse
- **Void-Obelisken**: Bleib im Kreis, bis er geladen ist. Das bringt Overdrive, +35 Licht, Splitter und eine Nova-Explosion, aber währenddessen kommen Wächter.
- **Schattenrisse**: ziehen dich an und verdoppeln den Lichtverlust.
- **Schwarm-Umzingelung**: ein Ring aus Feinden, alle ~48 s (nicht während Bossen).
- **Elite-Champions** (goldener Ring): 3× HP, mehr Belohnung.
- **13 Gegnertypen**, darunter Lichtdiebe (Leech), Scharfschützen mit Laser-Vorwarnung, Mörser, Schild-Vanguards (Frontschild) und Splitter, die sich teilen.

---

## Klassen, Waffen & Upgrades

**Klassen** (in der Schmiede freischaltbar): Aether-Wanderer (Pulse), Solar-Vanguard (Orbiters, viel Licht), Void-Jäger (Needles, hoher Schaden), Sternen-Architekt (Beacon, großer Lichtradius).

**8 Waffen**, max. 4 gleichzeitig, jede mit Stufe 1–5 und einer **Evolution**:

| Waffe | Evolution | Kurzbeschreibung |
|---|---|---|
| Pulse | Supernova | Schockwelle bis zum Lichtrand mit Rückstoß |
| Lance | Prismatic Beam | Durchbohrender Strahl |
| Sparks | Stellar Swarm | Zielsuchende, rotierende Lichtsterne, auch außerhalb des Lichts |
| Orbiters | Solar Corona | Kreisende Kugeln, blocken Geschosse |
| Flare | Daybreak | Granaten mit brennenden Sonnenfeldern |
| Radiance | Twin Sun | Dauerstrahl mit Hitze-Bonus |
| Needles | Starlight Barrage | Schnelles Nadelfeuer, jeder 4. Schuss durchdringt Schilde |
| Beacon | Constellation | Lichtsäulen mit Laserfäden |

Dazu kommen über **20 passive Upgrades**, darunter **Eclipse-Pakte** mit Risiko/Nutzen und Klassen-Meisterschaften. Wenn alles ausgebaut ist, gibt es endlos stapelbare Bonus-Gaben (Sternenkraft, Lichtquelle, Splitterregen). Evolutionen und Upgrades eigener Waffen werden bevorzugt angeboten.

---

## Die Schmiede (Meta-Progression)

Splitter aus jedem Run bleiben erhalten und werden in dauerhafte Verbesserungen investiert. Die neuen **Start-Upgrades** machen die ersten Minuten spürbar leichter, ohne das späte Spiel trivial zu machen:

| Upgrade | Wirkung |
|---|---|
| 🔰 **Morgenschild** | Starte mit 1–3 Schildladungen, die je einen Treffer komplett abfangen |
| 🗡️ **Vorbereitung** | Startwaffe beginnt 1–2 Stufen höher |
| 🎁 **Startgabe** | 1–2 kostenlose Gaben direkt zu Beginn |
| 📈 **Erfahrene Seele** | +12 % XP pro Stufe |
| 🔥 Ewige Flamme | +15 Max-Licht pro Stufe |
| 🛡️ Dunkelheitsresistenz | −6 % Lichtverlust pro Stufe |
| ⚔️ Seelenstärke | +8 % Waffenschaden pro Stufe |
| ⚡ Reflex-Matrix | Schnellerer Dash, längere Unverwundbarkeit |
| 💥 Supernova-Fokus | Stärkere, schneller ladende Supernova |
| … | Magnet, Rerolls, Splitter-Chance, Klassen-Meisterschaften, Skins |

Spielstände liegen im `localStorage` (Schlüssel `lumen_save_v1`, kompatibel mit alten Spielständen). Einstellungen liegen unter `aether_settings_v1`.

---

## Schwierigkeit & Balancing

Es gibt bewusst **keine Schwierigkeitsgrade**: Das Spiel wird mit der Zeit immer schwerer. Alle Formeln stehen zentral in [`src/engine/Balance.ts`](src/engine/Balance.ts). `npm run balance` gibt die Kurven als Tabelle aus.

| Minute | Gegner-HP | Gegner-Schaden | Lichtverlust/s | Licht-Drop-Chance |
|---|---|---|---|---|
| 0 | ×1 | ×1,0 | 2,6 | 100 % |
| 5 | ×7,6 | ×1,3 | 4,1 | 53 % |
| 10 | ×30 | ×1,7 | 5,6 | 36 % |
| 15 | ×81 | ×2,2 | 7,1 | 27 % |
| 20 | ×170 | ×2,8 | 8,6 | 22 % |

Der Kubik-Anteil der HP-Kurve sorgt dafür, dass auch der stärkste Build irgendwann von der Dunkelheit eingeholt wird.

**Getestet mit einem automatischen Bot** (kämpft, weicht aus, dasht und sammelt Licht; simulierte Runs):

| Schmiede-Ausbau | Überlebenszeit des Bots |
|---|---|
| keiner | ca. 2–4 Minuten (Boss 1 meist besiegt) |
| mittel | ca. 5–7 Minuten |
| voll ausgebaut | ca. 15–25 Minuten |

Ein Bot ist kein Mensch. Die Zahlen zeigen die Größenordnung, die echten Werte hängen vom Spielstil ab.

---

## Smartphone & Performance

- **Kein `shadowBlur` und keine pro Frame erzeugten Gradienten mehr.** Leuchteffekte sind vorgerenderte Sprites (`GlowCache`), Nebel und Warn-Vignette werden gecacht.
- **Automatische Qualität**: Bei unter ~50 FPS senkt das Spiel stufenweise die Auflösung (DPR 2,0 → 1,5 → 1,0) und die Effekt-Details. Hat das Gerät genug Reserve, geht es wieder hoch. Manuell: Hoch / Mittel / Niedrig.
- **Spatial-Hash-Grid** für Kollisionen und Schwarm-Abstoßung (statt O(n²)).
- **Object-Pooling** für Partikel und Texte (keine GC-Ruckler), Partikelbudget je Qualitätsstufe.
- Dauerschaden (Strahlen, Auren, Brand) wird zu gut lesbaren Schadenszahlen gebündelt statt jeden Frame Partikel zu erzeugen.
- **Fester Simulations-Takt (60 Hz)**: gleiches Spieltempo auf 60/90/120-Hz-Displays.
- Pausiert/Menü: Es wird nicht mehr gerendert (spart Akku). Im Hintergrund pausiert das Spiel automatisch und der Ton wird angehalten.
- HUD aktualisiert das DOM nur bei Änderungen. Auf Touch-Geräten gibt es keinen teuren `backdrop-filter`.
- Schriften sind **lokal eingebunden** und funktionieren offline in der APK.
- Musik wird auf der Audio-Uhr geplant: Der Takt bleibt stabil, auch wenn der Haupt-Thread kurz hängt.
- Safe-Area-Unterstützung (Notch, Gestenleiste), große Touch-Knöpfe, Eingabesperre beim Öffnen des Gaben-Dialogs (kein versehentliches Antippen).

Messung im Test (120 Gegner, Handy-Querformat, Auto-Qualität): von 4 Blur-Zeichnungen + 7 Gradienten pro Frame auf **0 + 0**, von 1533 auf **~990 Zeichenaufrufe** pro Frame und **−44 % gerenderte Pixel**. Optional zeigt die Einstellung „FPS anzeigen“ FPS, Qualitätsstufe, Gegner- und Partikelzahl.

---

## Entwicklung

Voraussetzung: [Node.js](https://nodejs.org/) 18+.

```bash
npm install          # Abhängigkeiten installieren
npm run dev          # Dev-Server auf http://localhost:5173 (auch im LAN erreichbar → am Handy testen)
npm run typecheck    # TypeScript prüfen
npm run build        # Typecheck + Produktions-Build nach dist/
npm run preview      # Build lokal ansehen
npm run balance      # Balancing-Kurven als Tabelle ausgeben
```

Der Dev-Server lauscht im Netzwerk (`host: true`). Öffne die angezeigte `Network`-Adresse am Smartphone im selben WLAN, um direkt auf dem Gerät zu testen.

---

## Android-APK bauen

Voraussetzungen: Android Studio bzw. Android SDK und JDK 17+.

```bat
cd android-apk
npm install
build-apk.bat
```

Das Skript baut die Web-App, synchronisiert sie per Capacitor ins Android-Projekt und kompiliert eine Debug-APK nach `android-apk/Aether-Eclipse-Landscape.apk`.
Die App läuft im Vollbild-Querformat, hält den Bildschirm wach, nutzt Vibration und leitet die Zurück-Taste an das Spiel weiter (Pause / Menü schließen).

---

## Projektstruktur

```
src/
├── main.ts                 Einstieg
├── fonts.ts                Lokale Schriften (offline)
├── style.css               Komplettes UI-Styling
├── engine/
│   ├── Game.ts             Spielschleife, Spawns, Kollisionen, Bosse, Belohnungen
│   ├── Balance.ts          Alle Schwierigkeits-Formeln
│   ├── Renderer.ts         Canvas-Rendering, Kamera, Qualitätsstufen
│   ├── GlowCache.ts        Vorgerenderte Leucht-Sprites
│   ├── SpatialGrid.ts      Räumliches Gitter für Kollisionen
│   ├── Particle.ts         Partikel, Schockwellen, Schadenszahlen (gepoolt)
│   ├── Input.ts            Tastatur, Maus, Touch-Joystick
│   └── Sound.ts            Prozeduraler Synthwave-Soundtrack & SFX (Web Audio)
├── entities/               Player, Enemy (13 Typen), Boss (endlose Kette), Drop
├── weapons/                Waffen-Basisklasse & 8 Waffen
├── upgrades/UpgradePool.ts Passive Upgrades & Gaben-Auswahl
├── meta/
│   ├── Forge.ts            Schmiede, Klassen, Skins, Spielstand
│   └── Settings.ts         Einstellungen & Vibration
└── ui/                     HUD, Gaben-Dialog, Schmiede, Pause/Einstellungen
scripts/balance-table.mjs   Balancing-Tabelle
android-apk/                Capacitor-Android-Projekt
```

---

## Änderungen in Version 2.0

**Gameplay**
- Endlose Boss-Kette mit 6 Boss-Archetypen, 8 Fähigkeiten, je 2,5× mehr HP pro Boss
- Supernova wird durch Kills geladen (statt 1× alle 10 Minuten), kein Sofort-Tod mehr durch die Licht-Opferung
- Neues Drop-System: kleine & große Licht-/Splitter-Kristalle ohne Glühen, Bosse droppen viele große
- Neues Balancing: polynomielle Skalierung statt exponentieller Wand, sinkende Licht-Drops, faire Hitbox, längere Unverwundbarkeit nach Treffern
- 4 neue Start-Upgrades in der Schmiede, gewichtete Gaben-Auswahl, endlose Bonus-Gaben
- Sparks sind jetzt rotierende Sterne statt Kugeln mit Schweif. Needles und Flare haben eigene Formen

**Fehlerbehebungen**
- Boss, der durch Sonnenfelder stirbt, blieb ohne Belohnung als „Leiche“ stehen
- Knockback/Wucht wurde von der Gegner-KI sofort überschrieben
- Dash/Nova-Eingaben aus Menüs wurden gepuffert, Leertaste löste Dash *und* Neustart aus
- Mehrere Level-Ups auf einmal gingen verloren → jetzt Warteschlange
- Leerer Gaben-Dialog (Soft-Lock), wenn alles ausgebaut war
- Boss-Leiste verdeckte Lichtleiste und Pause-Knopf auf dem Handy
- Gegner konnten mehrfach sterben (doppelte Belohnungen/Explosionen)
- Kein Auto-Pause im Hintergrund, Musik lief weiter
- Falsche Angaben in der Anleitung

**UI / Mobile**
- Pause-Menü mit Build-Übersicht, Einstellungen (Lautstärken, Qualität, Joystick, Linkshänder, Vibration, Bildschirmwackeln, Schadenszahlen, FPS)
- Tutorial-Hinweise beim ersten Spiel
- Durchgehend deutsche Texte, erweiterte Game-Over-Statistik (Level, Bosse, Rekord)
- Boss-Pfeil am Bildschirmrand, wenn der Boss nicht sichtbar ist
