/* Pacifer - prototip de motor (HTML5 Canvas)
 * - harta din tile-uri cu autotile (iarba / pamant / apa)
 * - strat de obiecte: fiecare obiect are sprite + cutie de coliziune (assets/objects/objects.json)
 * - personaje animate (foi LPC 4 directii x 9 cadre), sortare pe adancime (y)
 * - camera, joystick virtual + buton de actiune (Android), tastatura pe desktop
 * - dialog cu alegeri care modifica indicatorii imperiului
 * - tasta C sau butonul "C": afiseaza cutiile de coliziune
 */
'use strict';

const T = 32;
const GRASS = 0, DIRT = 1, WATER = 2;
const MAP_W = 40, MAP_H = 30;
const ASSETS = 'assets/';

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
    im.onerror = () => reject(new Error('Nu s-a putut incarca ' + src));
    im.src = src;
  });
}

// ---------------------------------------------------------------- harta
const map = [];
for (let y = 0; y < MAP_H; y++) map.push(new Array(MAP_W).fill(GRASS));
function fill(x0, y0, x1, y1, v) {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++)
    if (x >= 0 && y >= 0 && x < MAP_W && y < MAP_H) map[y][x] = v;
}
fill(33, 0, 35, MAP_H - 1, WATER);      // raul
fill(32, 0, 32, 5, WATER); fill(32, 23, 32, MAP_H - 1, WATER);
fill(0, 14, MAP_W - 1, 15, DIRT);       // drumul principal
fill(20, 8, 21, 13, DIRT);              // spre poarta palatului
fill(5, 10, 6, 13, DIRT);               // spre casa A
fill(7, 16, 8, 22, DIRT);               // spre casa B
fill(36, 16, 37, 24, DIRT);             // dincolo de rau
function tileAt(x, y) {
  if (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H) return GRASS;
  return map[y][x];
}

// autotile: bloc exterior 3x3 + colturi interioare 2x2 (in terrain_spring.png)
const SETS = { [DIRT]: [[6, 0], [6, 3]], [WATER]: [[3, 10], [0, 13]] };
const PLAIN = {
  [GRASS]: [[3, 1], [4, 1], [5, 1], [3, 2], [4, 2], [5, 2]],
  [DIRT]: [[3, 3], [4, 3], [5, 3], [3, 4], [4, 4], [5, 4]],
  [WATER]: [[12, 16], [13, 16], [14, 16], [15, 16], [12, 17], [13, 17], [14, 17], [15, 17]],
};
function grassQuadrant(x, y, q) {
  const dx = (q % 2 === 0) ? -1 : 1, dy = (q < 2) ? -1 : 1;
  const h = tileAt(x + dx, y), v = tileAt(x, y + dy), d = tileAt(x + dx, y + dy);
  const others = [h, v, d].filter(t => t !== GRASS);
  if (!others.length) return null;
  const base = others.includes(WATER) ? WATER : DIRT;
  const [[ox, oy], [ix, iy]] = SETS[base];
  if (h === GRASS && v === GRASS) return [ix + (q % 2 === 0 ? 1 : 0), iy + (q < 2 ? 1 : 0)];
  if (h !== GRASS && v !== GRASS) return [ox + (q % 2 === 0 ? 0 : 2), oy + (q < 2 ? 0 : 2)];
  if (h !== GRASS) return [ox + (q % 2 === 0 ? 0 : 2), oy + 1];
  return [ox + 1, oy + (q < 2 ? 0 : 2)];
}

// ---------------------------------------------------------------- obiecte de joc
// [tip, tileX, tileY]
const OBJECT_PLACEMENTS = [
  ['palace', 14, 2], ['houseA', 3, 3], ['houseB', 4, 19],
  ['fountain', 10, 9], ['lamp', 18, 9], ['lamp', 23, 9],
  ['crate', 12, 6], ['barrel', 13, 6], ['barrels', 11, 22],
  ['fence_h', 9, 12], ['fence_h', 12, 12], ['fence_v', 15, 9],
  ['bridge', 33, 14],
  ['tree1', 0, 0], ['tree2', 9, 0], ['tree3', 29, 0], ['tree4', 30, 4], ['tree5', 1, 12],
  ['tree6', 12, 16], ['tree1', 16, 17], ['tree2', 25, 17], ['tree3', 28, 20], ['tree4', 2, 24],
  ['tree5', 14, 24], ['tree6', 20, 25], ['tree1', 26, 25], ['tree2', 37, 4], ['tree3', 37, 26],
  ['pine1', 29, 8], ['pine2', 30, 10], ['pine1', 29, 22], ['pine2', 38, 10], ['pine1', 37, 19],
  ['bush1', 8, 8], ['bush2', 14, 11], ['bush3', 24, 12], ['bush4', 6, 17], ['bush1', 23, 20],
  ['bush2', 10, 26], ['bush3', 31, 17], ['rock', 25, 10], ['rock', 5, 26], ['rock', 18, 21],
];

// ---------------------------------------------------------------- stare joc
const game = {
  images: {}, objDefs: {}, objects: [], entities: [], player: null,
  stats: { trezorerie: 1000, stabilitate: 60, hrana: 70 },
  dialog: null, debug: false, hint: '', hintTimer: 0,
  keys: {}, touch: { joyId: null, joyBase: null, joyVec: { x: 0, y: 0 } },
  time: 0,
};

function makeEntity(name, sheet, tx, ty, dir, label) {
  return { name, sheet, x: tx * T - 16, y: ty * T - 32, dir, frame: 0, anim: 0, moving: false, speed: 110, label, npc: name !== 'monk' };
}
function feet(e) { return { x: e.x + 20, y: e.y + 46, w: 24, h: 16 }; }

// ---------------------------------------------------------------- dialoguri
const DIALOGS = {
  emperor: () => [
    { who: 'Împăratul', text: 'Frate, ce vești aduci din Valea de Jos? Perceptorii spun că țăranii nu vor să plătească darea.' },
    { who: 'Călugărul', text: 'Măria Ta, recolta le-a fost distrusă de grindină. Nu e răzvrătire, e foame. Ce hotărâm?',
      choices: [
        { text: 'Iertăm darea pe un an', effect: { trezorerie: -200, stabilitate: +10 }, reply: 'Fie. Pierdem 200 de galbeni, dar câștigăm loialitatea văii.' },
        { text: 'Cerem doar jumătate din dare', effect: { trezorerie: -100, stabilitate: +3 }, reply: 'O cale de mijloc. Vezi ca boierii să nu ia diferența de la săraci.' },
        { text: 'Darea se plătește întreagă', effect: { stabilitate: -12, hrana: -5 }, reply: 'Legea e lege. Dar dacă valea se golește, va fi vina noastră.' },
      ] },
  ],
  guard: () => [{ who: 'Gardianul', text: 'Poarta palatului se deschide doar la porunca Măriei Sale. Vorbește cu împăratul, părinte.' }],
  villager: () => [
    { who: 'Săteanul', text: 'Părinte, hambarul e pe jumătate gol. Dacă mai vin perceptorii, plecăm cu toții peste râu.' },
    { who: 'Călugărul', text: 'Voi vorbi cu împăratul. Nimeni nu va fi lăsat să flămânzească.' },
  ],
};

function openDialog(npc) {
  const lines = DIALOGS[npc.name]();
  game.dialog = { npc, lines, index: 0, choice: 0, extra: null };
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
function advanceDialog(choiceIndex) {
  const d = game.dialog; if (!d) return;
  const line = dialogLine();
  if (line.choices && !d.extra) {
    const c = line.choices[choiceIndex == null ? d.choice : choiceIndex];
    for (const k in c.effect) game.stats[k] = Math.max(0, game.stats[k] + c.effect[k]);
    d.extra = { who: 'Împăratul', text: c.reply };
    return;
  }
  if (d.extra) { d.extra = null; }
  d.index++;
  if (d.index >= d.lines.length) game.dialog = null;
}

// ---------------------------------------------------------------- incarcare
async function loadAll() {
  const defs = await (await fetch(ASSETS + 'objects/objects.json')).json();
  game.objDefs = defs;
  const names = Object.keys(defs);
  const imgs = await Promise.all([
    loadImage(ASSETS + 'lpc-revised/Terrain/terrain_spring.png'),
    loadImage(ASSETS + 'ninja-adventure/dialogue-bubble.png'),
    loadImage(ASSETS + 'ninja-adventure/faceset-box.png'),
    ...['monk', 'emperor', 'guard', 'villager'].map(n => loadImage(ASSETS + 'characters/' + n + '.png')),
    ...names.map(n => loadImage(ASSETS + 'objects/' + defs[n].file)),
  ]);
  game.images.terrain = imgs[0]; game.images.bubble = imgs[1]; game.images.facebox = imgs[2];
  ['monk', 'emperor', 'guard', 'villager'].forEach((n, i) => game.images[n] = imgs[3 + i]);
  names.forEach((n, i) => game.images['obj:' + n] = imgs[7 + i]);

  for (const [type, tx, ty] of OBJECT_PLACEMENTS) {
    const def = defs[type];
    const o = { type, x: tx * T, y: ty * T, w: def.w, h: def.h, img: game.images['obj:' + type] };
    if (def.col) o.col = { x: o.x + def.col[0], y: o.y + def.col[1], w: def.col[2], h: def.col[3] };
    if (def.door) o.door = { x: o.x + def.door[0], y: o.y + def.door[1], w: def.door[2], h: def.door[3] };
    if (def.walkable) o.walkable = { x: o.x + def.walkable[0], y: o.y + def.walkable[1], w: def.walkable[2], h: def.walkable[3] };
    game.objects.push(o);
  }
  game.player = makeEntity('monk', game.images.monk, 12, 15, 3, 'Călugărul');
  game.entities = [game.player,
    makeEntity('emperor', game.images.emperor, 17, 12, 2, 'Împăratul'),
    makeEntity('guard', game.images.guard, 22, 8, 2, 'Gardianul'),
    makeEntity('villager', game.images.villager, 10, 17, 2, 'Săteanul')];
  buildMapCanvas();
}

// harta pre-randata o singura data
let mapCanvas;
function buildMapCanvas() {
  mapCanvas = document.createElement('canvas');
  mapCanvas.width = MAP_W * T; mapCanvas.height = MAP_H * T;
  const c = mapCanvas.getContext('2d');
  const rnd = seededRandom(7);
  const ter = game.images.terrain;
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
    const v = map[y][x];
    const p = PLAIN[v][Math.floor(rnd() * PLAIN[v].length)];
    c.drawImage(ter, p[0] * T, p[1] * T, T, T, x * T, y * T, T, T);
    if (v === GRASS) for (let q = 0; q < 4; q++) {
      const g = grassQuadrant(x, y, q);
      if (g) c.drawImage(ter, g[0] * T + (q % 2) * 16, g[1] * T + (q >> 1) * 16, 16, 16, x * T + (q % 2) * 16, y * T + (q >> 1) * 16, 16, 16);
    }
  }
}

// ---------------------------------------------------------------- coliziuni
function blockedAt(box, self) {
  for (const o of game.objects) if (o.col && rectsOverlap(box, o.col)) return o;
  for (const e of game.entities) if (e !== self && rectsOverlap(box, feet(e))) return e;
  // apa (cu exceptia zonelor marcate ca podite)
  const corners = [[box.x, box.y], [box.x + box.w - 1, box.y], [box.x, box.y + box.h - 1], [box.x + box.w - 1, box.y + box.h - 1]];
  for (const [px, py] of corners) {
    if (px < 0 || py < 0 || px >= MAP_W * T || py >= MAP_H * T) return 'edge';
    if (map[Math.floor(py / T)][Math.floor(px / T)] === WATER) {
      let bridged = false;
      for (const o of game.objects) if (o.walkable && px >= o.walkable.x && px < o.walkable.x + o.walkable.w && py >= o.walkable.y && py < o.walkable.y + o.walkable.h) bridged = true;
      if (!bridged) return 'water';
    }
  }
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
  let best = null, bd = 44;
  for (const e of game.entities) if (e.npc) {
    const f = feet(e); const d = Math.hypot(f.x + f.w / 2 - pc.x, f.y + f.h / 2 - pc.y);
    if (d < bd) { bd = d; best = e; }
  }
  return best;
}
function doAction() {
  if (game.dialog) { advanceDialog(); return; }
  const npc = nearestNpc();
  if (npc) { openDialog(npc); return; }
  for (const o of game.objects) if (o.door && rectsOverlap(feet(game.player), o.door)) {
    showHint(o.type === 'palace' ? 'Interiorul palatului vine în versiunea următoare.' : 'Ușa e încuiată.'); return;
  }
  showHint('Nimic aici.');
}
function showHint(t) { game.hint = t; game.hintTimer = 2.5; }

function update(dt) {
  game.time += dt;
  if (game.hintTimer > 0) game.hintTimer -= dt;
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
  // sateanul se plimba usor stanga-dreapta
  const vil = game.entities[3];
  const targetX = (10 * T - 16) + Math.sin(game.time * 0.5) * 40;
  const ddx = targetX - vil.x;
  if (Math.abs(ddx) > 0.6) { vil.dir = ddx > 0 ? 3 : 1; moveEntity(vil, Math.sign(ddx) * Math.min(Math.abs(ddx), 40 * dt), 0); vil.anim += dt * 10; vil.frame = 1 + Math.floor(vil.anim) % 8; }
  else vil.frame = 0;
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
  const p = game.player;
  const cx = Math.max(0, Math.min(MAP_W * T - vw, Math.round(p.x + 32 - vw / 2)));
  const cy = Math.max(0, Math.min(MAP_H * T - vh, Math.round(p.y + 48 - vh / 2)));
  return { x: cx, y: cy };
}

function drawEntity(e, cam) {
  ctx.drawImage(e.sheet, e.frame * 64, e.dir * 64, 64, 64, Math.round(e.x - cam.x), Math.round(e.y - cam.y), 64, 64);
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

const ui = { choices: [], actionBtn: null, debugBtn: null, joy: null };
function drawDialog() {
  const line = dialogLine(); if (!line) return;
  const margin = 8, h = 84, w = Math.min(vw - 2 * margin, 460);
  const x = Math.round((vw - w) / 2), y = vh - h - margin;
  nineSlice(game.images.bubble, x, y, w, h, 10);
  // portret: capul personajului care vorbeste
  const speaker = line.who === 'Călugărul' ? game.player : game.dialog.npc;
  ctx.drawImage(game.images.facebox, x + 8, y + 10, 48, 48);
  ctx.drawImage(speaker.sheet, 16, 2 * 64 + 4, 32, 32, x + 12, y + 14, 40, 40);
  ctx.fillStyle = '#3a2418'; ctx.font = 'bold 11px sans-serif'; ctx.textBaseline = 'top';
  ctx.fillText(line.who, x + 64, y + 10);
  ctx.font = '11px sans-serif';
  const lines = wrapText(line.text, w - 76);
  lines.slice(0, 3).forEach((l, i) => ctx.fillText(l, x + 64, y + 24 + i * 13));
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
  if (game.hintTimer > 0 && !game.dialog) {
    ctx.font = '11px sans-serif'; const tw = ctx.measureText(game.hint).width + 16;
    ctx.fillStyle = 'rgba(20,16,24,0.75)'; ctx.fillRect((vw - tw) / 2, vh - 40, tw, 20);
    ctx.fillStyle = '#f0e6d0'; ctx.fillText(game.hint, (vw - tw) / 2 + 8, vh - 35);
  }
  const npc = game.dialog ? null : nearestNpc();
  if (npc) {
    ctx.font = '10px sans-serif'; ctx.fillStyle = '#fff';
    const cam = camera(); ctx.fillText('Vorbește (E / buton)', Math.round(npc.x - cam.x) + 4, Math.round(npc.y - cam.y) - 6);
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
  ctx.lineWidth = 1;
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) if (map[y][x] === WATER) {
    ctx.fillStyle = 'rgba(40,80,255,0.25)'; ctx.fillRect(x * T - cam.x, y * T - cam.y, T, T);
  }
  for (const o of game.objects) {
    if (o.col) { ctx.strokeStyle = 'rgba(255,40,40,0.95)'; ctx.strokeRect(o.col.x - cam.x + 0.5, o.col.y - cam.y + 0.5, o.col.w - 1, o.col.h - 1); }
    if (o.door) { ctx.strokeStyle = 'rgba(255,220,40,0.95)'; ctx.strokeRect(o.door.x - cam.x + 0.5, o.door.y - cam.y + 0.5, o.door.w - 1, o.door.h - 1); }
    if (o.walkable) { ctx.strokeStyle = 'rgba(80,255,120,0.95)'; ctx.strokeRect(o.walkable.x - cam.x + 0.5, o.walkable.y - cam.y + 0.5, o.walkable.w - 1, o.walkable.h - 1); }
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.strokeRect(o.x - cam.x + 0.5, o.y - cam.y + 0.5, o.w - 1, o.h - 1);
  }
  for (const e of game.entities) { const f = feet(e); ctx.strokeStyle = 'rgba(60,255,60,0.95)'; ctx.strokeRect(f.x - cam.x + 0.5, f.y - cam.y + 0.5, f.w - 1, f.h - 1); }
  ctx.fillStyle = '#fff'; ctx.font = '10px sans-serif';
  ctx.fillText(`obiecte: ${game.objects.length}  jucator: ${Math.round(game.player.x)},${Math.round(game.player.y)}  tile: ${Math.floor((game.player.x + 32) / T)},${Math.floor((game.player.y + 54) / T)}`, 8, 30);
}

function render() {
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.imageSmoothingEnabled = false;
  const cam = camera();
  ctx.fillStyle = '#1d1c22'; ctx.fillRect(0, 0, vw, vh);
  ctx.drawImage(mapCanvas, cam.x, cam.y, vw, vh, 0, 0, vw, vh);
  // sortare pe adancime: obiecte si personaje dupa marginea de jos
  const drawables = [];
  for (const o of game.objects) drawables.push({ z: o.walkable ? o.y : o.y + o.h, o });
  for (const e of game.entities) drawables.push({ z: e.y + 62, e });
  drawables.sort((a, b) => a.z - b.z);
  for (const d of drawables) {
    if (d.o) { const o = d.o; if (o.x + o.w < cam.x || o.x > cam.x + vw || o.y + o.h < cam.y || o.y > cam.y + vh) continue; ctx.drawImage(o.img, o.x - cam.x, o.y - cam.y); }
    else drawEntity(d.e, cam);
  }
  if (game.debug) drawDebug(cam);
  drawHud();
  if (game.dialog) drawDialog();
  drawControls();
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

function toView(ev) { const r = canvas.getBoundingClientRect(); const dpr = window.devicePixelRatio || 1; return { x: (ev.clientX - r.left) * dpr / scale, y: (ev.clientY - r.top) * dpr / scale }; }
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
  let dx = p.x - b.x, dy = p.y - b.y; const len = Math.hypot(dx, dy);
  if (len < 6) { game.touch.joyVec = { x: 0, y: 0 }; return; }
  const m = Math.min(1, len / 30); game.touch.joyVec = { x: dx / len * m, y: dy / len * m };
});
function endJoy(ev) { if (ev.pointerId === game.touch.joyId) { game.touch.joyId = null; game.touch.joyBase = null; game.touch.joyVec = { x: 0, y: 0 }; } }
canvas.addEventListener('pointerup', endJoy); canvas.addEventListener('pointercancel', endJoy);

// ---------------------------------------------------------------- bucla
let last = 0;
function loop(ts) {
  const dt = Math.min(0.05, (ts - last) / 1000 || 0); last = ts;
  update(dt); render();
  requestAnimationFrame(loop);
}
loadAll().then(() => {
  document.getElementById('loading').remove();
  window.game = game; // pentru depanare si teste
  requestAnimationFrame(loop);
}).catch(err => { document.getElementById('loading').textContent = err.message; });
