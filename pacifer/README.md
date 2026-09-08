# Pacifer — test de grafică (pixel art)

Prototip vizual pentru **Pacifer**, un joc open-world pixel art în care un călugăr devine
consilierul împăratului și rezolvă conflictele economice și sociale ale imperiului.
Ținta finală este Android (HTML5 Canvas împachetat cu Capacitor).

Acest folder conține asset-urile gratuite selectate și un **prototip jucabil** de motor:
hartă din tile-uri, strat de obiecte cu coliziuni, personaje animate, dialog cu alegeri,
controale touch. Se deschide direct în browser: `pacifer/index.html` (pe GitHub Pages sau local
cu `python3 -m http.server` din rădăcina repo-ului, fiindcă `fetch` nu merge de pe `file://`).

## Controale

- Desktop: săgeți sau WASD pentru mers, `E` / `Enter` / `Space` pentru acțiune (vorbește, ușă),
  săgeți sus/jos pentru alegerea răspunsului, `C` pentru cutiile de coliziune.
- Touch (Android): atinge și trage oriunde în stânga ecranului pentru joystick, butonul `E` pentru
  acțiune, butonul `C` pentru coliziuni, atingere pe caseta de dialog pentru a continua, atingere
  pe un răspuns pentru a-l alege.

## Cum e construit motorul (`game.js`)

- **Harta**: grilă de 40×30 tile-uri (iarbă / pământ / apă). Marginile dintre iarbă și pământ sau apă
  se aleg automat, pe sferturi de tile, din setul de autotile al foii `terrain_spring.png`.
  Harta se randează o singură dată într-un canvas ascuns.
- **Obiecte**: fiecare obiect (palat, casă, copac, fântână, felinar, butoi, gard, pod…) este un sprite
  separat din `assets/objects/` cu o **cutie de coliziune** proprie definită în `objects.json`
  (câmpul `col`, relativ la colțul stânga-sus al sprite-ului). Ușile au `door`, podul are `walkable`
  (zonă de apă pe care se poate merge). Obiectele se plasează în `OBJECT_PLACEMENTS` în coordonate de tile.
- **Personaje**: foi LPC complete (4 direcții × 9 cadre), cutie de coliziune la picioare (24×16 px),
  mișcare separată pe axe pentru alunecare pe lângă obstacole. Personajele și obiectele se desenează
  sortate după marginea de jos, deci jucătorul trece corect în spatele și în fața lor.
- **Camera** urmărește jucătorul și se oprește la marginile hărții. Scala se alege ca număr întreg
  în funcție de ecran, pentru pixeli curați.
- **Dialog**: liniile și alegerile sunt în `DIALOGS`; o alegere aplică efecte asupra indicatorilor
  (trezorerie, stabilitate, hrană) afișați în colțul din stânga-sus.

## Structură

- `assets/lpc-revised/` – teren, copaci, case, ziduri, uși, ferestre, garduri, fântână, obiecte.
  Sursa: [ElizaWy/LPC](https://github.com/ElizaWy/LPC). Licență OGA-BY 3.0 (credit obligatoriu).
- `assets/ulpc/` – piesele de personaj (corp, cap, haine, coroană, pelerină, barbă, coif) din
  [Universal LPC Spritesheet Character Generator](https://github.com/LiberatedPixelCup/Universal-LPC-Spritesheet-Character-Generator).
  Fiecare foaie are 4 rânduri (sus, stânga, jos, dreapta) × 9 cadre de 64×64 px pentru mers.
  Licențe mixte per piesă, vezi `CREDITS.md`.
- `assets/ninja-adventure/` – caseta de dialog, rama de portret, săgeata și fontul 8×8 din
  [Ninja Adventure](https://github.com/sparklinlabs/superpowers-asset-packs) de Pixel-boy. Licență CC0.
- `assets/objects/` – sprite-urile obiectelor de joc, câte unul per obiect, plus `objects.json`
  cu dimensiuni și cutii de coliziune. Generate de `tools/export_objects.py`.
- `assets/characters/` – foile de animație gata compuse pentru călugăr, împărat, gardian, sătean.
  Generate de același script.
- `index.html`, `game.js` – jocul.
- `tools/build_scene.py` – generatorul primei imagini de test (`preview/`), păstrat ca referință.

## Personaje compuse (ordinea straturilor)

umbră → pelerină (spate) → corp → picioare → încălțăminte → tors → jachetă/tabard → brâu →
pelerină (față) → cap → barbă → păr → pălărie/coroană/coif

Piesele fără variante de culoare sunt recolorate în script prin maparea luminanței pe o rampă
de două culori (funcția `tint`).

## Pași următori propuși

1. Editor de hartă sau format de hartă în JSON (Tiled), ca să nu mai plasăm obiectele din cod.
2. Interioare (palat, case) cu tranziții prin uși; mai multe regiuni ale imperiului.
3. Sistemul de quest-uri și indicatori pe provincii; salvare în browser.
4. Împachetare Android cu Capacitor (ecran complet, orientare, icoană).
