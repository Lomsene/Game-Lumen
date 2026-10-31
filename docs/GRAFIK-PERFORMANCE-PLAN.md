# AETHER: ECLIPSE – Plan: Grafik & Smartphone-Performance

Stand: 31.10.2026 · Branch `feature/v3-lights`

Grundlage ist eine Analyse des Codes (Render-Pipeline, Hot Paths), **keine Messung auf einem Gerät**.
Die Prioritäten ergeben sich aus der Pixel- und Aufrufmenge pro Frame. Phase 0 macht sie messbar,
bevor größere Umbauten beginnen.

## Wie ein Frame heute entsteht

```
Canvas2D-Szene (sceneCanvas, volle DPR bis 2.0)
  -> texImage2D: kompletter Upload in WebGL   <- jedes Frame, volle Auflösung
  -> Lichtkarte: bis zu 900 instanzierte Lichter (lightScale 0.5 auf "high")
  -> Bloom: Bright-Pass 1/4 + Blur, breiter Bloom 1/8 + 2x Blur
  -> Composite: Nebel + 2 Sternenebenen + Licht + Bloom + Tonemapping
Overlay-Canvas2D (Schadenszahlen, Pfeile) obendrauf
```

Die teuersten Posten auf dem Handy, geschätzt:

1. **Canvas2D-Rasterung der Szene in voller DPR.** Jeder Gegner wird per Pfad gezeichnet (`arc`, `stroke`, `save/restore`, `setLineDash`).
2. **Upload der Szene als Textur pro Frame** (`PostFX.render` → `texImage2D`). Bei 2400×1080-Displays sind das rund 1830×824 Pixel ×4 Byte pro Frame.
3. **Lichtkarten-Overdraw** bei vielen großen Lichtern.
4. **120-Hz-Displays.** Das Spiel rendert dort doppelt so viele Frames. Das kostet Akku und führt nach einigen Minuten zu thermischem Drosseln.

---

## Phase 0 – Messen ✅ erledigt

- [x] **Perf-Overlay** (Einstellungen → „FPS anzeigen“):
  `FPS + Frametime | Sim / Draw / FX (ms) | Qualität, Szenen-Skalierung @Szenen-DPR | Gegner, Partikel, Lichter`.
  Wird nur 4× pro Sekunde ins DOM geschrieben.
- [x] **Benchmark-Modus** `?bench=1` (`src/engine/Benchmark.ts`): Alle 4 Waffenslots sind maximiert,
  die Schwierigkeit entspricht Minute 5, ~140 Gegner werden laufend nachgefüllt, der Spieler ist unverwundbar,
  und es gibt keine Level-up-Unterbrechungen. Nach 3 s Aufwärmen werden 30 s gemessen.
  Das Ergebnis erscheint im Game-Over-Untertitel, in der Konsole (`[AETHER bench]`) und als `window.__AETHER_BENCH__`.
  **Ändert keine Spielstände, Rekorde oder Erfolge.**
- [ ] Offen: GPU-Zeit per `EXT_disjoint_timer_query_webgl2`. Ein fester Zufalls-Seed fehlt ebenfalls (die Gegneranzahl ist fix,
  deshalb sind die Läufe trotzdem gut vergleichbar).
- [ ] **Messung auf einem echten Mittelklasse-Android** steht noch aus. Ablauf: APK bauen, App mit `?bench=1` starten,
  bzw. im Browser `http://<PC-IP>:5173/?bench=1` öffnen und per `chrome://inspect` mitschauen.

## Phase 1 – Quick Wins ✅ erledigt

| # | Maßnahme | Status |
|---|---|---|
| 1 | **Szenen-Auflösung getrennt**: Die beleuchtete Szene rendert mit `sceneDprCap` (1.5 / 1.25 / 1.0), der Text-Overlay bleibt bei bis zu 2.0. Gemessen bei emulierter DPR 2.625 im Querformat: Szene 1373×618 statt 1830×824, also **−44 % Pixel** für Canvas2D, Upload, Licht und Bloom. | ✅ |
| 2 | **Dynamische Auflösung**: Bei „Auto“ sinkt zuerst die Szenen-Skalierung in Schritten von 10 % bis 60 %, erst danach die Effektstufe. Hochgestuft wird anhand der **CPU-Arbeitszeit**. Vorher konnte „Auto“ auf 60-Hz-Displays nie wieder hochstufen, weil die Frametime durch VSync nie unter 12,5 ms fällt. Ein Skalierungsschritt passt nur die Canvas-Größen an, ohne Sterne und Vignette neu zu bauen. | ✅ |
| 3 | **FPS-Limit** in den Einstellungen (60 / 30 / unbegrenzt), Standard auf Touch-Geräten 60. Das Pacing liefert auf 60/90/120 Hz gleichmäßig 60. | ✅ |
| 4 | **Licht-Budget** 600 / 300 / 150 und `lightScale` 0.4 / 0.33 / 0.25. Die Lichter werden **nach Priorität** gesammelt: Spieler → Boss → große Explosionen → Zonen → Waffen → Schüsse → Gegner → Drops → kleine Treffer-Blitze. | ✅ |
| 5 | Allokationen: Font-String-Cache für Schadenszahlen, kein Wegwerf-Array für Sterne pro Frame. *Korrektur zur Analyse:* Das `filter()` in `Game.ts` läuft nur beim Dash, nicht pro Frame. Die Uniform-Lookups in PostFX sind bereits gecacht und vernachlässigbar. | ✅ |
| 6 | **HUD-Balken per `transform: scaleX()`** statt `width` | ✅ |

## Phase 2 – Render-Architektur (3–6 Tage)

7. **Sprite-Cache für Gegner und Projektile.** Jede Kombination aus Gegnertyp × Farbe × Detailstufe wird einmal in ein Offscreen-Canvas bzw. eine `ImageBitmap` vorgerendert. Pro Frame bleibt nur `drawImage` mit Rotation. Auf Mobil-GPUs ist das typischerweise um ein Vielfaches schneller als Pfade mit Strokes. Treffer-Blitz als zweites, weißes Sprite.
8. **Schadenszahlen cachen**: Text-Bitmaps pro (Text, Farbe, Größe) mit LRU, dazu eine Obergrenze gleichzeitiger Texte und Zusammenfassung bei Massentreffern („+1.2k“ statt 30 Einzelzahlen).
9. **Partikel nach WebGL** (instanziert wie die Lichter). Partikel fallen damit aus Canvas2D und Upload heraus, Tausende Funken werden praktisch kostenlos. Leuchtende Partikel speisen direkt die Lichtkarte.
10. **Langfristig: WebGL-Sprite-Batcher** mit Texturatlas für die ganze Szene. Damit entfällt der `texImage2D`-Upload komplett, und es bleibt ein Draw-Call pro Ebene. **Größter Gewinn, größter Aufwand.** Erst angehen, wenn Phase 0 zeigt, dass Canvas2D plus Upload nach Phase 1 und 7 noch dominiert.

## Phase 3 – Grafik-Verbesserungen (parallel möglich, je ½–1 Tag)

- **Schockwellen-Verzerrung** im Composite-Shader (UV-Versatz in einem Ring) für Supernova, Dash und Boss-Tod. Sehr wirkungsvoll und billig, da nur ein Uniform-Array.
- **Trauma-basiertes Screen-Shake** mit glattem Rauschen statt `Math.random()` pro Frame. Letzteres wirkt auf 120 Hz zittrig statt wuchtig.
- **„Licht ist Sicht“ visuell stärker**: Gegner außerhalb des Lichtradius als dunkle Silhouetten mit Randlicht. Das passt zum Kernthema und braucht nur den bestehenden Lichtkarten-Wert.
- **Farbgrading pro Phase und Boss** (Tint- oder LUT-Uniform), damit Bossfights eine eigene Stimmung bekommen.
- **Dithering im Composite** (±0,5/255 Hash-Rauschen) gegen Farbstufen-Banding in dunklen Nebelverläufen, besonders sichtbar auf OLED.
- **Auflösungs-Effekte für Gegner-Tod** (Zerfall in Funken, die die Lichtkarte kurz aufhellen).
- Nebel langsam animieren (zweite Ebene mit eigener Drift).

## Phase 4 – Android-spezifisch

- Capacitor-WebView: Hardwarebeschleunigung prüfen, Overscroll und Text-Zoom deaktivieren.
- `visibilitychange`/App-Pause: Loop und Audio vollständig stoppen (Akku).
- Release-Build mit `minifyEnabled`. Die Web-Assets sind schon gebündelt; prüfen, dass `dist` ohne Sourcemaps ins APK kommt.

---

## In dieser Runde bereits erledigt

- **Naht im Nebel-Hintergrund behoben**: Die Textur lief mit `MIRRORED_REPEAT`, wodurch an jeder Spiegelkante eine gerade Falte sichtbar war. Das Rauschen ist jetzt periodisch und kachelt nahtlos mit `REPEAT`.
- **Menü-Orb**: Pulsieren nur noch per `transform` statt `box-shadow`. Kein Repaint pro Frame mehr, und das Leuchten in Skin-Farbe wird nicht mehr überschrieben.
- **Button-Transitions** nur noch auf günstige Properties statt `transition: all`.

## Empfohlene Reihenfolge

~~Phase 0 → Phase 1~~ → **auf dem Handy messen** → Phase 2 #7 → Phase 3 nach Lust und Laune → Phase 2 #10 nur bei Bedarf.
