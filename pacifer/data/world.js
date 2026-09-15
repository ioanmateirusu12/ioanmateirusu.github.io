/* Pacifer - the world. A data file, meant to be edited by hand.
 *
 * Coordinates are in TILES of 16 px. A person is one tile tall, so these numbers
 * read almost as paces: it is about 120 paces from the river abbey to the gate.
 *
 * ground  : [type, x0, y0, x1, y1]  inclusive rectangles, painted in order.
 *           grass (the base everything sits on), stone, wood, water, earth, and
 *           the three wall kits - rampart, keepwall, palisade. A wall works out
 *           its own corners, crenellations and foundation course, so a rectangle
 *           ONE TILE THICK is a wall and a rectangle one tile HIGH is a fence.
 * roads   : [x0, y0, x1, y1]        a separate layer, drawn over the ground, so a
 *           lane can cross the market square without cutting the paving in two
 * gaps    : [x, y, w, h]            wall tiles the player may walk through
 * objects : [type, x, y]            from data/objects.js
 * groves  : { types, rect:[x,y,w,h], count, seed }
 *           scatters trees over a rectangle, skipping roads, water and anything
 *           already standing there, so a wood is one line instead of five hundred
 * npcs    : { id, sheet, name, x, y, dir, wander? }  dir: 0 up 1 left 2 down 3 right
 * portals : { rect:[x,y,w,h], to, spawn:[x,y], dir, label }
 *
 * How the realm is laid out, and why. The player walks one spine from south to
 * north: the river abbey he came from, the failing crossing, open country, the
 * capital's market square, the castle gate. Every stage has one thing in it worth
 * looking at. The great road is the only road that runs the whole way; every lane
 * off it ends somewhere you can see from the junction.
 */
window.PACIFER_WORLD = {
  playerName: 'Brother Pacifer',
  start: { map: 'realm', sheet: 'monk', x: 110, y: 150, dir: 0 },

  maps: {
    // ============================================================= the realm
    realm: {
      name: 'Aurelia, the royal capital',
      kind: 'outdoor',
      w: 220, h: 170,
      base: 'grass',

      ground: [
        // ---- THE CASTLE -------------------------------------------------
        // Inside the wall the ground is NOT one slab of paving. A paved avenue
        // runs from the arch to the keep door, with a broad apron at each end;
        // either side of it is the queen's lawn and the working yard. Each paved
        // band is six tiles or more, because the paving draws an outline round
        // itself and a band only three wide is all outline and no middle.
        ['stone', 103, 11, 117, 39],
        ['stone', 85, 11, 135, 16], ['stone', 85, 34, 135, 39],
        ['grass', 85, 17, 102, 33],
        ['earth', 118, 17, 135, 33],
        // the curtain wall, one tile thick. The south run stops either side of
        // x 109-110, which is exactly the two tiles the gatehouse stands on.
        ['rampart', 84, 10, 136, 10],
        ['rampart', 84, 10, 84, 40], ['rampart', 136, 10, 136, 40],
        ['rampart', 84, 40, 108, 40], ['rampart', 111, 40, 136, 40],
        // the stables: two roofless stone compounds against the east wall
        ['keepwall', 123, 19, 131, 23], ['wood', 124, 20, 130, 22],
        ['keepwall', 123, 27, 131, 31], ['wood', 124, 28, 130, 30],

        // ---- THE GATE APRON ---------------------------------------------
        ['stone', 105, 41, 115, 47],

        // ---- THE CAPITAL -------------------------------------------------
        // The square is seventeen tiles across - about what fits on a screen -
        // because a square you cannot see across is not a square, it is a field
        // with some tents on it. The houses stand on their own paving, close
        // enough that the square has a built edge on all four sides.
        ['stone', 102, 60, 118, 76],
        // the houses stand on grass inside a ring lane, not on a ribbon of
        // paving: the green between them is what stops the town centre reading
        // as one flat slab of tan

        // ---- THE RIVER ---------------------------------------------------
        // it does not run straight: grass bites break the line
        ['water', 0, 128, 219, 133],
        ['grass', 30, 128, 52, 128], ['grass', 70, 128, 88, 128],
        ['grass', 140, 133, 168, 133],
        ['water', 18, 142, 46, 162],
        ['grass', 18, 142, 24, 144], ['grass', 40, 142, 46, 146],
        ['grass', 18, 158, 22, 162], ['grass', 42, 156, 46, 162],
        ['grass', 30, 160, 38, 162],
        // the crossing: one rectangle of bridge, which draws its own rails and
        // its own abutments. This is the bridge the King is told is rotting, so
        // it is the one the player walks over on the way to tell him.
        ['bridge', 109, 126, 111, 135],

        // ---- THE FIELDS --------------------------------------------------
        // ploughed in strips with a grass balk between each, the way a field
        // that is actually worked looks from above
        ['earth', 148, 138, 192, 142], ['earth', 148, 145, 192, 149],
        ['earth', 148, 152, 192, 156], ['earth', 148, 159, 175, 160],
        // ---- THE RIVER ABBEY ---------------------------------------------
        ['stone', 100, 150, 120, 166],
        ['grass', 103, 157, 117, 164],
      ],

      // fences: a separate layer, like roads, so a hedge line can follow the
      // edge of a field without owning the ground under it
      fences: [
        // the castle: the queen's lawn west, the working yard east, each with
        // one gateway onto the avenue
        [86, 17, 102, 17], [86, 33, 102, 33], [86, 17, 86, 33],
        [102, 17, 102, 23], [102, 26, 102, 33],
        [118, 17, 135, 17], [118, 33, 135, 33], [135, 17, 135, 33],
        [118, 17, 118, 23], [118, 26, 118, 33],
        // the ploughed fields, gateway on the lane from the great road
        [147, 137, 193, 137], [147, 161, 193, 161],
        [147, 137, 147, 161], [193, 137, 193, 161],
        // the abbey close, gateway on the great road
        [99, 149, 121, 149],
        [99, 149, 99, 166], [121, 149, 121, 166],
        // the mill yard and the two farmsteads, so the country is not all open
        [46, 149, 58, 149], [46, 149, 46, 161], [46, 161, 58, 161],
        [192, 141, 202, 141], [202, 141, 202, 152],
      ],

      // the gateways: fence or wall to look at, open to walk through
      gaps: [[147, 144, 1, 1], [110, 149, 1, 1], [52, 149, 1, 1], [202, 144, 1, 1]],

      roads: [
        // the great road, abbey to castle gate. Its plank bridge over the river
        // is the ONLY crossing in the realm - which is why a rotting bridge is
        // worth a King's attention, and why every other lane stops at the bank.
        [110, 41, 110, 59], [110, 77, 110, 125], [110, 136, 110, 166],
        // the east-west highway along the north bank, and the lanes off it
        [20, 100, 200, 100],
        [60, 59, 60, 100], [160, 59, 160, 100],
        [40, 100, 40, 126], [170, 100, 170, 126],
        // south of the river, both lanes leave the great road instead
        [52, 146, 110, 146], [52, 146, 52, 156],
        [110, 144, 170, 144], [170, 144, 170, 150],
        // the town's two side streets, which end at the square
        // the ring lane round the square, which every street in the town ends on
        [93, 59, 127, 59], [93, 77, 127, 77],
        [93, 59, 93, 77], [127, 59, 127, 77],
        [93, 68, 102, 68], [118, 68, 127, 68],
        [60, 59, 93, 59], [127, 59, 160, 59],
        // the castle approach forks round the gate apron
        [104, 48, 116, 48], [104, 48, 104, 59], [116, 48, 116, 59],
      ],

      objects: [
        // ================================================ the castle
        ['keep', 109, 12],
        ['gate_tower', 109, 38],
        ['watchtower', 85, 11], ['watchtower', 135, 11],
        ['watchtower', 85, 37], ['watchtower', 135, 37],
        // the walk from the arch to the keep door is about twenty paces, so that
        // arriving at the King's hall feels like arriving somewhere
        ['statue', 106, 20], ['statue', 114, 20],
        ['statue', 106, 26], ['statue', 114, 26],
        ['statue', 106, 32], ['statue', 114, 32],
        ['sign', 107, 42], ['sign', 113, 42],
        ['campfire', 105, 18], ['campfire', 115, 18],
        ['campfire', 105, 36], ['campfire', 115, 36],
        ['tree_big', 104, 22], ['tree_big', 115, 22],
        ['tree_big', 104, 29], ['tree_big', 115, 29],
        ['fountain_tall', 109, 35], ['fountain_tall', 111, 35],
        // the queen's garden. Nothing in here is mirrored on the other side.
        ['tree_big', 88, 19], ['tree_big', 96, 19], ['tree_big', 88, 30],
        ['tree', 92, 22], ['tree', 96, 25], ['tree', 90, 27],
        ['fountain', 94, 26], ['shrine', 97, 30],
        ['table', 92, 30], ['chair', 91, 30], ['chair', 93, 30],
        ['bush', 89, 24], ['bush', 99, 22], ['bush', 99, 29],
        // the working yard: bare earth, gear stacked between the two stables
        ['cart', 120, 19], ['barrel', 121, 20], ['crate', 120, 21],
        ['campfire', 121, 25], ['crate', 119, 25], ['barrel', 119, 26],
        ['cart', 120, 30], ['crate', 121, 31], ['barrel', 132, 25],
        ['pen', 132, 19], ['pen', 133, 19], ['pen', 132, 20], ['pen', 133, 20],
        ['cart', 132, 30], ['crate', 133, 31],

        // ================================================ the capital
        // The square reads from the middle out: the market cross at the centre,
        // two fountains beside it, then the stall rows, then the houses. The
        // west stalls are stocked and the east ones stand bare, so the trader's
        // line about half-empty stalls is something you can see before she says it.
        ['statue', 110, 67],
        ['fountain', 108, 68], ['fountain', 112, 68],
        ['sign', 110, 61], ['sign', 110, 75],
        // west stalls: full
        ['tent', 103, 62], ['tent', 106, 62],
        ['cart', 103, 64], ['table', 105, 64], ['barrel', 107, 64],
        ['tent', 103, 71], ['tent', 106, 71],
        ['table', 103, 73], ['crate', 105, 73], ['barrel', 107, 73],
        // east stalls: bare boards
        ['tent', 114, 62], ['tent', 117, 62],
        ['table', 114, 64], ['table', 117, 64],
        ['tent', 114, 71],
        ['table', 114, 73], ['cart', 117, 73],
        // the drovers keep their pens and their fires on the earth either side
        ['pen', 95, 64], ['pen', 96, 64], ['pen', 95, 65], ['pen', 96, 65],
        ['pen', 124, 64], ['pen', 125, 64], ['pen', 124, 65], ['pen', 125, 65],
        ['campfire', 95, 70], ['campfire', 125, 70],
        ['barrel', 104, 65], ['crate', 116, 65],
        // the two rows of houses that face the square
        ['house_red', 97, 61], ['house_stone', 98, 63], ['house_tan', 97, 67],
        ['house_red', 98, 71], ['house_stone', 97, 75],
        ['house_tan', 123, 61], ['house_red', 122, 63], ['house_stone', 123, 67],
        ['house_tan', 122, 71], ['house_red', 123, 75],
        ['tree', 99, 61], ['tree', 100, 65], ['tree', 99, 73], ['bush', 100, 69],
        ['tree', 121, 61], ['tree', 120, 65], ['tree', 121, 73], ['bush', 120, 69],
        // the merchant's house and the steward's, the two you can go into
        ['hall', 97, 54], ['hall', 122, 80],
        // the streets behind
        ['house_red', 62, 96], ['house_tan', 66, 96], ['house_stone', 70, 96],
        ['house_tan', 150, 96], ['house_red', 154, 96], ['house_stone', 158, 96],
        ['house_stone', 57, 64], ['house_tan', 57, 68], ['house_red', 57, 72],
        ['house_red', 163, 64], ['house_stone', 163, 68], ['house_tan', 163, 72],
        ['hut', 63, 92], ['hut_round', 67, 92], ['tent', 71, 92],
        ['hut', 151, 92], ['hut_round', 155, 92], ['tent', 159, 92],
        ['cart', 65, 99], ['barrel', 153, 99],

        // a burnt-out watchtower in the meadows: the only landmark between the
        // capital and the river, so the walk south has something to aim at
        ['ruin', 74, 110], ['pebbles', 76, 112], ['twigs', 73, 113],

        // ================================================ the river crossing
        ['sign', 108, 124], ['sign', 112, 136],
        ['house_stone', 118, 122], ['crate', 120, 124], ['barrel', 121, 125],
        ['campfire', 118, 126],

        // ================================================ the mill and the lake
        ['hall', 49, 154], ['hut', 54, 156], ['hut_round', 56, 159],
        ['cart', 48, 158], ['barrel', 47, 159], ['crate', 52, 160],
        ['pen', 47, 150], ['pen', 48, 150], ['pen', 49, 150],

        // ================================================ the farms
        ['house_tan', 196, 142], ['hut', 198, 145], ['hut_round', 199, 148],
        ['cart', 195, 146], ['crate', 194, 148],
        ['cart', 160, 150], ['crate', 166, 155], ['barrel', 155, 146],
        ['tent', 170, 152],

        // ================================================ the river abbey
        // where the monk came from, and where the walk north begins
        ['hall', 104, 152], ['house_stone', 115, 152],
        ['statue', 108, 156], ['statue', 112, 156],
        ['fountain_tall', 106, 160], ['fountain_tall', 114, 160],
        ['grave', 102, 163], ['grave', 104, 163], ['grave', 106, 163],
        ['tree_big', 101, 152], ['tree_big', 118, 158],
        ['sign', 107, 151], ['campfire', 105, 161],
        ['chest', 116, 160], ['pot', 117, 161],
      ],

      groves: [
        // the woods. Two big ones north, smaller ones south, so the map has a
        // horizon in every direction and the open country between them reads as
        // open rather than as unfinished.
        { types: ['tree', 'tree_pair', 'tree_tall', 'tree_big'], rect: [2, 2, 70, 92], count: 560, seed: 11 },
        { types: ['tree', 'tree_tall', 'tree_pair'], rect: [10, 12, 62, 70], count: 380, seed: 13 },
        { types: ['tree', 'tree_pair', 'bush'], rect: [56, 20, 26, 62], count: 190, seed: 17 },
        { types: ['tree', 'tree_tall', 'tree_pair', 'tree_big'], rect: [148, 2, 70, 92], count: 560, seed: 23 },
        { types: ['tree', 'tree_tall', 'tree_pair'], rect: [148, 12, 62, 70], count: 380, seed: 29 },
        { types: ['tree', 'tree_pair', 'bush'], rect: [138, 20, 26, 62], count: 190, seed: 19 },
        { types: ['tree', 'tree_tall', 'tree_bare'], rect: [2, 104, 34, 60], count: 260, seed: 31 },
        { types: ['tree', 'tree_pair', 'tree_tall'], rect: [178, 104, 40, 60], count: 280, seed: 37 },
        { types: ['tree', 'tree_tall', 'tree_bare'], rect: [2, 164, 216, 6], count: 170, seed: 41 },
        { types: ['tree_pair', 'bush', 'tree'], rect: [64, 62, 22, 34], count: 100, seed: 61 },
        { types: ['tree_pair', 'bush', 'tree'], rect: [136, 62, 22, 34], count: 90, seed: 67 },
        // the meadows. Nothing here is solid except the rocks, so the country
        // stays walkable; it is there to stop the grass reading as a flat sheet.
        { types: ['bush', 'rock', 'pebbles', 'twigs'], rect: [40, 102, 140, 24], count: 420, seed: 43 },
        { types: ['bush', 'rock', 'twigs'], rect: [44, 134, 54, 32], count: 220, seed: 47 },
        { types: ['bush', 'rock', 'tree_pair'], rect: [122, 134, 24, 32], count: 90, seed: 53 },
        { types: ['bush', 'pebbles'], rect: [86, 42, 48, 14], count: 90, seed: 59 },
        { types: ['bush', 'twigs', 'pebbles'], rect: [4, 94, 212, 6], count: 200, seed: 71 },
        { types: ['bush', 'twigs'], rect: [78, 48, 64, 8], count: 70, seed: 73 },
        { types: ['bush', 'pebbles', 'twigs'], rect: [96, 84, 44, 14], count: 90, seed: 79 },
        // paving and bare earth get their own litter, or they read as painted
        // cardboard. All of it is flat scenery you walk straight over.
        { types: ['pebbles'], on: 'stone', rect: [103, 11, 15, 29], count: 50, seed: 83 },
        { types: ['pebbles'], on: 'stone', rect: [102, 60, 17, 17], count: 26, seed: 89 },
        { types: ['pebbles'], on: 'stone', rect: [100, 150, 21, 17], count: 30, seed: 97 },
        { types: ['pebbles'], on: 'earth', rect: [119, 18, 16, 15], count: 40, seed: 101 },
        
        { types: ['twigs', 'pebbles'], on: 'earth', rect: [148, 138, 45, 23], count: 130, seed: 107 },
        { types: ['bush', 'twigs'], on: 'grass', rect: [86, 14, 16, 22], count: 60, seed: 109 },
      ],

      npcs: [
        { id: 'gate_guard', sheet: 'guard', name: 'Gate Guard', x: 107, y: 43, dir: 2 },
        { id: 'marshal', sheet: 'marshal', name: 'Marshal Aldric', x: 113, y: 43, dir: 2 },
        { id: 'market_woman', sheet: 'lady', name: 'Market Trader', x: 105, y: 68, dir: 2,
          wander: { range: 24, speed: 11 } },
        { id: 'farmer', sheet: 'farmer', name: 'Farmer Odo', x: 166, y: 148, dir: 2,
          wander: { range: 44, speed: 10 } },
        { id: 'miller', sheet: 'miller', name: 'The Miller', x: 52, y: 157, dir: 3 },
      ],

      portals: [
        { rect: [109, 16, 2, 1], to: 'throne_hall', spawn: [16, 20], dir: 0, label: 'The keep' },
        { rect: [97, 56, 2, 1], to: 'merchant_house', spawn: [9, 12], dir: 0, label: "Merchant's house" },
        { rect: [122, 82, 2, 1], to: 'elder_house', spawn: [8, 11], dir: 0, label: "Steward's house" },
      ],
    },

    // ======================================================= the throne hall
    // Everything is centred on x=16: the room is 28 tiles wide starting at x=2,
    // the carpet is four tiles wide, the way out is two. An odd room with an
    // even doorway is half a tile out of true, and in a hall this symmetrical
    // that half tile is the first thing the eye finds.
    throne_hall: {
      name: 'The throne hall',
      kind: 'indoor',
      w: 31, h: 25,
      room: [2, 3, 28, 18],
      floor: 'stone', wall: 'keep',
      patches: [['earth', 14, 4, 17, 20]],        // the carpet, door to dais
      extraFloor: [[15, 21, 2, 3]],
      objects: [
        // the dais: the seat of state on its seal, between two braziers
        ['seal', 15, 5],
        ['throne', 16, 5],
        ['campfire', 13, 5], ['campfire', 19, 5],
        ['banner', 13, 3], ['banner', 18, 3],
        ['portrait', 10, 3], ['portrait', 21, 3],
        // the colonnades down both sides of the carpet
        ['colonnade', 10, 8], ['colonnade', 10, 10], ['colonnade', 10, 12],
        ['colonnade', 10, 14], ['colonnade', 10, 16],
        ['colonnade', 21, 8], ['colonnade', 21, 10], ['colonnade', 21, 12],
        ['colonnade', 21, 14], ['colonnade', 21, 16],
        // the long tables the court eats at, set back behind the colonnades
        ['banquet', 5, 9], ['banquet', 5, 13],
        ['banquet', 24, 9], ['banquet', 24, 13],
        ['bench', 5, 11], ['bench', 7, 11], ['bench', 24, 11], ['bench', 26, 11],
        ['statue', 12, 7], ['statue', 19, 7],
        ['fountain_tall', 4, 4], ['fountain_tall', 27, 4],
        ['shelf', 4, 6], ['shelf', 27, 6],
        ['chest', 4, 19], ['chest', 27, 19], ['pot', 6, 19], ['pot', 25, 19],
        ['barrel', 5, 17], ['crate', 26, 17],
      ],
      npcs: [
        { id: 'emperor', sheet: 'king', name: 'The King', x: 16, y: 7, dir: 2 },
        { id: 'steward', sheet: 'steward', name: 'Steward Balan', x: 19, y: 10, dir: 1 },
        { id: 'hall_guard', sheet: 'guard', name: 'Hall Guard', x: 12, y: 18, dir: 3 },
      ],
      portals: [
        { rect: [15, 22, 2, 1], to: 'realm', spawn: [110, 18], dir: 2, label: 'Out to the courtyard' },
      ],
    },

    // ==================================================== the merchant's house
    merchant_house: {
      name: "The merchant's house",
      kind: 'indoor',
      w: 20, h: 17,
      room: [2, 3, 16, 9],
      floor: 'wood', wall: 'wood',
      extraFloor: [[9, 12, 2, 3]],
      objects: [
        ['shelf', 3, 3], ['shelf', 5, 3], ['shelf', 14, 3], ['shelf', 16, 3],
        ['table', 6, 7], ['chair', 5, 7], ['chair', 7, 7],
        ['chest', 15, 7], ['pot', 13, 3],
        ['barrel', 3, 10], ['barrel', 5, 10], ['crate', 16, 10], ['crate', 14, 10],
        ['campfire', 9, 4], ['cart', 12, 10],
      ],
      npcs: [
        { id: 'merchant', sheet: 'merchant', name: 'Master Vaso', x: 10, y: 8, dir: 2 },
      ],
      portals: [
        { rect: [9, 13, 2, 1], to: 'realm', spawn: [97, 57], dir: 2, label: 'Out' },
      ],
    },

    // ===================================================== the steward's house
    elder_house: {
      name: "The steward's town house",
      kind: 'indoor',
      w: 18, h: 15,
      room: [2, 3, 14, 8],
      floor: 'wood', wall: 'stone',
      extraFloor: [[8, 11, 2, 3]],
      objects: [
        ['shelf', 3, 3], ['shelf', 14, 3],
        ['table', 9, 7], ['chair', 8, 7],
        ['chest', 3, 9], ['pot', 14, 9],
        ['campfire', 5, 4], ['barrel', 14, 6], ['crate', 12, 10],
      ],
      npcs: [
        { id: 'old_soldier', sheet: 'guard', name: 'Old Sergeant', x: 7, y: 8, dir: 3 },
      ],
      portals: [
        { rect: [8, 12, 2, 1], to: 'realm', spawn: [122, 83], dir: 2, label: 'Out' },
      ],
    },
  },
};
