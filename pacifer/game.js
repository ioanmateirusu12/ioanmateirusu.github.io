/* Pacifer - motor de joc (HTML5 Canvas)
 *
 * Datele jocului stau separat, in data/:
 *   data/objects.js  - sprite-urile obiectelor + cutiile de coliziune (generat)
 *   data/world.js    - hartile: teren, obiecte, personaje, treceri prin usi
 *   data/dialogs.js  - replicile personajelor
 * Fiind fisiere .js si nu .json, jocul merge si deschis direct de pe disc (file://),
 * fara server local.
 *
 * Motorul: harti multiple (exterior autotilat + interioare cu pereti generati),
 * strat de obiecte cu coliziuni, personaje animate LPC, camera, joystick virtual,
 * dialog cu alegeri care modifica indicatorii imperiului.
 */
'use strict';

const T = 32;
const ASSETS = 'assets/';
const WORLD = window.PACIFER_WORLD;
const OBJDEFS = window.PACIFER_OBJECTS;
const LINES = window.PACIFER_DIALOGS;

// coduri de tile: exterior
const GRASS = 0, DIRT = 1, WATER = 2;
const TERRAIN = { grass: GRASS, dirt: DIRT, water: WATER };
// coduri de tile: interior
const VOID = 0, FLOOR = 1, WALL = 2;

const FLOORS = {
  // `checker` alterneaza doua dale dupa (x+y) - arata ca o pardoseala pusa cu intentie,
  // `cells` alege la intamplare dintr-o lista - bun pentru scanduri de lemn
  marble: { img: 'floor_tile', checker: [[0, 0], [0, 2]] },
  wood: { img: 'floor_wood', cells: [[1, 0], [1, 1]] },
};
const WALLSETS = {
  stone: { img: 'wall_stone', col: 0, row: 0 },
  brick: { img: 'wall_brick', col: 0, row: 0 },
};

// ---------------------------------------------------------------- utilitare
function seededRandom(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}
function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = () => reject(new Error('Nu s-a putut încărca ' + src));
    im.src = src;
  });
}

// ---------------------------------------------------------------- stare joc
const game = {
  images: {}, maps: {}, map: null, player: null, entities: [],
  stats: { trezorerie: 1000, stabilitate: 60, hrana: 70 },
  flags: {},
  dialog: null, debug: false, hint: '', hintTimer: 0,
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

// ---------------------------------------------------------------- construirea hartilor
function makeTiles(def) {
  const t = [];
  const empty = def.kind === 'exterior' ? TERRAIN[def.base || 'grass'] : VOID;
  for (let y = 0; y < def.h; y++) t.push(new Array(def.w).fill(empty));
  const set = (x0, y0, x1, y1, v) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++)
      if (x >= 0 && y >= 0 && x < def.w && y < def.h) t[y][x] = v;
  };
  if (def.kind === 'exterior') {
    for (const [name, x0, y0, x1, y1] of (def.terrain || [])) set(x0, y0, x1, y1, TERRAIN[name]);
  } else {
    const [rx, ry, rw, rh] = def.room;
    set(rx - 1, ry - 3, rx + rw, ry + rh, WALL);     // cutia de pereti
    set(rx, ry, rx + rw - 1, ry + rh - 1, FLOOR);    // podeaua camerei
    for (const [x, y, w, h] of (def.extraFloor || [])) set(x, y, x + w - 1, y + h - 1, FLOOR);
  }
  return t;
}

// autotile pentru exterior: bloc exterior 3x3 + colturi interioare 2x2 in terrain_spring.png
const SETS = { [DIRT]: [[6, 0], [6, 3]], [WATER]: [[3, 10], [0, 13]] };
const PLAIN = {
  [GRASS]: [[3, 1], [4, 1], [5, 1], [3, 2], [4, 2], [5, 2]],
  [DIRT]: [[3, 3], [4, 3], [5, 3], [3, 4], [4, 4], [5, 4]],
  [WATER]: [[12, 16], [13, 16], [14, 16], [15, 16], [12, 17], [13, 17], [14, 17], [15, 17]],
};
function tileAt(tiles, x, y) {
  if (x < 0 || y < 0 || y >= tiles.length || x >= tiles[0].length) return GRASS;
  return tiles[y][x];
}
function grassQuadrant(tiles, x, y, q) {
  const dx = (q % 2 === 0) ? -1 : 1, dy = (q < 2) ? -1 : 1;
  const h = tileAt(tiles, x + dx, y), v = tileAt(tiles, x, y + dy), d = tileAt(tiles, x + dx, y + dy);
  const others = [h, v, d].filter(t => t !== GRASS);
  if (!others.length) return null;
  const base = others.includes(WATER) ? WATER : DIRT;
  const [[ox, oy], [ix, iy]] = SETS[base];
  if (h === GRASS && v === GRASS) return [ix + (q % 2 === 0 ? 1 : 0), iy + (q < 2 ? 1 : 0)];
  if (h !== GRASS && v !== GRASS) return [ox + (q % 2 === 0 ? 0 : 2), oy + (q < 2 ? 0 : 2)];
  if (h !== GRASS) return [ox + (q % 2 === 0 ? 0 : 2), oy + 1];
  return [ox + 1, oy + (q < 2 ? 0 : 2)];
}
// randul din foaia de perete: capat de sus / mijloc / baza (acolo unde incepe podeaua)
function wallRow(tiles, x, y) {
  const below = tileAt(tiles, x, y + 1), above = (y - 1 < 0) ? VOID : tiles[y - 1][x];
  if (below === FLOOR) return 2;
  if (above !== WALL) return 0;
  return 1;
}

function buildCanvas(def, tiles) {
  const cv = document.createElement('canvas');
  cv.width = def.w * T; cv.height = def.h * T;
  const c = cv.getContext('2d');
  const rnd = seededRandom(7);
  if (def.kind === 'exterior') {
    const ter = game.images.terrain;
    for (let y = 0; y < def.h; y++) for (let x = 0; x < def.w; x++) {
      const v = tiles[y][x];
      const p = PLAIN[v][Math.floor(rnd() * PLAIN[v].length)];
      c.drawImage(ter, p[0] * T, p[1] * T, T, T, x * T, y * T, T, T);
      if (v === GRASS) for (let q = 0; q < 4; q++) {
        const g = grassQuadrant(tiles, x, y, q);
        if (g) c.drawImage(ter, g[0] * T + (q % 2) * 16, g[1] * T + (q >> 1) * 16, 16, 16,
          x * T + (q % 2) * 16, y * T + (q >> 1) * 16, 16, 16);
      }
    }
  } else {
    const F = FLOORS[def.floor], W = WALLSETS[def.wall];
    const fimg = game.images[F.img], wimg = game.images[W.img];
    c.fillStyle = '#0b0a0e'; c.fillRect(0, 0, cv.width, cv.height);
    for (let y = 0; y < def.h; y++) for (let x = 0; x < def.w; x++) {
      const v = tiles[y][x];
      if (v === FLOOR) {
        const cell = F.checker ? F.checker[(x + y) & 1] : F.cells[Math.floor(rnd() * F.cells.length)];
        c.drawImage(fimg, cell[0] * T, cell[1] * T, T, T, x * T, y * T, T, T);
      } else if (v === WALL) {
        c.drawImage(wimg, (W.col + (x % 3)) * T, (W.row + wallRow(tiles, x, y)) * T, T, T, x * T, y * T, T, T);
      }
    }
  }
  return cv;
}

function buildMap(name) {
  const def = WORLD.maps[name];
  if (!def) throw new Error('Harta lipsă: ' + name);
  const tiles = makeTiles(def);
  const m = { name, def, tiles, canvas: buildCanvas(def, tiles), objects: [], npcs: [], portals: [] };
  for (const [type, tx, ty] of (def.objects || [])) {
    const d = OBJDEFS[type];
    if (!d) { console.warn('obiect necunoscut:', type); continue; }
    const o = { type, x: tx * T, y: ty * T, w: d.w, h: d.h, img: game.images['obj:' + type], flat: !!d.flat, anim: d.anim || null };
    if (d.col) o.col = { x: o.x + d.col[0], y: o.y + d.col[1], w: d.col[2], h: d.col[3] };
    if (d.door) o.door = { x: o.x + d.door[0], y: o.y + d.door[1], w: d.door[2], h: d.door[3] };
    if (d.walkable) o.walkable = { x: o.x + d.walkable[0], y: o.y + d.walkable[1], w: d.walkable[2], h: d.walkable[3] };
    m.objects.push(o);
  }
  for (const n of (def.npcs || [])) {
    const e = makeEntity(n.sheet, n.name, n.x, n.y, n.dir, { id: n.id, wander: n.wander || null });
    e.homeX = e.x;
    m.npcs.push(e);
  }
  for (const p of (def.portals || [])) {
    m.portals.push({
      rect: { x: p.rect[0] * T, y: p.rect[1] * T, w: p.rect[2] * T, h: p.rect[3] * T },
      to: p.to, spawn: p.spawn, dir: p.dir, label: p.label || '',
    });
  }
  return m;
}

function enterMap(name, spawn, dir) {
  const m = game.maps[name] || (game.maps[name] = buildMap(name));
  game.map = m;
  const p = game.player;
  p.x = spawn[0] * T - 16; p.y = spawn[1] * T - 32;
  if (dir != null) p.dir = dir;
  p.moving = false; p.frame = 0; p.anim = 0;
  game.entities = [p].concat(m.npcs);
  game.portalLock = true;
  game.banner = m.def.name; game.bannerTimer = 2.2;
}

// ---------------------------------------------------------------- dialog
function openDialog(npc) {
  const build = LINES[npc.id];
  if (!build) { showHint(npc.name + ' nu are nimic de spus.'); return; }
  game.dialog = { npc, lines: build(game), index: 0, choice: 0, extra: null };
  npc.dir = faceToward(npc, game.player);
}
function faceToward(a, b) {
  const dx = (b.x - a.x), dy = (b.y - a.y);
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 3 : 1;
  return dy > 0 ? 2 : 0;
}
function dialogLine() {
  const d = game.dialog; if (!d) return null;
  return d.extra || d.lines[d.index];
}
function closeOrAdvance(d) {
  d.index++;
  if (d.index >= d.lines.length) game.dialog = null;
}
function advanceDialog(choiceIndex) {
  const d = game.dialog; if (!d) return;
  const line = dialogLine();
  if (line.choices && !d.extra) {
    const c = line.choices[choiceIndex == null ? d.choice : choiceIndex];
    for (const k in (c.effect || {})) game.stats[k] = Math.max(0, game.stats[k] + c.effect[k]);
    Object.assign(game.flags, c.set || {});
    if (c.reply) { d.extra = { who: d.npc.name, text: c.reply }; return; }
    closeOrAdvance(d); return;
  }
  if (d.extra) { d.extra = null; closeOrAdvance(d); return; }
  Object.assign(game.flags, line.set || {});
  closeOrAdvance(d);
}

// ---------------------------------------------------------------- coliziuni
function solidTileAt(px, py) {
  const m = game.map, def = m.def;
  if (px < 0 || py < 0 || px >= def.w * T || py >= def.h * T) return 'edge';
  const v = m.tiles[Math.floor(py / T)][Math.floor(px / T)];
  if (def.kind === 'exterior') {
    if (v !== WATER) return null;
    for (const o of m.objects) if (o.walkable &&
      px >= o.walkable.x && px < o.walkable.x + o.walkable.w &&
      py >= o.walkable.y && py < o.walkable.y + o.walkable.h) return null;
    return 'water';
  }
  return v === FLOOR ? null : 'wall';
}
function blockedAt(box, self) {
  for (const o of game.map.objects) if (o.col && rectsOverlap(box, o.col)) return o;
  for (const e of game.entities) if (e !== self && rectsOverlap(box, feet(e))) return e;
  const corners = [[box.x, box.y], [box.x + box.w - 1, box.y],
                   [box.x, box.y + box.h - 1], [box.x + box.w - 1, box.y + box.h - 1]];
  for (const [px, py] of corners) { const s = solidTileAt(px, py); if (s) return s; }
  return null;
}
function moveEntity(e, dx, dy) {
  if (dx) { const f = feet(e); f.x += dx; if (!blockedAt(f, e)) e.x += dx; }
  if (dy) { const f = feet(e); f.y += dy; if (!blockedAt(f, e)) e.y += dy; }
}

// ---------------------------------------------------------------- actualizare
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
  const pf = feet(game.player); const pc = { x: pf.x + pf.w / 2, y: pf.y + pf.h / 2 };
  let best = null, bd = 46;
  for (const e of game.entities) if (e.npc) {
    const f = feet(e); const d = Math.hypot(f.x + f.w / 2 - pc.x, f.y + f.h / 2 - pc.y);
    if (d < bd) { bd = d; best = e; }
  }
  return best;
}
function portalUnderPlayer() {
  const f = feet(game.player);
  for (const p of game.map.portals) if (rectsOverlap(f, p.rect)) return p;
  return null;
}
function doAction() {
  if (game.dialog) { advanceDialog(); return; }
  const npc = nearestNpc();
  if (npc) { openDialog(npc); return; }
  const p = portalUnderPlayer();
  if (p && !game.pending) { game.pending = p; return; }
  for (const o of game.map.objects) if (o.door && rectsOverlap(feet(game.player), o.door)) {
    showHint('Ușa e încuiată.'); return;
  }
  showHint('Nimic aici.');
}
function showHint(t) { game.hint = t; game.hintTimer = 2.5; }

function update(dt) {
  game.time += dt;
  if (game.hintTimer > 0) game.hintTimer -= dt;
  if (game.bannerTimer > 0) game.bannerTimer -= dt;

  // trecerea dintr-o harta in alta, cu stingere / aprindere
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
    const step = p.speed * dt;
    moveEntity(p, Math.round(v.x * step * 10) / 10, Math.round(v.y * step * 10) / 10);
    p.anim += dt * 12; p.frame = 1 + Math.floor(p.anim) % 8;
  } else { p.frame = 0; p.anim = 0; }

  // personajele care se plimba pe loc
  for (const e of game.map.npcs) {
    if (!e.wander) continue;
    const target = e.homeX + Math.sin(game.time * 0.5) * e.wander.range;
    const d = target - e.x;
    if (Math.abs(d) > 0.6) {
      e.dir = d > 0 ? 3 : 1;
      moveEntity(e, Math.sign(d) * Math.min(Math.abs(d), e.wander.speed * dt), 0);
      e.anim += dt * 10; e.frame = 1 + Math.floor(e.anim) % 8;
    } else e.frame = 0;
  }

  // trecerile se declanseaza cand calci pe ele, dar nu imediat dupa ce ai sosit
  const por = portalUnderPlayer();
  if (game.portalLock) { if (!por) game.portalLock = false; }
  else if (por) game.pending = por;
}

// ---------------------------------------------------------------- randare
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
  const cx = mw <= vw ? Math.round((mw - vw) / 2) : Math.max(0, Math.min(mw - vw, Math.round(p.x + 32 - vw / 2)));
  const cy = mh <= vh ? Math.round((mh - vh) / 2) : Math.max(0, Math.min(mh - vh, Math.round(p.y + 48 - vh / 2)));
  return { x: cx, y: cy };
}
function drawEntity(e, cam) {
  ctx.drawImage(e.sheet, e.frame * 64, e.dir * 64, 64, 64, Math.round(e.x - cam.x), Math.round(e.y - cam.y), 64, 64);
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
    [0, b, b, ih - 2 * b, x, y + b, b, h - 2 * b], [b, b, iw - 2 * b, ih - 2 * b, x + b, y + b, w - 2 * b, h - 2 * b], [iw - b, b, b, ih - 2 * b, x + w - b, y + b, b, h - 2 * b],
    [0, ih - b, b, b, x, y + h - b, b, b], [b, ih - b, iw - 2 * b, b, x + b, y + h - b, w - 2 * b, b], [iw - b, ih - b, b, b, x + w - b, y + h - b, b, b],
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

const ui = { choices: [], actionBtn: null, debugBtn: null };
function drawDialog() {
  const line = dialogLine(); if (!line) return;
  const margin = 8, h = 84, w = Math.min(vw - 2 * margin, 460);
  const x = Math.round((vw - w) / 2), y = vh - h - margin;
  nineSlice(game.images.bubble, x, y, w, h, 10);
  const speaker = line.who === 'Călugărul' ? game.player : game.dialog.npc;
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
  ctx.fillStyle = 'rgba(20,16,24,0.7)'; ctx.fillRect(6, 6, 190, 20);
  ctx.fillStyle = '#f0e6d0'; ctx.font = 'bold 10px sans-serif'; ctx.textBaseline = 'top';
  ctx.fillText(`Trezorerie ${s.trezorerie}   Stabilitate ${s.stabilitate}   Hrană ${s.hrana}`, 12, 11);
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
    ctx.fillText('Vorbește (E)', Math.round(npc.x - cam.x) + 6, Math.round(npc.y - cam.y) - 6);
  } else {
    const por = portalUnderPlayer();
    if (por && !game.portalLock && por.label) {
      ctx.font = '11px sans-serif'; const tw = ctx.measureText(por.label).width + 16;
      ctx.fillStyle = 'rgba(20,16,24,0.75)'; ctx.fillRect((vw - tw) / 2, vh - 62, tw, 20);
      ctx.fillStyle = '#f0e6d0'; ctx.fillText(por.label, (vw - tw) / 2 + 8, vh - 57);
    }
  }
}
function drawControls() {
  const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
  ui.actionBtn = { x: vw - 54, y: vh - 54, r: 22 };
  ui.debugBtn = { x: vw - 26, y: 16, r: 11 };
  if (isTouch) {
    ctx.beginPath(); ctx.arc(ui.actionBtn.x, ui.actionBtn.y, ui.actionBtn.r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(240,200,110,0.55)'; ctx.fill(); ctx.strokeStyle = 'rgba(60,40,20,0.7)'; ctx.stroke();
    ctx.fillStyle = '#3a2418'; ctx.font = 'bold 12px sans-serif'; ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
    ctx.fillText('E', ui.actionBtn.x, ui.actionBtn.y); ctx.textAlign = 'left';
    const j = game.touch.joyBase;
    if (j) {
      ctx.beginPath(); ctx.arc(j.x, j.y, 34, 0, Math.PI * 2); ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fill();
      ctx.beginPath(); ctx.arc(j.x + game.touch.joyVec.x * 24, j.y + game.touch.joyVec.y * 24, 14, 0, Math.PI * 2); ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fill();
    }
  }
  ctx.beginPath(); ctx.arc(ui.debugBtn.x, ui.debugBtn.y, ui.debugBtn.r, 0, Math.PI * 2);
  ctx.fillStyle = game.debug ? 'rgba(220,80,80,0.8)' : 'rgba(20,16,24,0.5)'; ctx.fill();
  ctx.fillStyle = '#fff'; ctx.font = 'bold 11px sans-serif'; ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
  ctx.fillText('C', ui.debugBtn.x, ui.debugBtn.y); ctx.textAlign = 'left'; ctx.textBaseline = 'top';
}
function drawDebug(cam) {
  const m = game.map, def = m.def;
  ctx.lineWidth = 1;
  for (let y = 0; y < def.h; y++) for (let x = 0; x < def.w; x++) {
    const v = m.tiles[y][x];
    const solid = def.kind === 'exterior' ? v === WATER : v !== FLOOR;
    if (solid) { ctx.fillStyle = 'rgba(40,80,255,0.22)'; ctx.fillRect(x * T - cam.x, y * T - cam.y, T, T); }
  }
  for (const p of m.portals) {
    ctx.fillStyle = 'rgba(255,220,40,0.25)'; ctx.fillRect(p.rect.x - cam.x, p.rect.y - cam.y, p.rect.w, p.rect.h);
    ctx.strokeStyle = 'rgba(255,220,40,0.95)'; ctx.strokeRect(p.rect.x - cam.x + 0.5, p.rect.y - cam.y + 0.5, p.rect.w - 1, p.rect.h - 1);
  }
  for (const o of m.objects) {
    if (o.col) { ctx.strokeStyle = 'rgba(255,40,40,0.95)'; ctx.strokeRect(o.col.x - cam.x + 0.5, o.col.y - cam.y + 0.5, o.col.w - 1, o.col.h - 1); }
    if (o.door) { ctx.strokeStyle = 'rgba(255,160,40,0.95)'; ctx.strokeRect(o.door.x - cam.x + 0.5, o.door.y - cam.y + 0.5, o.door.w - 1, o.door.h - 1); }
    if (o.walkable) { ctx.strokeStyle = 'rgba(80,255,120,0.95)'; ctx.strokeRect(o.walkable.x - cam.x + 0.5, o.walkable.y - cam.y + 0.5, o.walkable.w - 1, o.walkable.h - 1); }
    ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.strokeRect(o.x - cam.x + 0.5, o.y - cam.y + 0.5, o.w - 1, o.h - 1);
  }
  for (const e of game.entities) { const f = feet(e); ctx.strokeStyle = 'rgba(60,255,60,0.95)'; ctx.strokeRect(f.x - cam.x + 0.5, f.y - cam.y + 0.5, f.w - 1, f.h - 1); }
  const p = game.player;
  ctx.fillStyle = '#fff'; ctx.font = '10px sans-serif';
  ctx.fillText(`${m.name}  obiecte: ${m.objects.length}  tile: ${Math.floor((p.x + 32) / T)},${Math.floor((p.y + 54) / T)}`, 8, 30);
}

function render() {
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.imageSmoothingEnabled = false;
  const cam = camera();
  ctx.fillStyle = '#0b0a0e'; ctx.fillRect(0, 0, vw, vh);
  ctx.drawImage(game.map.canvas, -cam.x, -cam.y);

  const visible = o => !(o.x + o.w < cam.x || o.x > cam.x + vw || o.y + o.h < cam.y || o.y > cam.y + vh);
  // covoare, torte, rafturi: fac parte din decor, se deseneaza sub personaje
  for (const o of game.map.objects) if (o.flat && visible(o)) drawObject(o, cam);
  // restul: sortate dupa marginea de jos, ca jucatorul sa treaca prin fata / prin spate
  const drawables = [];
  for (const o of game.map.objects) if (!o.flat && visible(o)) drawables.push({ z: o.y + o.h, o });
  for (const e of game.entities) drawables.push({ z: e.y + 62, e });
  drawables.sort((a, b) => a.z - b.z);
  for (const d of drawables) { if (d.o) drawObject(d.o, cam); else drawEntity(d.e, cam); }

  if (game.debug) drawDebug(cam);
  drawHud();
  if (game.dialog) drawDialog();
  drawControls();
  if (game.fade > 0) { ctx.fillStyle = `rgba(8,7,10,${game.fade})`; ctx.fillRect(0, 0, vw, vh); }
}

// ---------------------------------------------------------------- intrari
window.addEventListener('keydown', ev => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(ev.code)) ev.preventDefault();
  if (ev.repeat) return;
  game.keys[ev.code] = true;
  if (ev.code === 'KeyE' || ev.code === 'Enter' || ev.code === 'Space') doAction();
  if (ev.code === 'KeyC') game.debug = !game.debug;
  if (game.dialog) {
    const line = dialogLine();
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
  if (game.dialog) {
    for (const c of ui.choices) if (p.x >= c.x && p.x <= c.x + c.w && p.y >= c.y && p.y <= c.y + c.h) { game.dialog.choice = c.i; advanceDialog(c.i); return; }
    advanceDialog(); return;
  }
  if (hitCircle(p, ui.actionBtn)) { doAction(); return; }
  if (p.x < vw * 0.6 && game.touch.joyId === null) {
    game.touch.joyId = ev.pointerId; game.touch.joyBase = { x: p.x, y: p.y }; game.touch.joyVec = { x: 0, y: 0 };
    canvas.setPointerCapture(ev.pointerId);
  }
});
canvas.addEventListener('pointermove', ev => {
  if (ev.pointerId !== game.touch.joyId) return;
  const p = toView(ev); const b = game.touch.joyBase;
  const dx = p.x - b.x, dy = p.y - b.y; const len = Math.hypot(dx, dy);
  if (len < 6) { game.touch.joyVec = { x: 0, y: 0 }; return; }
  const m = Math.min(1, len / 30); game.touch.joyVec = { x: dx / len * m, y: dy / len * m };
});
function endJoy(ev) { if (ev.pointerId === game.touch.joyId) { game.touch.joyId = null; game.touch.joyBase = null; game.touch.joyVec = { x: 0, y: 0 }; } }
canvas.addEventListener('pointerup', endJoy); canvas.addEventListener('pointercancel', endJoy);

// ---------------------------------------------------------------- incarcare
async function loadAll() {
  const objNames = Object.keys(OBJDEFS);
  const sheets = [
    ['terrain', 'lpc-revised/Terrain/terrain_spring.png'],
    ['floor_tile', 'lpc-revised/Structure/Floor/Tile A.png'],
    ['floor_wood', 'lpc-revised/Structure/Floor/Wood Floor A.png'],
    ['wall_stone', 'lpc-revised/Structure/Walls/Jagged Stone Walls.png'],
    ['wall_brick', 'lpc-revised/Structure/Walls/Brick Wall A.png'],
    ['bubble', 'ninja-adventure/dialogue-bubble.png'],
    ['facebox', 'ninja-adventure/faceset-box.png'],
    ['monk', 'characters/monk.png'], ['emperor', 'characters/emperor.png'],
    ['guard', 'characters/guard.png'], ['villager', 'characters/villager.png'],
  ];
  const all = await Promise.all([
    ...sheets.map(([, p]) => loadImage(ASSETS + p)),
    ...objNames.map(n => loadImage(ASSETS + 'objects/' + OBJDEFS[n].file)),
  ]);
  sheets.forEach(([k], i) => game.images[k] = all[i]);
  objNames.forEach((n, i) => game.images['obj:' + n] = all[sheets.length + i]);

  const s = WORLD.start;
  game.player = makeEntity('monk', 'Călugărul', s.x, s.y, s.dir, { id: 'monk', npc: false });
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
  window.game = game; // pentru depanare si teste
  requestAnimationFrame(loop);
}).catch(err => {
  const el = document.getElementById('loading');
  if (el) el.textContent = err.message;
  console.error(err);
});
