# Pacifer — test de grafică (pixel art)

Prototip vizual pentru **Pacifer**, un joc open-world pixel art în care un călugăr devine
consilierul împăratului și rezolvă conflictele economice și sociale ale imperiului.
Ținta finală este Android (HTML5 Canvas împachetat cu Capacitor).

Acest folder conține **doar** asset-urile gratuite selectate și un generator de scenă de test.
Nu există încă logică de joc.

## Structură

- `assets/lpc-revised/` – teren, copaci, case, ziduri, uși, ferestre, garduri, fântână, obiecte.
  Sursa: [ElizaWy/LPC](https://github.com/ElizaWy/LPC). Licență OGA-BY 3.0 (credit obligatoriu).
- `assets/ulpc/` – piesele de personaj (corp, cap, haine, coroană, pelerină, barbă, coif) din
  [Universal LPC Spritesheet Character Generator](https://github.com/LiberatedPixelCup/Universal-LPC-Spritesheet-Character-Generator).
  Fiecare foaie are 4 rânduri (sus, stânga, jos, dreapta) × 9 cadre de 64×64 px pentru mers.
  Licențe mixte per piesă, vezi `CREDITS.md`.
- `assets/ninja-adventure/` – caseta de dialog, rama de portret, săgeata și fontul 8×8 din
  [Ninja Adventure](https://github.com/sparklinlabs/superpowers-asset-packs) de Pixel-boy. Licență CC0.
- `tools/build_scene.py` – compune scena de test din asset-uri (autotile iarbă/pământ/apă,
  clădiri, personaje stratificate, dialog). Rulare: `pip install pillow && python3 tools/build_scene.py`.
- `preview/scene.png`, `preview/characters.png` – rezultatul generatorului.
- `index.html` – pagină simplă care afișează previzualizarea.

## Personaje compuse (ordinea straturilor)

umbră → pelerină (spate) → corp → picioare → încălțăminte → tors → jachetă/tabard → brâu →
pelerină (față) → cap → barbă → păr → pălărie/coroană/coif

Piesele fără variante de culoare sunt recolorate în script prin maparea luminanței pe o rampă
de două culori (funcția `tint`).

## Pași următori propuși

1. Motor HTML5 Canvas: hartă din tile-uri, mers în 4 direcții, coliziuni, cameră.
2. Sistem de dialog cu alegeri și indicatori ai imperiului (trezorerie, stabilitate, hrană, loialitate).
3. Împachetare Android cu Capacitor.
