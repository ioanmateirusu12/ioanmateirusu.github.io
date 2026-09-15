/* Pacifer - game engine (HTML5 Canvas)
 *
 * The content lives in data/, not in here:
 *   data/objects.js  - what can stand in the world, and where its sprite is
 *   data/world.js    - the maps: ground, objects, characters, doorways
 *   data/dialogs.js  - what the characters say
 * They are .js files rather than .json so the game also runs when index.html is
 * opened straight off the disk, with no local server.
 *
 * The art is 16-pixel tiles drawn at an integer zoom of 3 or more. That is what
 * makes the pixels read as pixels, and it is also why so much of the world fits
 * on screen at once: the camera sits far back, and a person is one tile tall.
 */
'use strict';

const T = 16;                      // one tile, in world pixels
const ASSETS = 'assets/pixelboy/';
const WORLD = window.PACIFER_WORLD;
const OBJECTS = window.PACIFER_OBJECTS;
const SCRIPT = window.PACIFER_DIALOGS;

/* Ground. Grass is the base everything sits on. Every other kind of ground is an
 * outlined block of nine tiles: the engine picks corner, edge or middle from what
 * the neighbours are, so a lake or a courtyard draws its own outline. Roads are
 * different - they are one tile wide and pick their piece from which way the road
 * continues, so junctions and corners come out right. */
const GROUND = {
  // `alt` are stand-ins for the middle tile, sprinkled at `altRate`, so a large
  // field of one ground does not read as a slab of flat colour. The tileset keeps
  // them in the column just right of each block.
  grass: { id: 0, sheet: 'medieval', block: [0, 0], alt: [[3, 0], [3, 1]], altRate: 0.14 },
  water: { id: 1, sheet: 'medieval', block: [16, 0], solid: true },
  stone: { id: 2, sheet: 'medieval', block: [12, 0] },
  wood:  { id: 3, sheet: 'medieval', block: [4, 0], alt: [[7, 0], [7, 1]], altRate: 0.18 },
  earth: { id: 4, sheet: 'medieval', block: [8, 0], alt: [[11, 1], [11, 2]], altRate: 0.16 },
  // Walls are ground too. Paint a rectangle of one and it works out its own
  // corners, crenellations and foundation course; paint a rectangle one tile
  // high and the same nine tiles give you a fence with two finished ends.
  // `hollow` walls are drawn as a frame with a see-through middle and rounded
  // corners, so the ground the wall stands on has to be laid under them first,
  // or the base grass shows through and the wall gets a green halo.
  rampart:  { id: 5, sheet: 'medieval', block: [0, 8], solid: true, hollow: true },
  keepwall: { id: 6, sheet: 'medieval', block: [5, 8], solid: true, hollow: true },
  palisade: { id: 7, sheet: 'medieval', block: [10, 8], solid: true, hollow: true },
  // the plank crossing. Its nine tiles carry their own rails and their own
  // finished ends, which is why the bridge is ground and not two rows of posts.
  bridge:   { id: 8, sheet: 'nature', block: [16, 3] },
};
const BY_ID = [];
for (const name in GROUND) { GROUND[name].name = name; BY_ID[GROUND[name].id] = GROUND[name]; }
const GRASS = GROUND.grass.id, WATER = GROUND.water.id;

/* Roads are not a kind of ground. They are a thin layer drawn over whatever the
 * ground is, because a lane has to be able to cross the market square without
 * cutting the paving in two - which is exactly what happens if the road owns the
 * tile. Each road tile picks its piece from the sides the road continues towards,
 * so corners, tees and crossroads come out right on their own.
 * The kit sits at [0,3] of the medieval sheet; these offsets were read off it. */
const ROAD_KIT = [0, 3];
const ROAD_PIECE = {
  ES: [0, 0], EW: [1, 0], SW: [2, 0],
  NE: [0, 1], NS: [1, 1], NW: [2, 1],
  NES: [0, 2], NESW: [1, 2], NSW: [2, 2],
  ESW: [0, 3], NEW: [1, 3],
  N: [1, 1], S: [1, 1], E: [1, 0], W: [1, 0], '': [2, 3],
};

/* Fences work the same way, and for the same reason: a fence has to be able to
 * run along the edge of a field without owning the ground under it. Unlike a
 * road a fence is SOLID, except where the map lists a gateway. */
const FENCE_KIT = [19, 2], FENCE_SHEET = 'nature';
const FENCE_PIECE = {
  ES: [0, 0], SW: [1, 0], E: [2, 0], NS: [3, 0], NES: [4, 0], ESW: [5, 0], '': [6, 0],
  NE: [0, 1], NW: [1, 1], W: [2, 1], EW: [3, 1], NEW: [4, 1], NSW: [5, 1], NESW: [6, 1],
  N: [3, 0], S: [3, 0],
};
// indoor tile codes
const VOID = 0, FLOOR = 1, WALL = 2;

const WALLSETS = { stone: [0, 8], keep: [5, 8], wood: [10, 8] };

// ---------------------------------------------------------------- helpers
function seededRandom(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}
function overlaps(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = () => reject(new Error('Could not load ' + src));
    im.src = src;
  });
}

// ---------------------------------------------------------------- game state
const game = {
  images: {}, maps: {}, map: null, player: null, entities: [],
  stats: { treasury: 1000, order: 60, food: 70 },
  flags: {},
  dialog: null, debug: false, minimap: false, hint: '', hintTimer: 0,
  keys: {}, touch: { joyId: null, joyBase: null, joyVec: { x: 0, y: 0 } },
  time: 0, fade: 0, pending: null, portalLock: true, banner: '', bannerTimer: 0,
};

// a character is exactly one tile: the sheet is 4 columns (the way they face)
// by several rows (the steps of the walk)
const DIR_COLUMN = [1, 2, 0, 3];   // engine dir 0 up, 1 left, 2 down, 3 right
function makeEntity(sheet, name, tx, ty, dir, extra) {
  return Object.assign({
    id: sheet, name, sheet,
    x: tx * T, y: ty * T, dir: dir || 0,
    frame: 0, anim: 0, moving: false, speed: 46, npc: true,
  }, extra || {});
}
function feet(e) { return { x: e.x + 3, y: e.y + 10, w: 10, h: 6 }; }

// ---------------------------------------------------------------- building maps
function makeTiles(def) {
  const tiles = [], roads = [], fences = [], open = new Set();
  const empty = def.kind === 'outdoor' ? GROUND[def.base || 'grass'].id : VOID;
  for (let y = 0; y < def.h; y++) {
    tiles.push(new Array(def.w).fill(empty));
    roads.push(new Array(def.w).fill(0));
    fences.push(new Array(def.w).fill(0));
  }
  const inside = (x, y) => x >= 0 && y >= 0 && x < def.w && y < def.h;
  const fill = (grid, x0, y0, x1, y1, v) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++)
      if (inside(x, y)) grid[y][x] = v;
  };
  if (def.kind === 'outdoor') {
    for (const [name, x0, y0, x1, y1] of (def.ground || [])) {
      const g = GROUND[name];
      if (!g) { console.warn('unknown ground:', name); continue; }
      fill(tiles, x0, y0, x1, y1, g.id);
    }
    // roads are painted after, onto their own layer, so they lie over the paving
    for (const [x0, y0, x1, y1] of (def.roads || [])) fill(roads, x0, y0, x1, y1, 1);
    for (const [x0, y0, x1, y1] of (def.fences || [])) fill(fences, x0, y0, x1, y1, 1);
    // a gateway: the wall or fence keeps its tile, so the runs either side still
    // draw as wall, but the player may walk through it
    for (const [x, y, w, h] of (def.gaps || []))
      for (let yy = y; yy < y + (h || 1); yy++)
        for (let xx = x; xx < x + (w || 1); xx++) open.add(xx + ',' + yy);
  } else {
    const [rx, ry, rw, rh] = def.room;
    fill(tiles, rx - 1, ry - 1, rx + rw, ry + rh, WALL);
    fill(tiles, rx, ry, rx + rw - 1, ry + rh - 1, FLOOR);
    // a corridor cut through the wall needs jambs, or it ends in raw black
    for (const [x, y, w, h] of (def.extraFloor || [])) {
      fill(tiles, x, y, x + w - 1, y + h - 1, FLOOR);
      for (let yy = y; yy < y + h; yy++) {
        if (at(tiles, x - 1, yy, WALL) === VOID) tiles[yy][x - 1] = WALL;
        if (at(tiles, x + w, yy, WALL) === VOID) tiles[yy][x + w] = WALL;
      }
      for (let xx = x - 1; xx <= x + w; xx++)
        if (inside(xx, y + h) && tiles[y + h][xx] === VOID) tiles[y + h][xx] = WALL;
    }
  }
  return { tiles, roads, fences, open };
}

function at(tiles, x, y, outside) {
  if (x < 0 || y < 0 || y >= tiles.length || x >= tiles[0].length) return outside;
  return tiles[y][x];
}
// which of the nine tiles of an outlined block this one is, from its neighbours
function ninePiece(tiles, x, y, v, outside) {
  const n = at(tiles, x, y - 1, outside) === v, s = at(tiles, x, y + 1, outside) === v;
  const w = at(tiles, x - 1, y, outside) === v, e = at(tiles, x + 1, y, outside) === v;
  return [w ? (e ? 1 : 2) : 0, n ? (s ? 1 : 2) : 0];
}
function roadPiece(roads, x, y) {
  let m = '';
  if (at(roads, x, y - 1, 1)) m += 'N';
  if (at(roads, x + 1, y, 1)) m += 'E';
  if (at(roads, x, y + 1, 1)) m += 'S';
  if (at(roads, x - 1, y, 1)) m += 'W';
  return ROAD_PIECE[m] || ROAD_PIECE.NESW;
}

function fencePiece(fences, x, y) {
  let m = '';
  if (at(fences, x, y - 1, 0)) m += 'N';
  if (at(fences, x + 1, y, 0)) m += 'E';
  if (at(fences, x, y + 1, 0)) m += 'S';
  if (at(fences, x - 1, y, 0)) m += 'W';
  return FENCE_PIECE[m] || FENCE_PIECE.NESW;
}

function drawOutdoor(ctx, def, tiles, roads, fences) {
  const med = game.images.medieval;
  const grass = GROUND.grass, rnd = seededRandom(9);
  // the grass goes down everywhere first, so every other kind of ground sits on it
  for (let y = 0; y < def.h; y++) for (let x = 0; x < def.w; x++)
    drawGroundCell(ctx, grass, [1, 1], x, y, rnd);
  for (let y = 0; y < def.h; y++) for (let x = 0; x < def.w; x++) {
    const v = tiles[y][x];
    if (v === GRASS) continue;
    const g = BY_ID[v], p = ninePiece(tiles, x, y, v, v);
    // only the middle piece is a full square; every edge and corner needs the
    // ground it sits on laid under it, and a wall needs it everywhere
    if (g.hollow || p[0] !== 1 || p[1] !== 1)
      drawGroundCell(ctx, BY_ID[groundAround(tiles, x, y, v)], [1, 1], x, y, null);
    drawGroundCell(ctx, g, p, x, y, rnd);
  }
  for (let y = 0; y < def.h; y++) for (let x = 0; x < def.w; x++) {
    if (!roads[y][x]) continue;
    const p = roadPiece(roads, x, y);
    ctx.drawImage(med, (ROAD_KIT[0] + p[0]) * T, (ROAD_KIT[1] + p[1]) * T,
                  T, T, x * T, y * T, T, T);
  }
  const nat = game.images[FENCE_SHEET];
  for (let y = 0; y < def.h; y++) for (let x = 0; x < def.w; x++) {
    if (!fences[y][x]) continue;
    const p = fencePiece(fences, x, y);
    ctx.drawImage(nat, (FENCE_KIT[0] + p[0]) * T, (FENCE_KIT[1] + p[1]) * T,
                  T, T, x * T, y * T, T, T);
  }
}
/* What this tile is standing ON: whichever of its neighbours is commonest, not
 * counting itself or any wall. Every block in the tileset has rounded corners
 * and the walls are see-through in the middle, so SOMETHING has to be laid down
 * first or the base grass shows through - which is how a yard of bare earth
 * inside a stone castle ends up with green corners.
 * Ties go to the ground that is not the map's base, because a patch of paving in
 * a field is far more often bordered by the field than the other way round. */
function groundAround(tiles, x, y, self) {
  const count = new Map();
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    if (!dx && !dy) continue;
    const v = at(tiles, x + dx, y + dy, GRASS);
    if (v === self || BY_ID[v].hollow) continue;
    count.set(v, (count.get(v) || 0) + 1);
  }
  let best = GRASS, n = 0;
  for (const [v, c] of count)
    if (c > n || (c === n && best === GRASS && v !== GRASS)) { best = v; n = c; }
  return best;
}
// one tile of ground: the piece the neighbours ask for, or now and then one of
// the ground's stand-ins, but only where the piece is the middle - swapping an
// edge tile would break the outline the block draws round itself. A stand-in may
// be a decal with holes in it (a rock lying on the earth), so the plain middle
// goes down underneath it first.
function drawGroundCell(ctx, g, p, x, y, rnd) {
  const im = game.images[g.sheet];
  const mid = [g.block[0] + p[0], g.block[1] + p[1]];
  ctx.drawImage(im, mid[0] * T, mid[1] * T, T, T, x * T, y * T, T, T);
  if (!rnd) return;
  if (!g.alt || p[0] !== 1 || p[1] !== 1) { rnd(); return; }
  const r = rnd();
  if (r >= g.altRate) return;
  const a = g.alt[Math.floor(r / g.altRate * g.alt.length) % g.alt.length];
  ctx.drawImage(im, a[0] * T, a[1] * T, T, T, x * T, y * T, T, T);
}

function drawIndoor(ctx, def, tiles, w, h) {
  const med = game.images.medieval;
  const floor = GROUND[def.floor] || GROUND.wood;
  const wall = WALLSETS[def.wall] || WALLSETS.stone;
  const rnd = seededRandom(5);
  ctx.fillStyle = '#14121a';
  ctx.fillRect(0, 0, w, h);
  for (let y = 0; y < def.h; y++) for (let x = 0; x < def.w; x++) {
    const v = tiles[y][x];
    if (v === FLOOR) {
      drawGroundCell(ctx, floor, ninePiece(tiles, x, y, FLOOR, FLOOR), x, y, rnd);
    } else if (v === WALL) {
      const p = ninePiece(tiles, x, y, WALL, VOID);
      ctx.drawImage(med, (wall[0] + p[0]) * T, (wall[1] + p[1]) * T, T, T, x * T, y * T, T, T);
    }
  }
  // patches: a carpet, a dais, a different floor in one corner. Same nine-slice
  // rule as outdoors, so a patch draws its own edge and does not need a border
  // laid by hand.
  for (const [name, x0, y0, x1, y1] of (def.patches || [])) {
    const g = GROUND[name];
    if (!g) { console.warn('unknown patch ground:', name); continue; }
    const inside = (x, y) => x >= x0 && x <= x1 && y >= y0 && y <= y1;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      if (x < 0 || y < 0 || x >= def.w || y >= def.h || tiles[y][x] !== FLOOR) continue;
      const p = [inside(x - 1, y) ? (inside(x + 1, y) ? 1 : 2) : 0,
                 inside(x, y - 1) ? (inside(x, y + 1) ? 1 : 2) : 0];
      drawGroundCell(ctx, g, p, x, y, rnd);
    }
  }
}

function placeObject(map, type, tx, ty) {
  const d = OBJECTS[type];
  if (!d) { console.warn('unknown object:', type); return null; }
  const o = {
    type, def: d, x: tx * T, y: ty * T, w: d.w * T, h: d.h * T,
    solid: d.solid !== false, cols: [],
  };
  const boxes = d.cols || (d.col ? [d.col] : []);
  for (const b of boxes) o.cols.push({ x: o.x + b[0], y: o.y + b[1], w: b[2], h: b[3] });
  if (d.door) o.door = { x: o.x + d.door[0], y: o.y + d.door[1], w: d.door[2], h: d.door[3] };
  // the part actually painted, used for sorting and for culling
  const art = d.art || [0, 0, o.w, o.h];
  o.artBottom = o.y + art[1] + art[3];
  map.objects.push(o);
  return o;
}

function buildMap(name) {
  const def = WORLD.maps[name];
  if (!def) throw new Error('No such map: ' + name);
  const { tiles, roads, fences, open } = makeTiles(def);
  const canvas = document.createElement('canvas');
  canvas.width = def.w * T; canvas.height = def.h * T;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  if (def.kind === 'outdoor') drawOutdoor(ctx, def, tiles, roads, fences);
  else drawIndoor(ctx, def, tiles, canvas.width, canvas.height);

  const map = { name, def, tiles, roads, fences, open, canvas, objects: [], npcs: [], portals: [] };
  for (const [type, tx, ty] of (def.objects || [])) placeObject(map, type, tx, ty);

  // groves: many of the same thing sprinkled over a rectangle, so a wood is one
  // line of data, and a paved square gets its cracks and litter the same way.
  // A piece is dropped if it would stand on anything but the ground the grove
  // names, within a tile of a road, or close enough to another object that the
  // two drawings would visibly sit on top of one another - a wood should look
  // grown, not stacked.
  const artBox = o => ({ x: o.x + o.def.art[0], y: o.y + o.def.art[1],
                         w: o.def.art[2], h: o.def.art[3] });
  for (const g of (def.groves || [])) {
    const rnd = seededRandom(g.seed || 1);
    const [gx, gy, gw, gh] = g.rect;
    const on = GROUND[g.on || 'grass'].id;
    for (let i = 0; i < g.count; i++) {
      const type = g.types[Math.floor(rnd() * g.types.length)];
      const d = OBJECTS[type];
      if (!d) continue;
      const tx = gx + Math.floor(rnd() * gw), ty = gy + Math.floor(rnd() * gh);
      let bad = false;
      for (let yy = -1; yy <= d.h && !bad; yy++)
        for (let xx = -1; xx <= d.w; xx++) {
          const right = at(tiles, tx + xx, ty + yy, on) === on;
          const nearRoad = at(roads, tx + xx, ty + yy, 0) || at(fences, tx + xx, ty + yy, 0);
          // the ring of tiles around it only has to be free of road; the tiles
          // it actually covers have to be the right ground as well
          const covered = xx >= 0 && yy >= 0 && xx < d.w && yy < d.h;
          if (nearRoad || (covered && !right)) { bad = true; break; }
        }
      if (bad) continue;
      const o = placeObject(map, type, tx, ty);
      if (!o) continue;
      const a = artBox(o), room = { x: a.x + 2, y: a.y + a.h * 0.45, w: a.w - 4, h: a.h * 0.55 };
      const clash = map.objects.some(q => {
        if (q === o) return false;
        const b = artBox(q);
        return overlaps(room, { x: b.x + 2, y: b.y + b.h * 0.45, w: b.w - 4, h: b.h * 0.55 });
      });
      if (clash) map.objects.pop();
    }
  }

  for (const n of (def.npcs || [])) {
    const e = makeEntity(n.sheet, n.name, n.x, n.y, n.dir, { id: n.id, wander: n.wander || null });
    e.homeX = e.x;
    map.npcs.push(e);
  }
  for (const p of (def.portals || [])) {
    map.portals.push({
      rect: { x: p.rect[0] * T, y: p.rect[1] * T, w: p.rect[2] * T, h: p.rect[3] * T },
      to: p.to, spawn: p.spawn, dir: p.dir, label: p.label || '',
    });
  }
  return map;
}

function enterMap(name, spawn, dir) {
  const map = game.maps[name] || (game.maps[name] = buildMap(name));
  game.map = map;
  const p = game.player;
  p.x = spawn[0] * T; p.y = spawn[1] * T;
  if (dir != null) p.dir = dir;
  p.moving = false; p.frame = 0; p.anim = 0;
  game.entities = [p].concat(map.npcs);
  game.portalLock = true;
  game.banner = map.def.name; game.bannerTimer = 2.4;
}

// ---------------------------------------------------------------- dialogue
function openDialog(npc) {
  const build = SCRIPT[npc.id];
  if (!build) { showHint(npc.name + ' has nothing to say.'); return; }
  game.dialog = { npc, lines: build(game), index: 0, choice: 0, extra: null };
  npc.dir = faceToward(npc, game.player);
}
function faceToward(a, b) {
  const dx = (b.x - a.x), dy = (b.y - a.y);
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 3 : 1;
  return dy > 0 ? 2 : 0;
}
function currentLine() {
  const d = game.dialog; if (!d) return null;
  return d.extra || d.lines[d.index];
}
function step(d) { d.index++; if (d.index >= d.lines.length) game.dialog = null; }
function advanceDialog(choiceIndex) {
  const d = game.dialog; if (!d) return;
  const line = currentLine();
  if (line.choices && !d.extra) {
    const c = line.choices[choiceIndex == null ? d.choice : choiceIndex];
    for (const k in (c.effect || {})) game.stats[k] = Math.max(0, game.stats[k] + c.effect[k]);
    Object.assign(game.flags, c.set || {});
    if (c.reply) { d.extra = { who: d.npc.name, text: c.reply }; return; }
    step(d); return;
  }
  if (d.extra) { d.extra = null; step(d); return; }
  Object.assign(game.flags, line.set || {});
  step(d);
}

// ---------------------------------------------------------------- collision
function groundBlocks(px, py) {
  const map = game.map, def = map.def;
  if (px < 0 || py < 0 || px >= def.w * T || py >= def.h * T) return 'edge';
  const tx = Math.floor(px / T), ty = Math.floor(py / T);
  const v = map.tiles[ty][tx];
  if (def.kind !== 'outdoor') return v === FLOOR ? null : 'wall';
  const shut = !map.open.has(tx + ',' + ty);
  if (map.fences[ty][tx] && shut) return 'wall';
  if (!BY_ID[v].solid) return null;
  return shut ? (v === WATER ? 'water' : 'wall') : null;
}
function blockedAt(box, self) {
  for (const o of game.map.objects) for (const c of o.cols) if (overlaps(box, c)) return o;
  for (const e of game.entities) if (e !== self && overlaps(box, feet(e))) return e;
  const corners = [[box.x, box.y], [box.x + box.w - 1, box.y],
                   [box.x, box.y + box.h - 1], [box.x + box.w - 1, box.y + box.h - 1]];
  for (const [px, py] of corners) { const s = groundBlocks(px, py); if (s) return s; }
  return null;
}
function moveEntity(e, dx, dy) {
  if (dx) { const f = feet(e); f.x += dx; if (!blockedAt(f, e)) e.x += dx; }
  if (dy) { const f = feet(e); f.y += dy; if (!blockedAt(f, e)) e.y += dy; }
}

// ---------------------------------------------------------------- update
function inputVector() {
  let x = 0, y = 0;
  const k = game.keys;
  if (k.ArrowLeft || k.KeyA) x -= 1; if (k.ArrowRight || k.KeyD) x += 1;
  if (k.ArrowUp || k.KeyW) y -= 1; if (k.ArrowDown || k.KeyS) y += 1;
  if (!x && !y) { x = game.touch.joyVec.x; y = game.touch.joyVec.y; }
  const len = Math.hypot(x, y);
  if (len > 1) { x /= len; y /= len; }
  return { x, y };
}
function nearestNpc() {
  const pf = feet(game.player);
  const cx = pf.x + pf.w / 2, cy = pf.y + pf.h / 2;
  let best = null, bd = 22;
  for (const e of game.entities) if (e.npc) {
    const f = feet(e);
    const d = Math.hypot(f.x + f.w / 2 - cx, f.y + f.h / 2 - cy);
    if (d < bd) { bd = d; best = e; }
  }
  return best;
}
function portalUnderPlayer() {
  const f = feet(game.player);
  for (const p of game.map.portals) if (overlaps(f, p.rect)) return p;
  return null;
}
function doAction() {
  if (game.dialog) { advanceDialog(); return; }
  const npc = nearestNpc();
  if (npc) { openDialog(npc); return; }
  const p = portalUnderPlayer();
  if (p && !game.pending) { game.pending = p; return; }
  // a door is drawn at the foot of a building, so the player's feet can never be
  // on it - he is standing in front of it. Look a short step ahead instead.
  const f = feet(game.player), d = game.player.dir;
  const reach = { x: f.x + (d === 1 ? -6 : d === 3 ? 6 : 0), y: f.y + (d === 0 ? -8 : d === 2 ? 6 : 0),
                  w: f.w, h: f.h };
  for (const o of game.map.objects) if (o.door && overlaps(reach, o.door)) {
    showHint('The door is barred.'); return;
  }
  showHint('Nothing here.');
}
function showHint(t) { game.hint = t; game.hintTimer = 2.5; }

function update(dt) {
  game.time += dt;
  if (game.hintTimer > 0) game.hintTimer -= dt;
  if (game.bannerTimer > 0) game.bannerTimer -= dt;

  if (game.pending) {
    game.fade += dt * 4;
    if (game.fade >= 1) {
      game.fade = 1;
      enterMap(game.pending.to, game.pending.spawn, game.pending.dir);
      game.pending = null;
    }
    return;
  }
  if (game.fade > 0) game.fade = Math.max(0, game.fade - dt * 4);

  const p = game.player;
  if (game.dialog) { p.moving = false; p.frame = 0; return; }

  const v = inputVector();
  p.moving = !!(v.x || v.y);
  if (p.moving) {
    if (Math.abs(v.x) > Math.abs(v.y)) p.dir = v.x > 0 ? 3 : 1; else p.dir = v.y > 0 ? 2 : 0;
    const s = p.speed * dt;
    moveEntity(p, Math.round(v.x * s * 10) / 10, Math.round(v.y * s * 10) / 10);
    p.anim += dt * 7; p.frame = Math.floor(p.anim) % 4;
  } else { p.frame = 0; p.anim = 0; }

  for (const e of game.map.npcs) {
    if (!e.wander) continue;
    const target = e.homeX + Math.sin(game.time * 0.4 + (e.homeX % 7)) * e.wander.range;
    const d = target - e.x;
    if (Math.abs(d) > 0.4) {
      e.dir = d > 0 ? 3 : 1;
      moveEntity(e, Math.sign(d) * Math.min(Math.abs(d), e.wander.speed * dt), 0);
      e.anim += dt * 6; e.frame = Math.floor(e.anim) % 4;
    } else e.frame = 0;
  }

  const portal = portalUnderPlayer();
  if (game.portalLock) { if (!portal) game.portalLock = false; }
  else if (portal) game.pending = portal;
}

// ---------------------------------------------------------------- rendering
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
let scale = 3, vw = 320, vh = 240;
function resize() {
  const dpr = window.devicePixelRatio || 1;
  const cw = Math.floor(window.innerWidth * dpr), ch = Math.floor(window.innerHeight * dpr);
  canvas.width = cw; canvas.height = ch;
  canvas.style.width = window.innerWidth + 'px'; canvas.style.height = window.innerHeight + 'px';
  // a whole number of screen pixels per art pixel, never fewer than three, so the
  // pixels stay square and visibly pixels
  scale = Math.max(3, Math.min(8, Math.round(Math.min(cw, ch) / 230)));
  vw = Math.ceil(cw / scale); vh = Math.ceil(ch / scale);
}
window.addEventListener('resize', resize); resize();

function camera() {
  const def = game.map.def, p = game.player;
  const mw = def.w * T, mh = def.h * T;
  const cx = mw <= vw ? Math.round((mw - vw) / 2)
    : Math.max(0, Math.min(mw - vw, Math.round(p.x + T / 2 - vw / 2)));
  const cy = mh <= vh ? Math.round((mh - vh) / 2)
    : Math.max(0, Math.min(mh - vh, Math.round(p.y + T / 2 - vh / 2)));
  return { x: cx, y: cy };
}
function drawEntity(e, cam) {
  const sheet = game.images['ch:' + e.sheet];
  if (!sheet) return;
  ctx.drawImage(sheet, DIR_COLUMN[e.dir] * T, e.frame * T, T, T,
    Math.round(e.x - cam.x), Math.round(e.y - cam.y), T, T);
}
function drawObject(o, cam) {
  const d = o.def;
  ctx.drawImage(game.images[d.sheet], d.sx * T, d.sy * T, d.w * T, d.h * T,
    Math.round(o.x - cam.x), Math.round(o.y - cam.y), o.w, o.h);
}

function nineSlice(img, x, y, w, h, b) {
  const iw = img.width, ih = img.height;
  const p = [
    [0, 0, b, b, x, y, b, b], [b, 0, iw - 2 * b, b, x + b, y, w - 2 * b, b], [iw - b, 0, b, b, x + w - b, y, b, b],
    [0, b, b, ih - 2 * b, x, y + b, b, h - 2 * b], [b, b, iw - 2 * b, ih - 2 * b, x + b, y + b, w - 2 * b, h - 2 * b],
    [iw - b, b, b, ih - 2 * b, x + w - b, y + b, b, h - 2 * b],
    [0, ih - b, b, b, x, y + h - b, b, b], [b, ih - b, iw - 2 * b, b, x + b, y + h - b, w - 2 * b, b],
    [iw - b, ih - b, b, b, x + w - b, y + h - b, b, b],
  ];
  for (const q of p) ctx.drawImage(img, ...q);
}
function wrapText(text, maxW) {
  const words = text.split(' '); const lines = []; let cur = '';
  for (const w of words) {
    const t = cur ? cur + ' ' + w : w;
    if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t;
  }
  if (cur) lines.push(cur);
  return lines;
}

const ui = { choices: [], actionBtn: null, debugBtn: null, mapBtn: null };
function drawDialog() {
  const line = currentLine(); if (!line) return;
  const margin = 6, h = 62, w = Math.min(vw - 2 * margin, 300);
  const x = Math.round((vw - w) / 2), y = vh - h - margin;
  nineSlice(game.images.bubble, x, y, w, h, 12);
  const speaker = line.who === game.player.name ? game.player : game.dialog.npc;
  const face = game.images['face:' + speaker.sheet];
  ctx.drawImage(game.images.facebox, x + 5, y + 7, 48, 48);
  if (face) ctx.drawImage(face, x + 10, y + 12, 38, 38);
  ctx.fillStyle = '#3a2418'; ctx.font = 'bold 8px sans-serif'; ctx.textBaseline = 'top';
  ctx.fillText(line.who, x + 58, y + 8);
  ctx.font = '8px sans-serif';
  wrapText(line.text, w - 66).slice(0, 5).forEach((l, i) => ctx.fillText(l, x + 58, y + 19 + i * 9));
  ui.choices = [];
  if (line.choices) {
    const ch = 12, cy0 = y - line.choices.length * ch - 4;
    line.choices.forEach((c, i) => {
      const cx = x + 20, cw = w - 40, cy = cy0 + i * ch;
      ctx.fillStyle = i === game.dialog.choice ? 'rgba(244,200,110,0.96)' : 'rgba(250,240,225,0.92)';
      ctx.fillRect(cx, cy, cw, ch - 2);
      ctx.strokeStyle = '#6a3f22'; ctx.strokeRect(cx + 0.5, cy + 0.5, cw - 1, ch - 3);
      ctx.fillStyle = '#3a2418'; ctx.font = '8px sans-serif';
      ctx.fillText((i === game.dialog.choice ? '> ' : '  ') + c.text, cx + 4, cy + 2);
      ui.choices.push({ x: cx, y: cy, w: cw, h: ch, i });
    });
  } else {
    ctx.drawImage(game.images.arrow, x + w - 20, y + h - 18);
  }
}
function drawHud() {
  const s = game.stats;
  ctx.fillStyle = 'rgba(20,16,24,0.72)'; ctx.fillRect(4, 4, 150, 14);
  ctx.fillStyle = '#f2e8d2'; ctx.font = 'bold 8px sans-serif'; ctx.textBaseline = 'top';
  ctx.fillText(`Treasury ${s.treasury}   Order ${s.order}   Food ${s.food}`, 9, 8);
  if (game.bannerTimer > 0 && !game.dialog) {
    ctx.font = 'bold 10px sans-serif';
    const tw = ctx.measureText(game.banner).width;
    ctx.globalAlpha = Math.min(1, game.bannerTimer);
    ctx.fillStyle = 'rgba(20,16,24,0.72)'; ctx.fillRect((vw - tw) / 2 - 8, 24, tw + 16, 16);
    ctx.fillStyle = '#f2e8d2'; ctx.fillText(game.banner, (vw - tw) / 2, 28);
    ctx.globalAlpha = 1;
  }
  if (game.hintTimer > 0 && !game.dialog) {
    ctx.font = '8px sans-serif'; const tw = ctx.measureText(game.hint).width + 12;
    ctx.fillStyle = 'rgba(20,16,24,0.78)'; ctx.fillRect((vw - tw) / 2, vh - 30, tw, 14);
    ctx.fillStyle = '#f2e8d2'; ctx.fillText(game.hint, (vw - tw) / 2 + 6, vh - 26);
  }
  if (game.dialog) return;
  const cam = camera();
  const npc = nearestNpc();
  if (npc) {
    ctx.font = '8px sans-serif'; ctx.fillStyle = '#fff';
    ctx.fillText('E', Math.round(npc.x - cam.x) + 5, Math.round(npc.y - cam.y) - 9);
  } else {
    const portal = portalUnderPlayer();
    if (portal && !game.portalLock && portal.label) {
      ctx.font = '8px sans-serif'; const tw = ctx.measureText(portal.label).width + 12;
      ctx.fillStyle = 'rgba(20,16,24,0.78)'; ctx.fillRect((vw - tw) / 2, vh - 46, tw, 14);
      ctx.fillStyle = '#f2e8d2'; ctx.fillText(portal.label, (vw - tw) / 2 + 6, vh - 42);
    }
  }
}
function drawMinimap() {
  const def = game.map.def;
  const size = Math.min(84, Math.floor(vw * 0.28));
  const k = size / Math.max(def.w, def.h) / T;
  const w = Math.round(def.w * T * k), h = Math.round(def.h * T * k);
  const x = vw - w - 5, y = 24;
  ctx.fillStyle = 'rgba(12,10,16,0.9)'; ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
  ctx.globalAlpha = 0.9; ctx.drawImage(game.map.canvas, x, y, w, h); ctx.globalAlpha = 1;
  ctx.strokeStyle = 'rgba(240,220,170,0.9)'; ctx.strokeRect(x - 2.5, y - 2.5, w + 5, h + 5);
  const p = game.player;
  ctx.fillStyle = '#ffdf6e';
  ctx.fillRect(Math.round(x + p.x * k) - 1, Math.round(y + p.y * k) - 1, 3, 3);
}
function drawControls() {
  const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
  ui.actionBtn = { x: vw - 34, y: vh - 34, r: 14 };
  ui.debugBtn = { x: vw - 16, y: 11, r: 8 };
  ui.mapBtn = { x: vw - 34, y: 11, r: 8 };
  if (isTouch) {
    ctx.beginPath(); ctx.arc(ui.actionBtn.x, ui.actionBtn.y, ui.actionBtn.r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(244,200,110,0.55)'; ctx.fill();
    ctx.strokeStyle = 'rgba(60,40,20,0.7)'; ctx.stroke();
    ctx.fillStyle = '#3a2418'; ctx.font = 'bold 9px sans-serif';
    ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
    ctx.fillText('E', ui.actionBtn.x, ui.actionBtn.y); ctx.textAlign = 'left';
    const j = game.touch.joyBase;
    if (j) {
      ctx.beginPath(); ctx.arc(j.x, j.y, 22, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fill();
      ctx.beginPath(); ctx.arc(j.x + game.touch.joyVec.x * 15, j.y + game.touch.joyVec.y * 15, 9, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fill();
    }
  }
  for (const [btn, label, on] of [[ui.mapBtn, 'M', game.minimap], [ui.debugBtn, 'C', game.debug]]) {
    ctx.beginPath(); ctx.arc(btn.x, btn.y, btn.r, 0, Math.PI * 2);
    ctx.fillStyle = on ? 'rgba(220,160,60,0.85)' : 'rgba(20,16,24,0.5)'; ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 8px sans-serif';
    ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
    ctx.fillText(label, btn.x, btn.y);
  }
  ctx.textAlign = 'left'; ctx.textBaseline = 'top';
}
function drawDebug(cam) {
  const map = game.map, def = map.def;
  ctx.lineWidth = 1;
  const x0 = Math.max(0, Math.floor(cam.x / T)), x1 = Math.min(def.w - 1, Math.ceil((cam.x + vw) / T));
  const y0 = Math.max(0, Math.floor(cam.y / T)), y1 = Math.min(def.h - 1, Math.ceil((cam.y + vh) / T));
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    // show it the way the collision code sees it, fences and gateways included
    const solid = !!groundBlocks(x * T + T / 2, y * T + T / 2);
    if (solid) { ctx.fillStyle = 'rgba(40,80,255,0.25)'; ctx.fillRect(x * T - cam.x, y * T - cam.y, T, T); }
  }
  for (const p of map.portals) {
    ctx.fillStyle = 'rgba(255,220,40,0.3)'; ctx.fillRect(p.rect.x - cam.x, p.rect.y - cam.y, p.rect.w, p.rect.h);
  }
  for (const o of map.objects) for (const c of o.cols) {
    ctx.strokeStyle = 'rgba(255,40,40,0.95)';
    ctx.strokeRect(c.x - cam.x + 0.5, c.y - cam.y + 0.5, c.w - 1, c.h - 1);
  }
  for (const e of game.entities) {
    const f = feet(e);
    ctx.strokeStyle = 'rgba(60,255,60,0.95)';
    ctx.strokeRect(f.x - cam.x + 0.5, f.y - cam.y + 0.5, f.w - 1, f.h - 1);
  }
  const p = game.player;
  ctx.fillStyle = '#fff'; ctx.font = '8px sans-serif';
  ctx.fillText(`${map.name} ${def.w}x${def.h} obj:${map.objects.length} tile:${Math.floor(p.x / T)},${Math.floor(p.y / T)} x${scale}`, 6, 22);
}

function render() {
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.imageSmoothingEnabled = false;
  const cam = camera();
  ctx.fillStyle = '#14121a'; ctx.fillRect(0, 0, vw, vh);
  ctx.drawImage(game.map.canvas, -cam.x, -cam.y);

  const visible = o => !(o.x + o.w < cam.x || o.x > cam.x + vw || o.y + o.h < cam.y || o.y > cam.y + vh);
  for (const o of game.map.objects) if (!o.solid && visible(o)) drawObject(o, cam);
  const drawables = [];
  for (const o of game.map.objects) if (o.solid && visible(o)) drawables.push({ z: o.artBottom, o });
  for (const e of game.entities) drawables.push({ z: e.y + T, e });
  drawables.sort((a, b) => a.z - b.z);
  for (const d of drawables) { if (d.o) drawObject(d.o, cam); else drawEntity(d.e, cam); }

  if (game.debug) drawDebug(cam);
  drawHud();
  if (game.minimap && !game.dialog) drawMinimap();
  if (game.dialog) drawDialog();
  drawControls();
  if (game.fade > 0) { ctx.fillStyle = `rgba(8,7,10,${game.fade})`; ctx.fillRect(0, 0, vw, vh); }
}

// ---------------------------------------------------------------- input
window.addEventListener('keydown', ev => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(ev.code)) ev.preventDefault();
  if (ev.repeat) return;
  game.keys[ev.code] = true;
  if (ev.code === 'KeyE' || ev.code === 'Enter' || ev.code === 'Space') doAction();
  if (ev.code === 'KeyC') game.debug = !game.debug;
  if (ev.code === 'KeyM') game.minimap = !game.minimap;
  if (game.dialog) {
    const line = currentLine();
    if (line.choices && !game.dialog.extra) {
      if (ev.code === 'ArrowUp' || ev.code === 'KeyW') game.dialog.choice = (game.dialog.choice + line.choices.length - 1) % line.choices.length;
      if (ev.code === 'ArrowDown' || ev.code === 'KeyS') game.dialog.choice = (game.dialog.choice + 1) % line.choices.length;
    }
  }
});
window.addEventListener('keyup', ev => { game.keys[ev.code] = false; });

function toView(ev) {
  const r = canvas.getBoundingClientRect(); const dpr = window.devicePixelRatio || 1;
  return { x: (ev.clientX - r.left) * dpr / scale, y: (ev.clientY - r.top) * dpr / scale };
}
function hitCircle(p, c) { return c && Math.hypot(p.x - c.x, p.y - c.y) <= c.r + 5; }
canvas.addEventListener('pointerdown', ev => {
  ev.preventDefault();
  const p = toView(ev);
  if (hitCircle(p, ui.debugBtn)) { game.debug = !game.debug; return; }
  if (hitCircle(p, ui.mapBtn)) { game.minimap = !game.minimap; return; }
  if (game.dialog) {
    for (const c of ui.choices) if (p.x >= c.x && p.x <= c.x + c.w && p.y >= c.y && p.y <= c.y + c.h) {
      game.dialog.choice = c.i; advanceDialog(c.i); return;
    }
    advanceDialog(); return;
  }
  if (hitCircle(p, ui.actionBtn)) { doAction(); return; }
  if (p.x < vw * 0.6 && game.touch.joyId === null) {
    game.touch.joyId = ev.pointerId;
    game.touch.joyBase = { x: p.x, y: p.y };
    game.touch.joyVec = { x: 0, y: 0 };
    canvas.setPointerCapture(ev.pointerId);
  }
});
canvas.addEventListener('pointermove', ev => {
  if (ev.pointerId !== game.touch.joyId) return;
  const p = toView(ev); const b = game.touch.joyBase;
  const dx = p.x - b.x, dy = p.y - b.y; const len = Math.hypot(dx, dy);
  if (len < 4) { game.touch.joyVec = { x: 0, y: 0 }; return; }
  const m = Math.min(1, len / 20);
  game.touch.joyVec = { x: dx / len * m, y: dy / len * m };
});
function endJoy(ev) {
  if (ev.pointerId === game.touch.joyId) {
    game.touch.joyId = null; game.touch.joyBase = null; game.touch.joyVec = { x: 0, y: 0 };
  }
}
canvas.addEventListener('pointerup', endJoy);
canvas.addEventListener('pointercancel', endJoy);

// ---------------------------------------------------------------- loading
async function loadAll() {
  const sheets = [
    ['medieval', 'medieval.png'], ['nature', 'nature.png'],
    ['bubble', 'hud/dialogue-bubble.png'], ['facebox', 'hud/faceset-box.png'],
    ['arrow', 'hud/arrow.png'],
  ];
  const cast = new Set();
  for (const m of Object.values(WORLD.maps)) for (const n of (m.npcs || [])) cast.add(n.sheet);
  cast.add(WORLD.start.sheet || 'monk');
  const people = [...cast];
  const all = await Promise.all([
    ...sheets.map(([, p]) => loadImage(ASSETS + p)),
    ...people.map(n => loadImage(ASSETS + 'characters/' + n + '.png')),
    ...people.map(n => loadImage(ASSETS + 'faceset/' + n + '.png')),
  ]);
  sheets.forEach(([k], i) => game.images[k] = all[i]);
  people.forEach((n, i) => {
    game.images['ch:' + n] = all[sheets.length + i];
    game.images['face:' + n] = all[sheets.length + people.length + i];
  });

  const s = WORLD.start;
  game.player = makeEntity(s.sheet || 'monk', WORLD.playerName || 'Brother Pacifer',
    s.x, s.y, s.dir, { id: 'player', npc: false });
  enterMap(s.map, [s.x, s.y], s.dir);
}

let last = 0;
function loop(ts) {
  const dt = Math.min(0.05, (ts - last) / 1000 || 0); last = ts;
  update(dt); render();
  requestAnimationFrame(loop);
}
loadAll().then(() => {
  const el = document.getElementById('loading'); if (el) el.remove();
  window.game = game;
  window.buildMap = buildMap;
  requestAnimationFrame(loop);
}).catch(err => {
  const el = document.getElementById('loading');
  if (el) el.textContent = err.message;
  console.error(err);
});
