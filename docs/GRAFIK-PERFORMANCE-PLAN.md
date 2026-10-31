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

## Phase 0 – Messen (½ Tag)

- [ ] **Perf-Overlay** erweitern (aktuell nur FPS): Simulation (ms), Canvas2D-Rendern (ms), PostFX (ms), Anzahl von Gegnern, Projektilen, Partikeln und Lichtern.
  GPU-Zeit über `EXT_disjoint_timer_query_webgl2`, falls verfügbar.
- [ ] **Benchmark-Modus** per URL-Parameter (`?bench=1`): fester Seed, 5 Minuten Spielzeit simuliert, 300 Gegner, Boss aktiv.
  Ergebnis: durchschnittliche und 1-%-Low-Frametime. So lässt sich jede Änderung vergleichen.
- [ ] Messung auf einem **Mittelklasse-Android** (z. B. Snapdragon 6xx / Helio G) per Chrome Remote Debugging (`chrome://inspect`), Performance-Tab.

## Phase 1 – Quick Wins: größter Effekt, geringes Risiko (1–2 Tage)

| # | Maßnahme | Wo | Erwarteter Effekt |
|---|---|---|---|
| 1 | **Szenen-Auflösung von der Anzeige trennen**: `sceneCanvas` mit eigenem `renderScale` (Handy 1.0–1.25 statt bis 2.0). Overlay-Text bleibt in nativer DPR und damit scharf. Der Composite-Shader skaliert ohnehin. | `Renderer.resize`, `QUALITY` | ~40–60 % weniger Pixel für Canvas2D, Upload und Bloom |
| 2 | **Dynamische Auflösung statt 3 harter Stufen**: `renderScale` stufenlos 0.6–1.0 anhand der Frametime regeln. Heute löst jede Stufe `resize()` aus (Sterne, Vignette und Render-Targets werden neu gebaut) und verursacht einen Ruckler. | `reportFrameTime` | Gleichmäßige FPS, keine Qualitätssprünge |
| 3 | **FPS-Limit-Einstellung** (30 / 60 / unbegrenzt), Standard auf dem Handy 60. Die Schwellen der Auto-Qualität (21 ms / 12,5 ms) sind auf 60 Hz ausgelegt. | `Game.loop`, `Settings` | Halbe GPU-Last auf 120-Hz-Geräten, weniger Hitze |
| 4 | **Licht-Budget pro Qualitätsstufe** (150 / 300 / 600 statt 900), kleine und schwache Lichter zuerst verwerfen, `lightScale` auf high von 0.5 auf 0.35 | `collectLights`, `QUALITY` | Weniger Overdraw in Massenkämpfen |
| 5 | **Allokationen im Hot Path entfernen**: `enemyProjectiles.filter()` pro Frame (`Game.ts`), Font-String pro Text (`Particle.ts`), `lit ? [] : this.stars` (neues Array pro Frame), `bind`-Closure und Map-Lookups für Uniforms in `PostFX.render` | diverse | Weniger GC-Hänger (Mikroruckler) |
| 6 | **HUD-Balken per `transform: scaleX()`** statt `style.width` | `HUD.ts` | Keine Layout-Berechnung pro Frame |

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

Phase 0 → Phase 1 (#1, #3, #2) → messen → Phase 2 #7 → Phase 3 nach Lust und Laune → Phase 2 #10 nur bei Bedarf.
