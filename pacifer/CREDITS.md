# Credits and licences for the artwork in `pacifer/assets`

## What the game actually draws (`assets/pixelboy/`)

Everything on screen comes from the **Superpowers asset packs by Pixel-boy**
(Sébastien Bénard) and AAA:

- Source: https://github.com/sparklinlabs/superpowers-asset-packs
- Licence: **CC0 1.0 Universal** (public domain). The full text is in
  `assets/pixelboy/LICENSE.txt`. Credit is not required; it is given here because
  the work deserves it.

| file | what it is |
|---|---|
| `medieval.png` | the medieval pack tileset: grass, paving, water, plank floors, bare earth, the road kit, the three wall kits, the castle pieces, trees, props |
| `nature.png` | the ninja-adventure pack tileset: the bridge, the fence kit, the interior room kits and their furniture |
| `characters/*.png` | the 16×16 townsfolk used for the player and every NPC |
| `faceset/*.png` | the portraits shown beside the dialogue |
| `hud/*.png` | the dialogue bubble, the portrait frame, the continue arrow |

`characters/monk.png` is **modified**: `tools/make_monk.py` recolours one of the
stock townsfolk into a monk's habit and opens a face inside the cowl. The
untouched original is kept beside it in `characters/original/`. CC0 permits this
without condition.

Nothing in the tilesets is cut into separate image files. Each object is a
rectangle of one of the two sheets, named in `data/objects.js`, which
`tools/build_objects.py` generates.

## Left over from an earlier version, and no longer drawn

These are still in the tree but nothing loads them. They are kept only so the
earlier commits still run; if you want the repository smaller, they are the first
thing to delete.

- `assets/lpc-revised/` — LPC Revised, https://github.com/ElizaWy/LPC.
  Licence **OGA-BY 3.0**; compiled by Eliza Wyatt (DeathsDarling), with art by
  Eliza Wyatt, Lanea Zimmerman (Sharm), Stephen Challener (Redshrike),
  Johannes Sjölund (Wulax), BlueCarrot16, BenCreating, Durrani, YuriNikolai,
  Hyptosis and Craftpix.net. Per-file detail is in the `Credits.txt` files
  beside each sheet.
- `assets/ulpc/` — Universal LPC Spritesheet Character Generator,
  https://github.com/LiberatedPixelCup/Universal-LPC-Spritesheet-Character-Generator.
  **Mixed licences** (OGA-BY 3.0, CC-BY-SA 3.0, GPL 3.0, GPL 2.0, CC0); the exact
  list for the pieces that were used is in `assets/ulpc/CREDITS.csv`.
  *Careful:* some pieces are CC-BY-SA or GPL only, which would oblige a
  derivative work to carry the same licence. Nothing in the current game uses
  them.
- `assets/ninja-adventure/`, `assets/objects/`, `assets/characters/` — earlier
  exports, all from the CC0 Pixel-boy packs above.

**As it stands, every asset the game loads is CC0**, so Pacifer can be released
commercially, on Android or anywhere else, with no licence obligation at all.
