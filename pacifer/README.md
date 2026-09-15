# Pacifer

Joc pixel art open-world în care un călugăr devine consilierul împăratului și rezolvă
conflictele economice și sociale ale imperiului. Ținta finală este Android
(HTML5 Canvas împachetat cu Capacitor), dar deocamdată rulează în orice browser.

## Cum îl pornești local, pe desktop

**Dublu-clic pe `pacifer/index.html`.** Atât. Toate datele jocului sunt fișiere `.js`
(nu `.json`), tocmai ca jocul să meargă deschis direct de pe disc, fără server.

Dacă browserul tău refuză fișierele locale, sau dacă vrei să deschizi jocul și de pe
telefon din aceeași rețea Wi-Fi, pornește un server local:

- Windows: dublu-clic pe `pacifer/start.bat`
- Linux / macOS: `./pacifer/start.sh` (prima dată: `chmod +x pacifer/start.sh`)
- sau, manual, din rădăcina proiectului: `python3 -m http.server 8123`
  și deschizi `http://localhost:8123/pacifer/`

Online, aceleași fișiere merg pe GitHub Pages la `/pacifer/`.

## Controale

- **Desktop**: săgeți sau WASD pentru mers, `E` / `Enter` / `Space` pentru acțiune
  (vorbește, intră pe ușă), săgeți sus/jos pentru alegerea răspunsului,
  `C` pentru cutiile de coliziune.
- **Touch (Android)**: atinge și trage oriunde în stânga ecranului pentru joystick,
  butonul `E` pentru acțiune, butonul `C` pentru coliziuni, atingere pe caseta de
  dialog pentru a continua, atingere pe un răspuns pentru a-l alege.

Ușile se deschid singure când calci pe prag; eticheta din josul ecranului îți spune unde duc.

## Structura proiectului

```
pacifer/
  index.html          pagina jocului
  game.js             motorul (hărți, coliziuni, personaje, cameră, dialog, controale)
  data/
    world.js          HĂRȚILE: teren, obiecte, personaje, treceri prin uși   <- se editează
    dialogs.js        REPLICILE personajelor                                 <- se editează
    objects.js        sprite-urile obiectelor + cutiile de coliziune         <- generat
  assets/             imaginile (vezi CREDITS.md)
  tools/
    export_objects.py generează assets/objects/ + data/objects.js + foile de personaje
    build_scene.py    generatorul primei imagini de test (păstrat ca referință)
  start.sh, start.bat pornire cu server local (opțional)
```

Motorul nu conține nicio hartă și nicio replică: totul vine din `data/`. Ca să schimbi
lumea nu trebuie să te atingi de `game.js`.

## Cum adaugi lucruri în joc

**O cameră nouă** — în `data/world.js`, la `maps`:

```js
hambar: {
  name: 'Hambarul satului',
  kind: 'interior',
  w: 12, h: 11,
  room: [2, 3, 8, 5],          // podeaua; pereții se generează automat în jur
  floor: 'wood', wall: 'brick',
  extraFloor: [[5, 8, 1, 2]],  // pragul ușii, tăiat prin peretele de jos
  objects: [['barrel', 3, 4], ['crate', 8, 4]],
  npcs: [{ id: 'morarul', sheet: 'villager', name: 'Morarul', x: 6, y: 5, dir: 2 }],
  portals: [{ rect: [5, 9, 1, 1], to: 'sat', spawn: [12, 18], dir: 2, label: 'Afară' }],
},
```

și o trecere înspre ea, pe harta `sat`:
`{ rect: [12, 17, 1, 1], to: 'hambar', spawn: [5.5, 7], dir: 0, label: 'Hambarul' }`.

Coordonatele sunt în tile-uri (1 tile = 32 px) și pot fi fracționare. `dir`: 0 sus,
1 stânga, 2 jos, 3 dreapta. Hărțile `kind: 'exterior'` folosesc în schimb `terrain`,
o listă de dreptunghiuri `['water', x0, y0, x1, y1]`, iar marginile dintre iarbă,
pământ și apă se autotilează singure.

**Replici noi** — în `data/dialogs.js`, o funcție cu `id`-ul personajului. O alegere
poate modifica indicatorii și poate ridica un steag de poveste pe care alte dialoguri
îl citesc:

```js
morarul: g => g.flags.graneCumparate
  ? [{ who: 'Morarul', text: 'Am primit grâul, părinte. Macin de dimineață.' }]
  : [{ who: 'Morarul', text: 'Pietrele stau degeaba. Nu e ce macina.' }],
```

**Obiecte noi** — se decupează din foile din `assets/lpc-revised/` în
`tools/export_objects.py` (`save('nume', imagine, [x, y, lățime, înălțime])`, unde
lista e cutia de coliziune, relativă la colțul stânga-sus al sprite-ului), apoi
`python3 pacifer/tools/export_objects.py`. Scriptul rescrie și `data/objects.js`.
Un obiect cu `flat=True` e decor la nivelul podelei (covor, torță, raft) și se
desenează sub personaje; `anim={...}` îi dă cadre de animație.

## Cum e construit motorul (`game.js`)

- **Hărți multiple.** Fiecare hartă se construiește o singură dată (teren pre-randat
  într-un canvas ascuns) și rămâne în memorie, deci intrarea și ieșirea dintr-o
  cameră sunt instantanee. Personajele își păstrează pozițiile.
- **Exterior**: grilă de iarbă / pământ / apă; marginile se aleg automat, pe sferturi
  de tile, din setul de autotile al foii `terrain_spring.png`.
- **Interior**: dai dreptunghiul podelei, motorul ridică pereții în jur și alege singur
  capătul de sus, mijlocul și baza peretelui după vecini. Podeaua de marmură e o tablă
  de șah, scândurile de lemn se aleg la întâmplare.
- **Obiecte**: fiecare obiect e un sprite separat cu **cutia lui de coliziune** din
  `data/objects.js`. Podul are o zonă `walkable` (apă pe care se poate merge).
- **Personaje**: foi LPC complete (4 direcții × 9 cadre), cutie de coliziune la picioare
  (24×16 px), mișcare separată pe axe pentru alunecare pe lângă obstacole. Personajele
  și obiectele se desenează sortate după marginea de jos, deci jucătorul trece corect
  prin fața și prin spatele lor.
- **Treceri**: dreptunghiuri pe hartă; când calci pe unul, ecranul se stinge, se schimbă
  harta și te trezești în locul indicat de `spawn`.
- **Dialog**: replicile vin din `data/dialogs.js`; alegerile modifică indicatorii
  (trezorerie, stabilitate, hrană) din colțul stânga-sus și ridică steaguri de poveste
  în `game.flags`, care schimbă ce spun personajele data viitoare.

Pentru depanare, `C` desenează cutiile de coliziune (roșu), trecerile (galben),
zonele pe care se poate merge (verde) și tile-urile solide (albastru).

## Ce e în joc acum

Satul **Valea de Jos** cu palatul, două case, fântână, râu cu pod. Înăuntru:
**sala tronului** (împăratul, garda), **casa negustorului** (grâne de cumpărat),
**casa bătrânului** (podul care putrezește). Firul de poveste: afli de foamete de la
sătean, cumperi grâne de la negustor, hotărăști cu împăratul ce se face cu darea —
fiecare alegere mută trezoreria, stabilitatea și hrana.

## Asset-uri

- `assets/lpc-revised/` – teren, copaci, case, ziduri, uși, ferestre, garduri, fântână,
  mobilier de interior, torțe. Sursa: [ElizaWy/LPC](https://github.com/ElizaWy/LPC).
  Licență OGA-BY 3.0 (credit obligatoriu).
- `assets/ulpc/` – piesele de personaj (corp, cap, haine, coroană, pelerină, barbă, coif)
  din [Universal LPC Spritesheet Character Generator](https://github.com/LiberatedPixelCup/Universal-LPC-Spritesheet-Character-Generator).
  Licențe mixte per piesă, vezi `CREDITS.md`.
- `assets/ninja-adventure/` – caseta de dialog, rama de portret, săgeata și fontul 8×8 din
  [Ninja Adventure](https://github.com/sparklinlabs/superpowers-asset-packs) de Pixel-boy. Licență CC0.
- `assets/objects/`, `assets/characters/` – generate de `tools/export_objects.py`.

Ordinea straturilor la personaje: umbră → pelerină (spate) → corp → picioare →
încălțăminte → tors → jachetă/tabard → brâu → pelerină (față) → cap → barbă → păr →
pălărie/coroană/coif. Piesele fără variante de culoare sunt recolorate prin maparea
luminanței pe o rampă de două culori (funcția `tint`).

## Pași următori propuși

1. Salvare în browser (poziție, indicatori, steaguri) și meniu de start.
2. Sistem de quest-uri cu obiective vizibile, nu doar steaguri ascunse.
3. Mai multe regiuni ale imperiului și drumuri între ele; provincii cu indicatori proprii.
4. Sunet: pași, ușă, foc, o temă discretă.
5. Împachetare Android cu Capacitor (ecran complet, orientare, icoană).
