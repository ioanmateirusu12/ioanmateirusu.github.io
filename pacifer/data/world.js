/* Pacifer - the world. A data file, meant to be edited by hand.
 *
 * Coordinates are in TILES (1 tile = 32 px) and may be fractional.
 * Every map has a `kind`:
 *   'outdoor' - grass / dirt / sand / stone / water, edges auto-tile themselves
 *   'indoor'  - one rectangular room: `room` is the floor, the walls are built
 *               around it, `extraFloor` cuts doorways and corridors through them
 *
 * ground  : [type, x0, y0, x1, y1]   inclusive rectangles, painted in order
 * objects : [type, x, y]             types are the keys of data/objects.js
 * groves  : { types, rect:[x,y,w,h], count, seed }
 *           scatters trees and the like over a rectangle, skipping roads,
 *           water and anything already standing there
 * npcs    : { id, sheet, name, x, y, dir, wander? }   dir: 0 up 1 left 2 down 3 right
 * portals : { rect:[x,y,w,h], to, spawn:[x,y], dir, label }
 *           fires when the player steps into the rectangle
 *
 * The realm from north to south: the royal castle on its paved height, the
 * capital with its market square below it, then farmland, the river and the
 * forest. One road runs the whole length of it, straight through the castle gate.
 */
window.PACIFER_WORLD = {
  playerName: 'Brother Pacifer',
  start: { map: 'realm', x: 49, y: 44, dir: 0 },

  maps: {
    // ============================================================= the realm
    realm: {
      name: 'Aurelia, the royal capital',
      kind: 'outdoor',
      w: 100, h: 76,
      base: 'grass',
      scatter: 0.08,

      ground: [
        // the castle stands on a paved height at the north end; the courtyard
        // is left unbroken, so the road starts where the paving ends
        ['stone', 30, 1, 71, 19],
        // the great road, from the south of the realm up to the castle gate
        ['dirt', 48, 20, 49, 75],
        // the east-west road through the capital
        ['dirt', 8, 40, 92, 41],
        // lanes to the western and eastern quarters
        ['dirt', 26, 24, 27, 40], ['dirt', 70, 24, 71, 40],
        ['dirt', 26, 24, 40, 25], ['dirt', 58, 24, 71, 25],
        // the market square, laid either side of the road rather than across it
        ['stone', 38, 29, 47, 38], ['stone', 50, 29, 60, 38],
        // the river: grass runs right down to the water, so the banks blend
        ['water', 0, 57, 99, 59],
        // the mill pond in the south-west
        ['water', 9, 66, 19, 71],
        // the ploughed fields east of the road, one block so the edges blend
        ['dirt', 62, 63, 78, 73],
      ],

      objects: [
        // ---- the castle: keep, curtain wall, gatehouse, corner towers
        // the wall runs unbroken from tower to gate to tower
        ['keep', 41, 3],
        ['tower', 31, 11], ['tower', 67, 11],
        ['wall_h', 34, 14], ['wall_h', 37, 14], ['wall_h', 40, 14], ['wall_h', 43, 14],
        ['gate', 46, 13],
        ['wall_h', 52, 14], ['wall_h', 55, 14], ['wall_h', 58, 14], ['wall_h', 61, 14],
        ['wall_h', 64, 14],
        // the processional way from the gate to the keep door
        ['lamp', 46, 12], ['lamp', 51, 12], ['lamp', 46, 18], ['lamp', 51, 18],
        ['rail_v', 45, 8], ['rail_v', 45, 12], ['rail_v', 52, 8], ['rail_v', 52, 12],
        ['sign', 47, 19], ['sign', 50, 19],
        // the western garden
        ['trellis', 33, 4], ['trellis', 37, 4], ['fountain', 35, 9],
        ['rail_h', 32, 12], ['rail_h', 35, 12], ['rail_h', 38, 12],
        ['bush1', 33, 8], ['bush3', 38, 8], ['bush2', 32, 10], ['bush4', 39, 10],
        ['chair', 34, 11], ['chair2', 37, 11],
        // the eastern garden and the stores against the wall
        ['trellis', 60, 4], ['trellis', 64, 4], ['fountain', 62, 9],
        ['rail_h', 59, 12], ['rail_h', 62, 12], ['rail_h', 65, 12],
        ['bush2', 60, 8], ['bush4', 65, 8], ['bush1', 59, 10], ['bush3', 66, 10],
        ['barrel', 68, 12], ['crate', 69, 12], ['barrels', 58, 12],
        ['haystack', 68, 8], ['basket', 59, 6], ['basket', 66, 6],

        // ---- the capital: the market square
        ['stall', 39, 27], ['stall', 43, 27], ['stall', 52, 27], ['stall', 56, 27],
        ['fountain', 43, 33], ['fountain', 54, 33],
        ['basket', 42, 32], ['basket', 46, 32], ['basket', 53, 32], ['crate', 57, 32],
        ['barrel', 40, 36], ['barrels', 56, 36],
        ['lamp', 39, 36], ['lamp', 58, 36],

        // ---- the capital: houses along the streets
        ['houseA', 30, 26], ['houseB', 38, 20], ['houseB', 56, 20], ['houseA', 60, 26],
        ['houseA', 28, 43], ['houseB', 38, 44], ['houseB', 56, 44], ['houseA', 62, 43],
        ['houseB', 18, 34], ['houseB', 76, 34],
        ['lamp', 46, 22], ['lamp', 51, 22], ['lamp', 46, 43], ['lamp', 51, 43],
        ['fence_h', 36, 31], ['fence_h', 61, 31],

        // ---- the river crossing
        ['bridge', 47, 57], ['bridge', 47, 58],
        ['bridge', 18, 57], ['bridge', 18, 58],
        ['sign', 47, 55], ['sign', 50, 60],

        // ---- the mill and the pond
        ['houseB', 22, 66], ['haystack', 27, 68], ['barrel', 21, 71], ['basket', 26, 72],

        // ---- the farms east of the road
        ['houseA', 82, 62], ['haystack', 80, 67], ['haystack', 80, 71],
        ['fence_h', 62, 62], ['fence_h', 65, 62], ['fence_h', 68, 62], ['fence_h', 71, 62],
        ['fence_h', 74, 62], ['fence_h', 62, 74], ['fence_h', 65, 74], ['fence_h', 68, 74],
        ['fence_h', 71, 74], ['fence_h', 74, 74],
        ['fence_v', 61, 63], ['fence_v', 61, 66], ['fence_v', 61, 69], ['fence_v', 61, 72],
        ['fence_v', 78, 63], ['fence_v', 78, 66], ['fence_v', 78, 69], ['fence_v', 78, 72],
        ['basket', 63, 66], ['basket', 70, 70], ['crate', 75, 64],
        ['haystack', 64, 70], ['haystack', 72, 64],

        // ---- the southern hamlet
        ['houseB', 34, 66], ['houseB', 40, 70], ['haystack', 38, 66],
        ['barrel', 33, 71], ['crate', 44, 68],
      ],

      groves: [
        // the king's wood, west of the capital
        { types: ['tree1', 'tree2', 'tree3', 'pine1', 'pine2'], rect: [1, 20, 22, 18], count: 70, seed: 11 },
        // the eastern forest
        { types: ['tree4', 'tree5', 'tree6', 'pine1'], rect: [78, 18, 21, 22], count: 70, seed: 23 },
        // woods along the southern border
        { types: ['tree1', 'tree4', 'tree6', 'pine2'], rect: [1, 62, 6, 13], count: 26, seed: 31 },
        { types: ['tree2', 'tree5', 'pine1'], rect: [84, 42, 15, 12], count: 40, seed: 37 },
        // hedgerows and scrub across the open country
        { types: ['bush1', 'bush2', 'bush3', 'bush4', 'rock'], rect: [2, 42, 96, 13], count: 90, seed: 43 },
        { types: ['bush1', 'bush3', 'rock'], rect: [24, 61, 34, 14], count: 34, seed: 47 },
        { types: ['bush2', 'bush4', 'rock'], rect: [82, 61, 16, 14], count: 18, seed: 61 },
        { types: ['tree3', 'tree5', 'pine2'], rect: [24, 2, 4, 16], count: 14, seed: 53 },
        { types: ['tree1', 'tree6', 'pine1'], rect: [73, 2, 5, 16], count: 16, seed: 59 },
      ],

      npcs: [
        { id: 'gate_guard', sheet: 'guard', name: 'Gate Guard', x: 45, y: 19, dir: 2 },
        { id: 'marshal', sheet: 'marshal', name: 'Marshal Aldric', x: 53, y: 19, dir: 2 },
        { id: 'market_woman', sheet: 'villager', name: 'Market Trader', x: 45, y: 34, dir: 2,
          wander: { range: 48, speed: 34 } },
        { id: 'farmer', sheet: 'villager', name: 'Farmer Odo', x: 66, y: 66, dir: 2,
          wander: { range: 56, speed: 30 } },
        { id: 'miller', sheet: 'villager', name: 'The Miller', x: 25, y: 70, dir: 3 },
      ],

      portals: [
        { rect: [48, 12, 2, 1], to: 'throne_hall', spawn: [11.5, 17], dir: 0, label: 'The keep' },
        { rect: [32, 33, 1, 1], to: 'merchant_house', spawn: [6.5, 10], dir: 0, label: "Merchant's house" },
        { rect: [41.5, 49, 1, 1], to: 'elder_house', spawn: [5.5, 9], dir: 0, label: "Steward's house" },
      ],
    },

    // ======================================================= the throne hall
    throne_hall: {
      name: 'The throne hall',
      kind: 'indoor',
      w: 24, h: 20,
      room: [2, 4, 20, 12],
      floor: 'marble', wall: 'stone',
      extraFloor: [[11, 16, 2, 2]],
      objects: [
        ['dais', 10, 4], ['throne', 11, 4],
        ['rug', 9.5, 8], ['rug', 9.5, 10],
        ['pillar', 8, 5], ['pillar', 14, 5],
        ['pillar', 5, 8], ['pillar', 5, 12], ['pillar', 17, 8], ['pillar', 17, 12],
        ['fireplace', 18, 1], ['shelf', 3, 2], ['cabinet', 3, 4],
        ['torch', 6, 2], ['torch', 16, 2], ['torch', 1, 7], ['torch', 22, 7],
        ['torch', 1, 12], ['torch', 22, 12],
        ['table_big', 17, 11], ['chair', 17, 10], ['chair2', 19, 10],
        ['chest', 3, 14], ['barrel', 4, 13], ['crate', 20, 14],
      ],
      npcs: [
        { id: 'emperor', sheet: 'emperor', name: 'The King', x: 11, y: 7, dir: 2 },
        { id: 'steward', sheet: 'steward', name: 'Steward Balan', x: 15, y: 9, dir: 1 },
        { id: 'hall_guard', sheet: 'guard', name: 'Hall Guard', x: 7, y: 14, dir: 3 },
      ],
      portals: [
        { rect: [11, 17, 2, 1], to: 'realm', spawn: [49, 13.6], dir: 2, label: 'Out to the courtyard' },
      ],
    },

    // ==================================================== the merchant's house
    merchant_house: {
      name: "The merchant's house",
      kind: 'indoor',
      w: 14, h: 13,
      room: [2, 3, 10, 6],
      floor: 'wood', wall: 'brick',
      extraFloor: [[6, 9, 2, 2]],
      objects: [
        ['fireplace', 8, 0], ['shelf', 3, 1], ['torch', 2, 1],
        ['cauldron', 9, 3],
        ['table_big', 3, 5], ['chair', 3, 4], ['chair2', 5, 4],
        ['chest', 10, 4], ['barrel', 11, 6], ['crate', 2, 6], ['barrels', 9, 7],
        ['basket', 4, 7], ['cabinet', 11, 3],
      ],
      npcs: [
        { id: 'merchant', sheet: 'villager', name: 'Master Vaso', x: 8, y: 5, dir: 2 },
      ],
      portals: [
        { rect: [6, 10, 2, 1], to: 'realm', spawn: [32.5, 34], dir: 2, label: 'Out' },
      ],
    },

    // ===================================================== the steward's house
    elder_house: {
      name: "The steward's town house",
      kind: 'indoor',
      w: 12, h: 12,
      room: [2, 3, 8, 5],
      floor: 'wood', wall: 'brick',
      extraFloor: [[5, 8, 1, 2]],
      objects: [
        ['fireplace', 2, 0], ['torch', 8, 1], ['cauldron', 3, 3],
        ['table_big', 6, 4], ['chair', 6, 3],
        ['chest', 2, 6], ['barrel', 9, 4], ['crate', 9, 6], ['cabinet', 5, 3],
      ],
      npcs: [
        { id: 'old_soldier', sheet: 'guard', name: 'Old Sergeant', x: 4, y: 5, dir: 3 },
      ],
      portals: [
        { rect: [5, 9, 1, 1], to: 'realm', spawn: [42, 50], dir: 2, label: 'Out' },
      ],
    },
  },
};
