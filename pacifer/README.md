# Pacifer

An open-world pixel-art game. A monk becomes the King's advisor and has to settle
the realm's quarrels — hunger, taxes, a rotting bridge — knowing that every ruling
costs something. The target platform is Android (HTML5 Canvas wrapped with
Capacitor), but it runs in any browser today.

## Running it locally

**Double-click `pacifer/index.html`.** That is all. Every piece of game data is a
`.js` file rather than `.json`, precisely so the game runs off the disk with no
server.

If your browser refuses local files, or you want to open the game from a phone on
the same Wi-Fi, start a local server:

- Windows: double-click `pacifer/start.bat`
- Linux / macOS: `./pacifer/start.sh` (first time: `chmod +x pacifer/start.sh`)
- or by hand, from the project root: `python3 -m http.server 8123`,
  then open `http://localhost:8123/pacifer/`

The same files are served from GitHub Pages at `/pacifer/`.

## Controls

- **Desktop**: arrows or WASD to walk, `E` / `Enter` / `Space` to act (talk, enter
  a door), up/down to pick an answer, `M` for the minimap, `C` for collision boxes.
- **Touch (Android)**: touch and drag anywhere on the left of the screen for the
  joystick, the `E` button to act, `M` and `C` in the top-right corner, tap the
  dialogue box to continue, tap an answer to choose it.

Doors open when you step onto the threshold; a label at the bottom of the screen
tells you where one leads.

## What is in the world

The realm of **Aurelia**, 100 × 76 tiles, running north to south:

- the **royal castle** on its paved height: keep with two towers, a crenellated
  curtain wall, a gatehouse over the great road, gardens either side of the
  processional way
- the **capital**: a market square with stalls and fountains, houses along the
  streets, lamps down the main road
- **farmland**, a mill pond, a hamlet, the river with two crossings
- the **king's wood** to the west and the forest to the east

Inside: the **throne hall** (the King, his steward, the guard), the
**merchant's house**, the **steward's town house**.

The story runs through three stats — treasury, order, food. The Marshal sends you
out to see the realm before you advise anyone; the farms tell you about the hail,
the mill about the bridge, the market about the merchant's full barns. What you
have actually seen changes what you can say to the King, and his ruling moves the
three numbers.

## Project layout

```
pacifer/
  index.html          the game page
  game.js             the engine (maps, collision, characters, camera, dialogue, controls)
  data/
    world.js          THE MAPS: terrain, objects, characters, doorways      <- edit this
    dialogs.js        WHAT PEOPLE SAY                                       <- edit this
    objects.js        object sprites + collision boxes                      <- generated
  assets/             the artwork (see CREDITS.md)
  tools/
    export_objects.py cuts assets/objects/ + data/objects.js + character sheets
    castle.py         builds the castle pieces: walls, towers, gatehouse, keep
    build_scene.py    the very first static test render, kept for reference
  start.sh, start.bat optional local server
```

The engine holds no map and no line of dialogue: it all comes from `data/`. You
can change the world without touching `game.js`.

## Adding things

**A new room** — in `data/world.js`, under `maps`:

```js
barn: {
  name: 'The tithe barn',
  kind: 'indoor',
  w: 12, h: 11,
  room: [2, 3, 8, 5],          // the floor; walls are built around it
  floor: 'wood', wall: 'brick',
  extraFloor: [[5, 8, 1, 2]],  // the doorway, cut through the bottom wall
  objects: [['barrel', 3, 4], ['crate', 8, 4]],
  npcs: [{ id: 'reeve', sheet: 'villager', name: 'The Reeve', x: 6, y: 5, dir: 2 }],
  portals: [{ rect: [5, 9, 1, 1], to: 'realm', spawn: [40, 60], dir: 2, label: 'Out' }],
},
```

and a way in, on the `realm` map:
`{ rect: [40, 59, 1, 1], to: 'barn', spawn: [5.5, 7], dir: 0, label: 'The tithe barn' }`.

Coordinates are in tiles (1 tile = 32 px) and may be fractional. `dir` is
0 up, 1 left, 2 down, 3 right.

**A forest** is one line, not a hundred placements:

```js
groves: [
  { types: ['tree1', 'tree4', 'pine2'], rect: [10, 60, 20, 12], count: 40, seed: 7 },
],
```

The scatter skips roads, water and anything already standing there, and the same
seed always gives the same wood.

**New ground** — outdoor maps paint rectangles in order:
`['stone', 38, 29, 47, 38]`. The types are `grass`, `dirt`, `sand`, `stone` and
`water`; grass blends itself into whatever it touches. Two kinds of ground meeting
each other directly get a hard edge, so keep a strip of grass between them.

**New lines** — in `data/dialogs.js`, a function keyed by the character's `id`.
A choice can move the stats and raise a story flag that other conversations read:

```js
reeve: g => g.flags.grainBought
  ? [{ who: 'The Reeve', text: 'The carts came through at dawn.' }]
  : [{ who: 'The Reeve', text: 'The barn is half empty and the tithe is due.' }],
```

**New objects** — cut them out of the sheets in `assets/lpc-revised/` inside
`tools/export_objects.py` (`save('name', image, [x, y, w, h])`, where the list is
the collision box relative to the sprite's top-left corner), then run
`python3 pacifer/tools/export_objects.py`. The script rewrites `data/objects.js`
too. An object with `flat=True` is scenery at floor level (rug, torch, shelf) and
is drawn under the characters; `anim={...}` gives it animation frames; `cols=[...]`
gives it several collision boxes, which is how the gatehouse can be solid on both
sides and open in the middle.

## How the engine works

- **Several maps.** Each one is built once — its ground is pre-rendered into an
  offscreen canvas — and then kept, so walking in and out of a building is
  instant and the characters stay where you left them.
- **Outdoor ground** is a grid of grass / dirt / sand / stone / water. Grass picks
  its own edge tiles per quarter-tile from the terrain sheet, so coastlines and
  road shoulders draw themselves. Flowers and grass tufts are scattered on open
  grass so large fields are not flat.
- **Indoor rooms**: you give the floor rectangle, the engine raises the walls
  around it and picks the cap, middle or base of each wall from its neighbours.
  The marble floor is laid as a chequerboard, floorboards are picked at random.
- **Objects** each carry their own collision box (or several). The bridge carries
  a `walkable` zone, which is how you can cross water.
- **Characters** use full LPC sheets (4 directions × 9 frames) with a 24×16 feet
  box, moving one axis at a time so they slide along obstacles. Objects and
  characters are sorted by their bottom edge, so you pass correctly in front of
  and behind them.
- **Doorways** are rectangles on the map; stepping on one fades the screen, swaps
  the map and drops you at the far side.
- **Dialogue** comes from `data/dialogs.js`; choices move treasury, order and food
  and raise flags in `game.flags`, which change what people say next time.

`C` draws the collision boxes (red), doorways (yellow), walkable zones (green) and
solid tiles (blue). `M` shows the minimap.

## Assets

- `assets/lpc-revised/` — terrain, trees, houses, stone walls, doors, windows,
  fences, fountain, indoor furniture, torches, paving. Source:
  [ElizaWy/LPC](https://github.com/ElizaWy/LPC). Licence OGA-BY 3.0 (credit required).
- `assets/ulpc/` — the character parts (body, head, clothes, crown, cape, beard,
  helmet) from the
  [Universal LPC Spritesheet Character Generator](https://github.com/LiberatedPixelCup/Universal-LPC-Spritesheet-Character-Generator).
  Mixed licences per piece, see `CREDITS.md`.
- `assets/ninja-adventure/` — the dialogue box, portrait frame, arrow and 8×8 font
  from [Ninja Adventure](https://github.com/sparklinlabs/superpowers-asset-packs)
  by Pixel-boy. Licence CC0.
- `assets/objects/`, `assets/characters/` — generated by `tools/export_objects.py`.

The castle is not a stock sprite: `tools/castle.py` composes the curtain walls,
the crenellations, the towers, the gatehouse and the keep tile by tile out of the
LPC stone, door, window and pillar sheets.

Character layer order: shadow → cape (back) → body → legs → feet → torso →
jacket/tabard → belt → cape (front) → head → beard → hair → hat/crown/helmet.
Pieces with no colour variant are recoloured by mapping luminance onto a
two-colour ramp (the `tint` function).

## Next steps

1. Saving in the browser (position, stats, flags) and a title screen.
2. A visible quest log instead of hidden flags.
3. More provinces beyond the capital, each with its own stats.
4. Sound: footsteps, doors, fire, a quiet theme.
5. Android packaging with Capacitor (fullscreen, orientation, icon).
