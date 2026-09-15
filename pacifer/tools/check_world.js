/* Check data/world.js against data/objects.js, before a human ever sees it.
 *
 *   node tools/check_world.js
 *
 * It catches the three mistakes that are cheap to make in a data file and
 * expensive to find by walking around the map: a name that does not exist, two
 * things drawn on top of one another, and a thing standing in a wall or a river.
 * It re-implements only the placement rules of the engine, not the engine.
 */
'use strict';
const path = require('path');
global.window = {};
require(path.join(__dirname, '..', 'data', 'objects.js'));
require(path.join(__dirname, '..', 'data', 'world.js'));
const OBJECTS = global.window.PACIFER_OBJECTS;
const WORLD = global.window.PACIFER_WORLD;

const T = 16;
const GROUND = {                       // must match game.js
  grass: 0, water: 1, stone: 2, wood: 3, earth: 4,
  rampart: 5, keepwall: 6, palisade: 7, bridge: 8,
};
const SOLID = new Set(['water', 'rampart', 'keepwall', 'palisade']);
const SOLID_ID = new Set([...SOLID].map(n => GROUND[n]));

let problems = 0;
const bad = (map, msg) => { problems++; console.log(`  [${map}] ${msg}`); };

for (const [name, def] of Object.entries(WORLD.maps)) {
  console.log(`\n--- ${name}  ${def.w}x${def.h}`);

  // ---- ground: paint it the way the engine does, so we can ask what is where.
  // Indoors there are only three codes, so VOID/WALL borrow two solid ids.
  const VOID = GROUND.rampart, FLOOR = GROUND.grass, WALL = GROUND.keepwall;
  const tiles = [], roads = [];
  const base = def.kind === 'outdoor' ? GROUND[def.base || 'grass'] : VOID;
  for (let y = 0; y < def.h; y++) {
    tiles.push(new Array(def.w).fill(base));
    roads.push(new Array(def.w).fill(0));
  }
  const paint = (grid, x0, y0, x1, y1, v) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++)
      if (x >= 0 && y >= 0 && x < def.w && y < def.h) grid[y][x] = v;
  };
  if (def.kind === 'outdoor') {
    for (const [g, x0, y0, x1, y1] of (def.ground || [])) {
      if (!(g in GROUND)) { bad(name, `unknown ground type "${g}"`); continue; }
      if (x1 < x0 || y1 < y0) bad(name, `ground "${g}" rectangle is inside out: ${[x0, y0, x1, y1]}`);
      paint(tiles, x0, y0, x1, y1, GROUND[g]);
    }
  } else {
    const [rx, ry, rw, rh] = def.room;
    paint(tiles, rx - 1, ry - 1, rx + rw, ry + rh, WALL);
    paint(tiles, rx, ry, rx + rw - 1, ry + rh - 1, FLOOR);
    for (const [x, y, w, h] of (def.extraFloor || [])) paint(tiles, x, y, x + w - 1, y + h - 1, FLOOR);
    for (const [g] of (def.patches || []))
      if (!(g in GROUND)) bad(name, `unknown patch ground "${g}"`);
  }
  for (const [x0, y0, x1, y1] of (def.roads || [])) paint(roads, x0, y0, x1, y1, 1);
  const fences = [];
  for (let y = 0; y < def.h; y++) fences.push(new Array(def.w).fill(0));
  for (const [x0, y0, x1, y1] of (def.fences || [])) paint(fences, x0, y0, x1, y1, 1);
  const open = new Set();
  for (const [x, y, w, h] of (def.gaps || []))
    for (let yy = y; yy < y + (h || 1); yy++)
      for (let xx = x; xx < x + (w || 1); xx++) open.add(xx + ',' + yy);
  const blocks = (x, y) => {
    const t = tiles[y] && tiles[y][x];
    if (t === undefined) return true;
    if (open.has(x + ',' + y)) return false;
    return !!(fences[y][x]) || SOLID_ID.has(t);
  };
  for (const k of open) {
    const [x, y] = k.split(',').map(Number);
    if (!SOLID_ID.has(tiles[y][x]) && !fences[y][x])
      bad(name, `gap at ${x},${y} is not in a wall or a fence - it opens nothing`);
  }

  // ---- objects
  const placed = [];
  for (const [type, x, y] of (def.objects || [])) {
    const d = OBJECTS[type];
    if (!d) { bad(name, `unknown object "${type}" at ${x},${y}`); continue; }
    if (x < 0 || y < 0 || x + d.w > def.w || y + d.h > def.h)
      bad(name, `${type} at ${x},${y} hangs off the edge of the map`);
    const o = { type, x, y, d, art: { x: x * T + d.art[0], y: y * T + d.art[1], w: d.art[2], h: d.art[3] } };
    // the part that reads as "standing here": the bottom of the drawing
    o.base = { x: o.art.x + 2, y: o.art.y + o.art.h * 0.5, w: o.art.w - 4, h: o.art.h * 0.5 };
    placed.push(o);

    if (def.kind === 'outdoor') {
      for (let yy = 0; yy < d.h; yy++) for (let xx = 0; xx < d.w; xx++) {
        const t = tiles[y + yy] && tiles[y + yy][x + xx];
        if (blocks(x + xx, y + yy))
          bad(name, `${type} at ${x},${y} stands in solid ground at ${x + xx},${y + yy}` +
            (fences[y + yy] && fences[y + yy][x + xx] ? ' (a fence)' : ` (${Object.keys(GROUND).find(k => GROUND[k] === t)})`));
      }
      if (d.solid !== false) for (let yy = 0; yy < d.h; yy++) for (let xx = 0; xx < d.w; xx++)
        if (roads[y + yy] && roads[y + yy][x + xx])
          bad(name, `${type} at ${x},${y} blocks the road at ${x + xx},${y + yy}`);
    }
  }
  const over = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  for (let i = 0; i < placed.length; i++) for (let j = i + 1; j < placed.length; j++) {
    const a = placed[i], b = placed[j];
    if (over(a.base, b.base))
      bad(name, `${a.type} at ${a.x},${a.y} and ${b.type} at ${b.x},${b.y} are drawn on top of each other`);
  }

  // ---- a road that runs over solid ground is a road the player cannot walk,
  // and it is drawn there too, so it reads as a lane painted across a river
  const fords = [];
  for (let y = 0; y < def.h; y++) for (let x = 0; x < def.w; x++)
    if (roads[y][x] && blocks(x, y))
      fords.push([x, y, fences[y][x] ? 'a fence' : Object.keys(GROUND).find(k => GROUND[k] === tiles[y][x])]);
  if (fords.length) {
    // report them as runs, not as 60 separate lines
    const runs = [];
    for (const [x, y, g] of fords) {
      const last = runs[runs.length - 1];
      if (last && last.g === g && last.x === x && last.y2 === y - 1) last.y2 = y;
      else runs.push({ x, y1: y, y2: y, g });
    }
    for (const r of runs)
      bad(name, `the road fords ${r.g} at x ${r.x}, y ${r.y1}..${r.y2} - it needs a crossing or it should stop short`);
  }

  // ---- a wanderer must be able to walk its whole beat
  for (const n of (def.npcs || [])) {
    if (!n.wander) continue;
    const y = n.y;
    for (let x = n.x - Math.ceil(n.wander.range / T); x <= n.x + Math.ceil(n.wander.range / T); x++) {
      const t = tiles[y] && tiles[y][x];
      const stuck = blocks(x, y) ||
        placed.some(o => o.d.solid !== false && x >= o.x && x < o.x + o.d.w && y >= o.y && y < o.y + o.d.h);
      if (stuck) { bad(name, `${n.id} wanders into something solid at ${x},${y}`); break; }
    }
  }

  // ---- a door the player can never touch is a line of dialogue that never fires
  for (const o of placed) {
    if (!o.d.door) continue;
    const [dx, dy, dw, dh] = o.d.door;
    const boxes = o.d.cols || (o.d.col ? [o.d.col] : []);
    const inside = boxes.some(c => dx >= c[0] && dy >= c[1] &&
      dx + dw <= c[0] + c[2] && dy + dh <= c[1] + c[3]);
    if (inside) bad(name, `${o.type} at ${o.x},${o.y} has a door buried inside its own collision box - it can never be reached`);
  }

  // ---- npcs and portals stand somewhere you can be
  for (const n of (def.npcs || [])) {
    const t = tiles[n.y] && tiles[n.y][n.x];
    if (t === undefined) { bad(name, `npc ${n.id} at ${n.x},${n.y} is off the map`); continue; }
    if (blocks(n.x, n.y)) bad(name, `npc ${n.id} at ${n.x},${n.y} stands in solid ground`);
    const on = placed.find(o => o.d.solid !== false &&
      n.x >= o.x && n.x < o.x + o.d.w && n.y >= o.y && n.y < o.y + o.d.h);
    if (on) bad(name, `npc ${n.id} at ${n.x},${n.y} stands inside ${on.type}`);
  }
  for (const p of (def.portals || [])) {
    const [px, py, pw, ph] = p.rect;
    if (!WORLD.maps[p.to]) { bad(name, `portal points at "${p.to}", which is not a map`); continue; }
    let standable = 0;
    for (let y = py; y < py + ph; y++) for (let x = px; x < px + pw; x++) {
      const t = tiles[y] && tiles[y][x];
      const blocked = blocks(x, y) ||
        placed.some(o => o.d.solid !== false && x >= o.x && x < o.x + o.d.w && y >= o.y && y < o.y + o.d.h);
      if (!blocked) standable++;
    }
    if (!standable) bad(name, `portal to ${p.to} at ${p.rect} cannot be stood on`);
    const dest = WORLD.maps[p.to];
    if (p.spawn[0] < 0 || p.spawn[1] < 0 || p.spawn[0] >= dest.w || p.spawn[1] >= dest.h)
      bad(name, `portal to ${p.to} spawns at ${p.spawn}, off that map`);
  }
  for (const g of (def.groves || [])) {
    if (g.on && !(g.on in GROUND)) bad(name, `grove scatters on unknown ground "${g.on}"`);
    for (const t of g.types) if (!OBJECTS[t]) bad(name, `grove scatters unknown object "${t}"`);
  }
  console.log(`  ${placed.length} objects, ${(def.npcs || []).length} npcs, ${(def.portals || []).length} portals`);
}

console.log(problems ? `\n${problems} problem(s)` : '\nno problems');
process.exit(problems ? 1 : 0);
