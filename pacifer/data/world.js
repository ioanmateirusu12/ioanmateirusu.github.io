/* Pacifer - definitia lumii. Fisier de date, se editeaza cu mana.
 *
 * Coordonatele sunt in TILE-uri (1 tile = 32 px) si pot fi fractionare.
 * Fiecare harta are `kind`:
 *   'exterior' - teren din iarba/pamant/apa, marginile se autotileaza
 *   'interior' - o camera dreptunghiulara: `room` = podeaua, peretii se
 *                genereaza automat in jur; `extraFloor` taie usi / coridoare
 *
 * objects : [tip, x, y]           - tipurile sunt cheile din data/objects.js
 * npcs    : { id, sheet, name, x, y, dir, wander? }
 *           dir: 0 sus, 1 stanga, 2 jos, 3 dreapta
 * portals : { rect:[x,y,w,h], to:'harta', spawn:[x,y], dir, label }
 *           se declanseaza cand jucatorul calca in dreptunghi
 */
window.PACIFER_WORLD = {
  start: { map: 'sat', x: 12, y: 15, dir: 2 },

  maps: {
    // ------------------------------------------------------------- satul
    sat: {
      name: 'Valea de Jos',
      kind: 'exterior',
      w: 40, h: 30,
      base: 'grass',
      // [teren, x0, y0, x1, y1] - inclusiv
      terrain: [
        ['water', 33, 0, 35, 29],
        ['water', 32, 0, 32, 5], ['water', 32, 23, 32, 29],
        ['dirt', 0, 14, 39, 15],   // drumul principal
        ['dirt', 20, 8, 21, 13],   // spre poarta palatului
        ['dirt', 5, 10, 6, 13],    // spre casa cu caramida
        ['dirt', 7, 16, 8, 22],    // spre casa taraneasca
        ['dirt', 36, 16, 37, 24],  // dincolo de rau
      ],
      objects: [
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
      ],
      npcs: [
        { id: 'guard_gate', sheet: 'guard', name: 'Gardianul', x: 22, y: 9, dir: 2 },
        { id: 'villager', sheet: 'villager', name: 'Săteanul', x: 10, y: 17, dir: 2,
          wander: { axis: 'x', range: 40, speed: 40 } },
      ],
      portals: [
        { rect: [20, 8, 2, 1], to: 'palat', spawn: [9.5, 15], dir: 0, label: 'Palatul imperial' },
        { rect: [5, 10, 1, 1], to: 'casaA', spawn: [6.5, 10], dir: 0, label: 'Casa negustorului' },
        { rect: [7.5, 24, 1, 1], to: 'casaB', spawn: [5.5, 9], dir: 0, label: 'Casa bătrânului' },
      ],
    },

    // --------------------------------------------------- sala tronului
    palat: {
      name: 'Sala tronului',
      kind: 'interior',
      w: 20, h: 18,
      room: [2, 4, 16, 10],
      floor: 'marble', wall: 'stone',
      extraFloor: [[9, 14, 2, 2]],   // coridorul de iesire
      objects: [
        ['rug', 7.5, 8],
        ['throne', 9, 5], ['pillar', 7, 5], ['pillar', 11, 5],
        ['pillar', 4, 8], ['pillar', 4, 12], ['pillar', 15, 8], ['pillar', 15, 12],
        ['fireplace', 14, 1], ['shelf', 3, 2],
        ['torch', 5, 2], ['torch', 13, 2], ['torch', 1, 7], ['torch', 18, 7],
        ['torch', 1, 11], ['torch', 18, 11],
        ['table_big', 13, 6], ['chair', 13, 5], ['chair2', 15, 5],
        ['chest', 2, 12], ['barrel', 3, 11], ['crate', 16, 11],
      ],
      npcs: [
        { id: 'emperor', sheet: 'emperor', name: 'Împăratul', x: 9, y: 7, dir: 2 },
        { id: 'guard_hall', sheet: 'guard', name: 'Garda palatului', x: 6, y: 12, dir: 3 },
      ],
      portals: [
        { rect: [9, 15, 2, 1], to: 'sat', spawn: [20.5, 9.6], dir: 2, label: 'Afară' },
      ],
    },

    // ------------------------------------------------ casa negustorului
    casaA: {
      name: 'Casa negustorului',
      kind: 'interior',
      w: 14, h: 13,
      room: [2, 3, 10, 6],
      floor: 'wood', wall: 'brick',
      extraFloor: [[6, 9, 2, 2]],
      objects: [
        ['fireplace', 8, 0], ['shelf', 3, 1], ['torch', 2, 1],
        ['table_big', 3, 5], ['chair', 3, 4], ['chair2', 5, 4],
        ['chest', 10, 4], ['barrel', 11, 6], ['crate', 2, 6], ['barrels', 9, 7],
      ],
      npcs: [
        { id: 'negustor', sheet: 'villager', name: 'Negustorul', x: 8, y: 5, dir: 2 },
      ],
      portals: [
        { rect: [6, 10, 2, 1], to: 'sat', spawn: [5.5, 11], dir: 2, label: 'Afară' },
      ],
    },

    // -------------------------------------------------- casa bătrânului
    casaB: {
      name: 'Casa bătrânului',
      kind: 'interior',
      w: 12, h: 12,
      room: [2, 3, 8, 5],
      floor: 'wood', wall: 'brick',
      extraFloor: [[5, 8, 1, 2]],
      objects: [
        ['fireplace', 2, 0], ['torch', 8, 1],
        ['table_big', 6, 4], ['chair', 6, 3],
        ['chest', 2, 6], ['barrel', 9, 4], ['crate', 9, 6],
      ],
      npcs: [
        { id: 'batranul', sheet: 'villager', name: 'Bătrânul', x: 4, y: 5, dir: 3 },
      ],
      portals: [
        { rect: [5, 9, 1, 1], to: 'sat', spawn: [7.5, 25], dir: 2, label: 'Afară' },
      ],
    },
  },
};
