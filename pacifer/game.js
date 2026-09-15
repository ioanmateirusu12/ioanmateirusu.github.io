/* Pacifer - game engine (HTML5 Canvas)
 *
 * The content lives in data/, not in here:
 *   data/objects.js  - one sprite + collision box per object (generated)
 *   data/world.js    - the maps: terrain, objects, characters, doorways
 *   data/dialogs.js  - what the characters say
 * They are .js files rather than .json so the game also runs when index.html is
 * opened straight off the disk, with no local server.
 *
 * The engine itself: several maps (outdoor terrain that auto-tiles its own edges,
 * indoor rooms whose walls are generated around a floor rectangle), an object
 * layer with per-object collision, animated LPC characters, a camera, a virtual
 * joystick, and a dialogue system whose choices move the realm's stats.
 */
'use strict';

const T = 32;
const ASSETS = 'assets/';
const WORLD = window.PACIFER_WORLD;
const OBJECTS = window.PACIFER_OBJECTS;
const SCRIPT = window.PACIFER_DIALOGS;

// Outdoor ground types. `plain` lists interchangeable fill tiles; `edge` is the
// [3x3 outer block, 2x2 inner corners] pair used to blend grass into this type.
// `sheet` names the image the fill tiles come from (the terrain sheet by default).
const GROUND = {
  grass: { id: 0, plain: [[3, 1], [4, 1], [5, 1], [3, 2], [4, 2], [5, 2]] },
  dirt:  { id: 1, plain: [[3, 3], [4, 3], [5, 3], [3, 4], [4, 4], [5, 4]], edge: [[6, 0], [6, 3]] },
  sand:  { id: 2, plain: [[3, 5], [4, 5], [5, 5], [3, 6], [4, 6], [5, 6]], edge: [[6, 5], [6, 8]] },
  water: { id: 3, plain: [[12, 16], [13, 16], [14, 16], [15, 16], [12, 17], [13, 17], [14, 17], [15, 17]],
           edge: [[3, 10], [0, 13]], solid: true },
  stone: { id: 4, sheet: 'paving', plain: [[0, 0], [0, 1], [0, 2]], edge: [[9, 0], [9, 3]] },
};
const GROUND_BY_ID = [];
for (const name in GROUND) { GROUND[name].name = name; GROUND_BY_ID[GROUND[name].id] = GROUND[name]; }
const GRASS = GROUND.grass.id;
// when a grass tile touches several kinds of ground, the heavier one wins the edge
const EDGE_PRIORITY = [GROUND.water, GROUND.stone, GROUND.sand, GROUND.dirt];

// Indoor tile codes.
const VOID = 0, FLOOR = 1, WALL = 2;
const FLOORS = {
  // `checker` alternates two tiles by (x+y), which reads as a floor that was laid
  // on purpose; `cells` picks at random, which suits floorboards.
  marble: { sheet: 'floor_tile', checker: [[0, 0], [0, 2]] },
  wood: { sheet: 'floor_wood', cells: [[1, 0], [1, 1]] },
};
const WALLS = {
  stone: { sheet: 'wall_stone', col: 0, row: 0 },
  brick: { sheet: 'wall_brick', col: 0, row: 0 },
};
// small plants scattered over open grass so big fields are not flat
const SCATTER = [];
for (let x = 0; x <= 10; x++) for (let y = 3; y <= 4; y++) SCATTER.push([x, y]);

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

function makeEntity(sheetName, name, tx, ty, dir, extra) {
  return Object.assign({
    id: sheetName, name, sheet: game.images[sheetName],
    x: tx * T - 16, y: ty * T - 32, dir: dir || 0,
    frame: 0, anim: 0, moving: false, speed: 110, npc: true,
  }, extra || {});
}
function feet(e) { return { x: e.x + 20, y: e.y + 46, w: 24, h: 16 }; }

// ---------------------------------------------------------------- building maps
function makeTiles(def) {
  const tiles = [];
  const empty = def.kind === 'outdoor' ? GROUND[def.base || 'grass'].id : VOID;
  for (let y = 0; y < def.h; y++) tiles.push(new Array(def.w).fill(empty));
  const fill = (x0, y0, x1, y1, v) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++)
      if (x >= 0 && y >= 0 && x < def.w && y < def.h) tiles[y][x] = v;
  };
  if (def.kind === 'outdoor') {
    for (const [name, x0, y0, x1, y1] of (def.ground || [])) {
      const g = GROUND[name];
      if (!g) { console.warn('unknown ground:', name); continue; }
      fill(x0, y0, x1, y1, g.id);
    }
  } else {
    const [rx, ry, rw, rh] = def.room;
    fill(rx - 1, ry - 3, rx + rw, ry + rh, WALL);    // the box of walls
    fill(rx, ry, rx + rw - 1, ry + rh - 1, FLOOR);   // the floor of the room
    for (const [x, y, w, h] of (def.extraFloor || [])) fill(x, y, x + w - 1, y + h - 1, FLOOR);
  }
  return tiles;
}

function tileAt(tiles, x, y) {
  if (x < 0 || y < 0 || y >= tiles.length || x >= tiles[0].length) return GRASS;
  return tiles[y][x];
}
// Which quarter-tile of the grass sheet blends this corner towards its neighbours.
function grassCorner(tiles, x, y, q) {
  const dx = (q % 2 === 0) ? -1 : 1, dy = (q < 2) ? -1 : 1;
  const h = tileAt(tiles, x + dx, y), v = tileAt(tiles, x, y + dy), d = tileAt(tiles, x + dx, y + dy);
  if (h === GRASS && v === GRASS && d === GRASS) return null;
  let ground = null;
  for (const g of EDGE_PRIORITY) {
    if (h === g.id || v === g.id || d === g.id) { ground = g; break; }
  }
  if (!ground) return null;
  const [[ox, oy], [ix, iy]] = ground.edge;
  if (h === GRASS && v === GRASS) return [ix + (q % 2 === 0 ? 1 : 0), iy + (q < 2 ? 1 : 0)];
  if (h !== GRASS && v !== GRASS) return [ox + (q % 2 === 0 ? 0 : 2), oy + (q < 2 ? 0 : 2)];
  if (h !== GRASS) return [ox + (q % 2 === 0 ? 0 : 2), oy + 1];
  return [ox + 1, oy + (q < 2 ? 0 : 2)];
}
// Cap, middle or base of a wall, decided by what sits above and below it.
function wallRow(tiles, x, y) {
  const below = tileAt(tiles, x, y + 1), above = (y - 1 < 0) ? VOID : tiles[y - 1][x];
  if (below === FLOOR) return 2;
  if (above !== WALL) return 0;
  return 1;
}

function drawGround(ctx, def, tiles) {
  const rnd = seededRandom(7);
  const terrain = game.images.terrain;
  for (let y = 0; y < def.h; y++) for (let x = 0; x < def.w; x++) {
    const ground = GROUND_BY_ID[tiles[y][x]];
    const cell = ground.plain[Math.floor(rnd() * ground.plain.length)];
    const img = ground.sheet ? game.images[ground.sheet] : terrain;
    ctx.drawImage(img, cell[0] * T, cell[1] * T, T, T, x * T, y * T, T, T);
    if (ground.id === GRASS) {
      for (let q = 0; q < 4; q++) {
        const c = grassCorner(tiles, x, y, q);
        if (c) ctx.drawImage(terrain, c[0] * T + (q % 2) * 16, c[1] * T + (q >> 1) * 16, 16, 16,
          x * T + (q % 2) * 16, y * T + (q >> 1) * 16, 16, 16);
      }
    }
  }
  // scattered flowers and grass tufts, only where the grass is clear of edges
  const rnd2 = seededRandom(19);
  const density = def.scatter == null ? 0.07 : def.scatter;
  for (let y = 0; y < def.h; y++) for (let x = 0; x < def.w; x++) {
    if (tiles[y][x] !== GRASS || rnd2() > density) continue;
    let clear = true;
    for (let dy = -1; dy <= 1 && clear; dy++) for (let dx = -1; dx <= 1; dx++)
      if (tileAt(tiles, x + dx, y + dy) !== GRASS) { clear = false; break; }
    if (!clear) continue;
    const c = SCATTER[Math.floor(rnd2() * SCATTER.length)];
    ctx.drawImage(game.images.flowers, c[0] * T, c[1] * T, T, T, x * T, y * T, T, T);
  }
}

function drawRoom(ctx, def, tiles, w, h) {
  const floor = FLOORS[def.floor], wall = WALLS[def.wall];
  const floorImg = game.images[floor.sheet], wallImg = game.images[wall.sheet];
  const rnd = seededRandom(7);
  ctx.fillStyle = '#0b0a0e';
  ctx.fillRect(0, 0, w, h);
  for (let y = 0; y < def.h; y++) for (let x = 0; x < def.w; x++) {
    const v = tiles[y][x];
    if (v === FLOOR) {
      const cell = floor.checker ? floor.checker[(x + y) & 1]
        : floor.cells[Math.floor(rnd() * floor.cells.length)];
      ctx.drawImage(floorImg, cell[0] * T, cell[1] * T, T, T, x * T, y * T, T, T);
    } else if (v === WALL) {
      ctx.drawImage(wallImg, (wall.col + (x % 3)) * T, (wall.row + wallRow(tiles, x, y)) * T,
        T, T, x * T, y * T, T, T);
    }
  }
}

function buildMap(name) {
  const def = WORLD.maps[name];
  if (!def) throw new Error('No such map: ' + name);
  const tiles = makeTiles(def);
  const canvas = document.createElement('canvas');
  canvas.width = def.w * T; canvas.height = def.h * T;
  const ctx = canvas.getContext('2d');
  if (def.kind === 'outdoor') drawGround(ctx, def, tiles);
  else drawRoom(ctx, def, tiles, canvas.width, canvas.height);

  const map = { name, def, tiles, canvas, objects: [], npcs: [], portals: [] };
  for (const [type, tx, ty] of (def.objects || [])) {
    const d = OBJECTS[type];
    if (!d) { console.warn('unknown object:', type); continue; }
    const o = {
      type, x: tx * T, y: ty * T, w: d.w, h: d.h,
      img: game.images['obj:' + type], flat: !!d.flat, anim: d.anim || null, cols: [],
    };
    const boxes = d.cols || (d.col ? [d.col] : []);
    for (const b of boxes) o.cols.push({ x: o.x + b[0], y: o.y + b[1], w: b[2], h: b[3] });
    if (d.door) o.door = { x: o.x + d.door[0], y: o.y + d.door[1], w: d.door[2], h: d.door[3] };
    if (d.walkable) o.walkable = { x: o.x + d.walkable[0], y: o.y + d.walkable[1], w: d.walkable[2], h: d.walkable[3] };
    map.objects.push(o);
  }
  // groves: many of the same kind of object sprinkled over a rectangle, so a
  // forest or an orchard is one line of data instead of a hundred
  for (const g of (def.groves || [])) {
    const rnd = seededRandom(g.seed || 1);
    const [gx, gy, gw, gh] = g.rect;
    for (let i = 0; i < g.count; i++) {
      const type = g.types[Math.floor(rnd() * g.types.length)];
      const d = OBJECTS[type];
      if (!d) continue;
      const tx = gx + Math.floor(rnd() * gw), ty = gy + Math.floor(rnd() * gh);
      const o = {
        type, x: tx * T, y: ty * T, w: d.w, h: d.h,
        img: game.images['obj:' + type], flat: !!d.flat, anim: d.anim || null, cols: [],
      };
      // skip anything that would land on a road, in water or on top of a building
      let bad = false;
      for (let yy = 0; yy < Math.ceil(d.h / T) && !bad; yy++)
        for (let xx = 0; xx < Math.ceil(d.w / T); xx++) {
          const t = tileAt(tiles, tx + xx, ty + yy);
          if (t !== GRASS) { bad = true; break; }
        }
      if (bad) continue;
      const boxes = d.cols || (d.col ? [d.col] : []);
      for (const b of boxes) o.cols.push({ x: o.x + b[0], y: o.y + b[1], w: b[2], h: b[3] });
      if (map.objects.some(p => p.cols.length && o.cols.length && overlaps(p.cols[0], o.cols[0]))) continue;
      map.objects.push(o);
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
  p.x = spawn[0] * T - 16; p.y = spawn[1] * T - 32;
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
function step(d) {
  d.index++;
  if (d.index >= d.lines.length) game.dialog = null;
}
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
  const v = map.tiles[Math.floor(py / T)][Math.floor(px / T)];
  if (def.kind !== 'outdoor') return v === FLOOR ? null : 'wall';
  if (!GROUND_BY_ID[v].solid) return null;
  for (const o of map.objects) {
    if (o.walkable && px >= o.walkable.x && px < o.walkable.x + o.walkable.w &&
        py >= o.walkable.y && py < o.walkable.y + o.walkable.h) return null;
  }
  return 'water';
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
  let best = null, bd = 46;
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
  for (const o of game.map.objects) if (o.door && overlaps(feet(game.player), o.door)) {
    showHint('The door is locked.'); return;
  }
  showHint('Nothing here.');
}
function showHint(t) { game.hint = t; game.hintTimer = 2.5; }

function update(dt) {
  game.time += dt;
  if (game.hintTimer > 0) game.hintTimer -= dt;
  if (game.bannerTimer > 0) game.bannerTimer -= dt;

  // moving between maps, with a short fade
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
    const stepPx = p.speed * dt;
    moveEntity(p, Math.round(v.x * stepPx * 10) / 10, Math.round(v.y * stepPx * 10) / 10);
    p.anim += dt * 12; p.frame = 1 + Math.floor(p.anim) % 8;
  } else { p.frame = 0; p.anim = 0; }

  for (const e of game.map.npcs) {
    if (!e.wander) continue;
    const target = e.homeX + Math.sin(game.time * 0.5 + (e.homeX % 7)) * e.wander.range;
    const d = target - e.x;
    if (Math.abs(d) > 0.6) {
      e.dir = d > 0 ? 3 : 1;
      moveEntity(e, Math.sign(d) * Math.min(Math.abs(d), e.wander.speed * dt), 0);
      e.anim += dt * 10; e.frame = 1 + Math.floor(e.anim) % 8;
    } else e.frame = 0;
  }

  // doorways fire when you step on them, but not the instant you arrive on one
  const portal = portalUnderPlayer();
  if (game.portalLock) { if (!portal) game.portalLock = false; }
  else if (portal) game.pending = portal;
}

// ---------------------------------------------------------------- rendering
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
let scale = 2, vw = 480, vh = 320;
function resize() {
  const dpr = window.devicePixelRatio || 1;
  const cw = Math.floor(window.innerWidth * dpr), ch = Math.floor(window.innerHeight * dpr);
  canvas.width = cw; canvas.height = ch;
  canvas.style.width = window.innerWidth + 'px'; canvas.style.height = window.innerHeight + 'px';
  scale = Math.max(1, Math.round(Math.min(cw, ch) / 340));
  vw = Math.ceil(cw / scale); vh = Math.ceil(ch / scale);
}
window.addEventListener('resize', resize); resize();

function camera() {
  const def = game.map.def, p = game.player;
  const mw = def.w * T, mh = def.h * T;
  const cx = mw <= vw ? Math.round((mw - vw) / 2)
    : Math.max(0, Math.min(mw - vw, Math.round(p.x + 32 - vw / 2)));
  const cy = mh <= vh ? Math.round((mh - vh) / 2)
    : Math.max(0, Math.min(mh - vh, Math.round(p.y + 48 - vh / 2)));
  return { x: cx, y: cy };
}
function drawEntity(e, cam) {
  ctx.drawImage(e.sheet, e.frame * 64, e.dir * 64, 64, 64,
    Math.round(e.x - cam.x), Math.round(e.y - cam.y), 64, 64);
}
function drawObject(o, cam) {
  const x = Math.round(o.x - cam.x), y = Math.round(o.y - cam.y);
  if (o.anim) {
    const f = Math.floor(game.time * o.anim.fps) % o.anim.frames;
    ctx.drawImage(o.img, f * o.anim.w, 0, o.anim.w, o.anim.h, x, y, o.anim.w, o.anim.h);
  } else ctx.drawImage(o.img, x, y);
}

function nineSlice(img, x, y, w, h, b) {
  const iw = img.width, ih = img.height;
  const pieces = [
    [0, 0, b, b, x, y, b, b], [b, 0, iw - 2 * b, b, x + b, y, w - 2 * b, b], [iw - b, 0, b, b, x + w - b, y, b, b],
    [0, b, b, ih - 2 * b, x, y + b, b, h - 2 * b], [b, b, iw - 2 * b, ih - 2 * b, x + b, y + b, w - 2 * b, h - 2 * b],
    [iw - b, b, b, ih - 2 * b, x + w - b, y + b, b, h - 2 * b],
    [0, ih - b, b, b, x, y + h - b, b, b], [b, ih - b, iw - 2 * b, b, x + b, y + h - b, w - 2 * b, b],
    [iw - b, ih - b, b, b, x + w - b, y + h - b, b, b],
  ];
  for (const p of pieces) ctx.drawImage(img, ...p);
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
  const margin = 8, h = 84, w = Math.min(vw - 2 * margin, 460);
  const x = Math.round((vw - w) / 2), y = vh - h - margin;
  nineSlice(game.images.bubble, x, y, w, h, 10);
  const speaker = line.who === game.player.name ? game.player : game.dialog.npc;
  ctx.drawImage(game.images.facebox, x + 8, y + 10, 48, 48);
  ctx.drawImage(speaker.sheet, 16, 2 * 64 + 4, 32, 32, x + 12, y + 14, 40, 40);
  ctx.fillStyle = '#3a2418'; ctx.font = 'bold 11px sans-serif'; ctx.textBaseline = 'top';
  ctx.fillText(line.who, x + 64, y + 10);
  ctx.font = '11px sans-serif';
  wrapText(line.text, w - 76).slice(0, 4).forEach((l, i) => ctx.fillText(l, x + 64, y + 24 + i * 13));
  ui.choices = [];
  if (line.choices) {
    const ch = 18, cy0 = y - line.choices.length * ch - 6;
    line.choices.forEach((c, i) => {
      const cx = x + 30, cw = w - 60, cy = cy0 + i * ch;
      ctx.fillStyle = i === game.dialog.choice ? 'rgba(240,200,110,0.95)' : 'rgba(250,240,225,0.9)';
      ctx.fillRect(cx, cy, cw, ch - 2);
      ctx.strokeStyle = '#7a4a2a'; ctx.strokeRect(cx + 0.5, cy + 0.5, cw - 1, ch - 3);
      ctx.fillStyle = '#3a2418'; ctx.font = '11px sans-serif';
      ctx.fillText((i === game.dialog.choice ? '> ' : '   ') + c.text, cx + 6, cy + 3);
      ui.choices.push({ x: cx, y: cy, w: cw, h: ch, i });
    });
  } else {
    ctx.fillStyle = '#7a4a2a'; ctx.font = '10px sans-serif';
    ctx.fillText('▼', x + w - 18, y + h - 16);
  }
}
function drawHud() {
  const s = game.stats;
  ctx.fillStyle = 'rgba(20,16,24,0.7)'; ctx.fillRect(6, 6, 186, 20);
  ctx.fillStyle = '#f0e6d0'; ctx.font = 'bold 10px sans-serif'; ctx.textBaseline = 'top';
  ctx.fillText(`Treasury ${s.treasury}   Order ${s.order}   Food ${s.food}`, 12, 11);
  if (game.bannerTimer > 0 && !game.dialog) {
    ctx.font = 'bold 13px sans-serif';
    const tw = ctx.measureText(game.banner).width;
    ctx.globalAlpha = Math.min(1, game.bannerTimer);
    ctx.fillStyle = 'rgba(20,16,24,0.7)'; ctx.fillRect((vw - tw) / 2 - 10, 34, tw + 20, 22);
    ctx.fillStyle = '#f0e6d0'; ctx.fillText(game.banner, (vw - tw) / 2, 39);
    ctx.globalAlpha = 1;
  }
  if (game.hintTimer > 0 && !game.dialog) {
    ctx.font = '11px sans-serif'; const tw = ctx.measureText(game.hint).width + 16;
    ctx.fillStyle = 'rgba(20,16,24,0.75)'; ctx.fillRect((vw - tw) / 2, vh - 40, tw, 20);
    ctx.fillStyle = '#f0e6d0'; ctx.fillText(game.hint, (vw - tw) / 2 + 8, vh - 35);
  }
  if (game.dialog) return;
  const cam = camera();
  const npc = nearestNpc();
  if (npc) {
    ctx.font = '10px sans-serif'; ctx.fillStyle = '#fff';
    ctx.fillText('Talk (E)', Math.round(npc.x - cam.x) + 10, Math.round(npc.y - cam.y) - 6);
  } else {
    const portal = portalUnderPlayer();
    if (portal && !game.portalLock && portal.label) {
      ctx.font = '11px sans-serif'; const tw = ctx.measureText(portal.label).width + 16;
      ctx.fillStyle = 'rgba(20,16,24,0.75)'; ctx.fillRect((vw - tw) / 2, vh - 62, tw, 20);
      ctx.fillStyle = '#f0e6d0'; ctx.fillText(portal.label, (vw - tw) / 2 + 8, vh - 57);
    }
  }
}
function drawMinimap() {
  const def = game.map.def;
  const size = Math.min(120, Math.floor(vw * 0.3));
  const k = size / Math.max(def.w, def.h) / T;
  const w = Math.round(def.w * T * k), h = Math.round(def.h * T * k);
  const x = vw - w - 8, y = 34;
  ctx.globalAlpha = 0.85;
  ctx.fillStyle = 'rgba(12,10,16,0.9)'; ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
  ctx.drawImage(game.map.canvas, x, y, w, h);
  ctx.globalAlpha = 1;
  ctx.strokeStyle = 'rgba(240,220,170,0.9)'; ctx.strokeRect(x - 2.5, y - 2.5, w + 5, h + 5);
  const p = game.player;
  ctx.fillStyle = '#ffdf6e';
  ctx.fillRect(Math.round(x + (p.x + 32) * k) - 1, Math.round(y + (p.y + 54) * k) - 1, 3, 3);
}
function drawControls() {
  const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
  ui.actionBtn = { x: vw - 54, y: vh - 54, r: 22 };
  ui.debugBtn = { x: vw - 26, y: 16, r: 11 };
  ui.mapBtn = { x: vw - 52, y: 16, r: 11 };
  if (isTouch) {
    ctx.beginPath(); ctx.arc(ui.actionBtn.x, ui.actionBtn.y, ui.actionBtn.r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(240,200,110,0.55)'; ctx.fill();
    ctx.strokeStyle = 'rgba(60,40,20,0.7)'; ctx.stroke();
    ctx.fillStyle = '#3a2418'; ctx.font = 'bold 12px sans-serif';
    ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
    ctx.fillText('E', ui.actionBtn.x, ui.actionBtn.y); ctx.textAlign = 'left';
    const j = game.touch.joyBase;
    if (j) {
      ctx.beginPath(); ctx.arc(j.x, j.y, 34, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fill();
      ctx.beginPath(); ctx.arc(j.x + game.touch.joyVec.x * 24, j.y + game.touch.joyVec.y * 24, 14, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fill();
    }
  }
  for (const [btn, label, on] of [[ui.mapBtn, 'M', game.minimap], [ui.debugBtn, 'C', game.debug]]) {
    ctx.beginPath(); ctx.arc(btn.x, btn.y, btn.r, 0, Math.PI * 2);
    ctx.fillStyle = on ? 'rgba(220,160,60,0.85)' : 'rgba(20,16,24,0.5)'; ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 11px sans-serif';
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
    const v = map.tiles[y][x];
    const solid = def.kind === 'outdoor' ? !!GROUND_BY_ID[v].solid : v !== FLOOR;
    if (solid) { ctx.fillStyle = 'rgba(40,80,255,0.22)'; ctx.fillRect(x * T - cam.x, y * T - cam.y, T, T); }
  }
  for (const p of map.portals) {
    ctx.fillStyle = 'rgba(255,220,40,0.25)'; ctx.fillRect(p.rect.x - cam.x, p.rect.y - cam.y, p.rect.w, p.rect.h);
    ctx.strokeStyle = 'rgba(255,220,40,0.95)';
    ctx.strokeRect(p.rect.x - cam.x + 0.5, p.rect.y - cam.y + 0.5, p.rect.w - 1, p.rect.h - 1);
  }
  for (const o of map.objects) {
    for (const c of o.cols) {
      ctx.strokeStyle = 'rgba(255,40,40,0.95)';
      ctx.strokeRect(c.x - cam.x + 0.5, c.y - cam.y + 0.5, c.w - 1, c.h - 1);
    }
    if (o.door) { ctx.strokeStyle = 'rgba(255,160,40,0.95)'; ctx.strokeRect(o.door.x - cam.x + 0.5, o.door.y - cam.y + 0.5, o.door.w - 1, o.door.h - 1); }
    if (o.walkable) { ctx.strokeStyle = 'rgba(80,255,120,0.95)'; ctx.strokeRect(o.walkable.x - cam.x + 0.5, o.walkable.y - cam.y + 0.5, o.walkable.w - 1, o.walkable.h - 1); }
  }
  for (const e of game.entities) {
    const f = feet(e);
    ctx.strokeStyle = 'rgba(60,255,60,0.95)';
    ctx.strokeRect(f.x - cam.x + 0.5, f.y - cam.y + 0.5, f.w - 1, f.h - 1);
  }
  const p = game.player;
  ctx.fillStyle = '#fff'; ctx.font = '10px sans-serif';
  ctx.fillText(`${map.name} ${def.w}x${def.h}  objects: ${map.objects.length}  tile: ${Math.floor((p.x + 32) / T)},${Math.floor((p.y + 54) / T)}`, 8, 30);
}

function render() {
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.imageSmoothingEnabled = false;
  const cam = camera();
  ctx.fillStyle = '#0b0a0e'; ctx.fillRect(0, 0, vw, vh);
  ctx.drawImage(game.map.canvas, -cam.x, -cam.y);

  const visible = o => !(o.x + o.w < cam.x || o.x > cam.x + vw || o.y + o.h < cam.y || o.y > cam.y + vh);
  // rugs, torches and shelves belong to the scenery and go under the characters
  for (const o of game.map.objects) if (o.flat && visible(o)) drawObject(o, cam);
  // everything else is sorted by its bottom edge so the player walks in front and behind
  const drawables = [];
  for (const o of game.map.objects) if (!o.flat && visible(o)) drawables.push({ z: o.y + o.h, o });
  for (const e of game.entities) drawables.push({ z: e.y + 62, e });
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
function hitCircle(p, c) { return c && Math.hypot(p.x - c.x, p.y - c.y) <= c.r + 6; }
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
  if (len < 6) { game.touch.joyVec = { x: 0, y: 0 }; return; }
  const m = Math.min(1, len / 30);
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
  const objectNames = Object.keys(OBJECTS);
  const sheets = [
    ['terrain', 'lpc-revised/Terrain/terrain_spring.png'],
    ['paving', 'lpc-revised/Structure/Floor/Herringbone A.png'],
    ['flowers', 'lpc-revised/Terrain/flowers.png'],
    ['floor_tile', 'lpc-revised/Structure/Floor/Tile A.png'],
    ['floor_wood', 'lpc-revised/Structure/Floor/Wood Floor A.png'],
    ['wall_stone', 'lpc-revised/Structure/Walls/Jagged Stone Walls.png'],
    ['wall_brick', 'lpc-revised/Structure/Walls/Brick Wall A.png'],
    ['bubble', 'ninja-adventure/dialogue-bubble.png'],
    ['facebox', 'ninja-adventure/faceset-box.png'],
  ];
  const characters = ['monk', 'emperor', 'guard', 'villager', 'marshal', 'steward'];
  for (const c of characters) sheets.push([c, 'characters/' + c + '.png']);

  const all = await Promise.all([
    ...sheets.map(([, p]) => loadImage(ASSETS + p)),
    ...objectNames.map(n => loadImage(ASSETS + 'objects/' + OBJECTS[n].file)),
  ]);
  sheets.forEach(([k], i) => game.images[k] = all[i]);
  objectNames.forEach((n, i) => game.images['obj:' + n] = all[sheets.length + i]);

  const s = WORLD.start;
  game.player = makeEntity('monk', WORLD.playerName || 'Brother Pacifer', s.x, s.y, s.dir,
    { id: 'monk', npc: false });
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
  window.game = game;       // for debugging and for the test suite
  window.buildMap = buildMap;
  requestAnimationFrame(loop);
}).catch(err => {
  const el = document.getElementById('loading');
  if (el) el.textContent = err.message;
  console.error(err);
});
