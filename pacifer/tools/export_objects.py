"""Cut every game object out of the LPC sheets and write it as its own sprite,
together with its collision box, plus the finished character walk sheets.

Run:  python3 tools/export_objects.py      (needs Pillow)

Writes assets/objects/*.png, assets/objects/objects.json, data/objects.js and
assets/characters/*.png. The .js file is what the game loads, so the game also
works when index.html is opened straight off the disk.
"""
from PIL import Image
import json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import castle

A = os.path.join(HERE, '..', 'assets')
LPC = os.path.join(A, 'lpc-revised')
U = os.path.join(A, 'ulpc')
OBJ = os.path.join(A, 'objects')
CH = os.path.join(A, 'characters')
DATA = os.path.join(HERE, '..', 'data')
for d in (OBJ, CH, DATA):
    os.makedirs(d, exist_ok=True)
T = 32


def load(p):
    return Image.open(os.path.join(LPC, p)).convert('RGBA')


def tile(sheet, tx, ty, w=1, h=1):
    return sheet.crop((tx * T, ty * T, (tx + w) * T, (ty + h) * T))


def tint(img, dark, light):
    """Recolour a sprite by mapping its luminance onto a two-colour ramp."""
    out = img.copy()
    px = out.load()
    for yy in range(out.height):
        for xx in range(out.width):
            r, g, b, a = px[xx, yy]
            if a == 0:
                continue
            l = min(1, (0.3 * r + 0.59 * g + 0.11 * b) / 255 * 1.25)
            px[xx, yy] = tuple(int(dark[i] + (light[i] - dark[i]) * l) for i in range(3)) + (a,)
    return out


objects = {}


def save(name, img, col=None, **extra):
    """col is [x, y, w, h] relative to the sprite's top-left corner, or None.
    Pass cols=[[...], ...] for pieces that block in more than one place."""
    img.save(os.path.join(OBJ, name + '.png'))
    objects[name] = dict(file=f'{name}.png', w=img.width, h=img.height, col=col, **extra)


# ---------------------------------------------------------------- sheets
walls = load('Structure/Walls/Jagged Stone Walls.png')
pillars = load('Structure/Pillars/Stone Pillar A.png')
orn_windows = load('Structure/Windows/Ornamental Windows A.png')
awnings = load('Structure/Windows/Window Awnings A.png')
doors = load('Structure/Doors/64x64px Arched Doors/Arched Double Doors A.png')
counter = load('Objects/Furniture/Countertop.png')

# ---------------------------------------------------------------- nature
trees = load('Terrain/trees_spring.png')
for i, box in enumerate([(128, 0, 224, 128), (224, 0, 320, 128), (320, 0, 416, 128),
                         (128, 256, 224, 384), (224, 256, 320, 384), (320, 256, 416, 384)]):
    save(f'tree{i + 1}', trees.crop(box), [30, 100, 36, 26])
for i, box in enumerate([(128, 384, 224, 512), (224, 384, 320, 512)]):
    save(f'pine{i + 1}', trees.crop(box), [34, 104, 28, 22])
plants = load('Terrain/plants_spring.png')
for i in range(4):
    save(f'bush{i + 1}', tile(plants, i, 0), [2, 8, 28, 22])
save('rock', load('Terrain/Rocks, Grasslands.png').crop((96, 96, 160, 128)), [4, 8, 56, 22])

# ---------------------------------------------------------------- the royal castle
stone = castle.Stonework(walls, 0, 0)

wall_h = castle.wall_run(3, 2, stone)
save('wall_h', wall_h, None, cols=[[0, T, wall_h.width, wall_h.height - T]])
wall_v = castle.wall_side(3, stone)
save('wall_v', wall_v, [0, 0, wall_v.width, wall_v.height])
twr = castle.tower(stone)
save('tower', twr, None, cols=[[0, 2 * T, twr.width, twr.height - 2 * T]])

gate_img, gate_x = castle.gatehouse(stone, doors)
save('gate', gate_img, None, cols=[
    [0, T, gate_x * T, gate_img.height - T],
    [(gate_x + 2) * T, T, gate_img.width - (gate_x + 2) * T, gate_img.height - T],
], door=[gate_x * T, gate_img.height - 2 * T, 2 * T, 2 * T])

keep_img, keep_door_x, keep_door_row = castle.keep(stone, doors, orn_windows, pillars)
hall_top = keep_img.height - 7 * T
save('keep', keep_img, None, cols=[
    [0, T, 3 * T, keep_img.height - T],                                    # left tower
    [keep_img.width - 3 * T, T, 3 * T, keep_img.height - T],               # right tower
    [3 * T, hall_top, (keep_door_x - 3) * T, keep_img.height - hall_top],  # hall left of the door
    [(keep_door_x + 2) * T, hall_top, keep_img.width - (keep_door_x + 5) * T,
     keep_img.height - hall_top],                                          # hall right of the door
], door=[keep_door_x * T, (keep_door_row - 1) * T, 2 * T, T])

# ---------------------------------------------------------------- town
save('houseA', load('Structure/Structures/Brick House A.png'), [8, 96, 240, 128], door=[64, 192, 32, 32])
save('houseB', load('Structure/Structures/Paneled House A.png'), [0, 64, 160, 96], door=[112, 128, 32, 32])
save('fountain', load('Structure/Misc/Fountain A.png'), [4, 40, 56, 52])
save('lamp', load('Objects/Furniture/Lighting, Outdoors.png').crop((0, 0, 32, 96)), [10, 78, 12, 16])
barrel = load('Objects/Furniture/Barrel.png')
crate_sheet = load('Objects/Furniture/Crate.png')
save('barrel', barrel.crop((0, 0, 32, 64)), [2, 28, 28, 34])
save('barrels', barrel.crop((96, 0, 160, 64)), [2, 20, 60, 42])
save('crate', crate_sheet.crop((0, 0, 32, 64)), [1, 30, 30, 32])

fence = load('Structure/Fences/Plain Fence A.png')
fh = Image.new('RGBA', (96, 32))
for i in range(3):
    fh.alpha_composite(tile(fence, i, 0), (i * T, 0))
save('fence_h', fh, [0, 12, 96, 16])
fv = Image.new('RGBA', (32, 96))
for i in range(3):
    fv.alpha_composite(tile(fence, 3, i), (0, i * T))
save('fence_v', fv, [10, 8, 12, 84])

orn = load('Structure/Fences/Ornamental Fence A.png')
save('rail_h', orn.crop((0, 6 * T, 3 * T, 8 * T)), [0, 40, 96, 18])
save('rail_v', orn.crop((3 * T, 2 * T, 4 * T, 6 * T)), [10, 0, 12, 128])

save('bridge', load('Structure/Bridges/Wood Bridge A - Rails.png').crop((128, 0, 224, 64)),
     None, walkable=[0, 0, 96, 64])

# market stall: a shop counter under a shingled roof
roof = load('Structure/Roofing/Flat Shingle Roof A.png')
stall = Image.new('RGBA', (3 * T, 5 * T), (0, 0, 0, 0))
for j in range(3):
    for i in range(3):
        tx = 1 if i == 0 else (3 if i == 2 else 2)
        stall.alpha_composite(tile(roof, tx, j), (i * T, j * T))
for j in range(2):
    for i in range(3):
        stall.alpha_composite(tile(counter, 2 + i, j), (i * T, (3 + j) * T))
save('stall', stall, [0, 3 * T, 3 * T, 2 * T])

signs = load('Structure/Signs/Sign Backgrounds A.png')
save('sign', signs.crop((0, 0, T, T)), [8, 20, 16, 10])

hay = load('Objects/Small Items/Hay & Straw.png')
save('haystack', hay.crop((2 * T, 0, 4 * T, 3 * T)), [4, 56, 56, 36])
baskets = load('Objects/Small Items/Baskets A.png')
save('basket', baskets.crop((0, 0, T, T)), [6, 12, 20, 18])

save('trellis', load('Structure/Misc/Trellis A.png').crop((0, 0, 3 * T, 4 * T)), [0, 96, 96, 28])
save('dais', load('Structure/Platforms/Dias with Steps A.png'), None, flat=True)

# ---------------------------------------------------------------- interiors
thrones = load('Objects/Furniture/Seating/Thrones.png')
save('throne', thrones.crop((0, 0, 32, 64)), [2, 34, 28, 26])
tables = load('Objects/Furniture/Table, Ornate Wood.png')
save('table_big', tables.crop((3 * T, 2 * T, 6 * T, 4 * T)), [0, 6, 96, 52])
chairs = load('Objects/Furniture/Seating/Chair, Dining A.png')
save('chair', chairs.crop((0, 0, 32, 32)), [4, 14, 24, 16])
save('chair2', chairs.crop((0, 4 * T, 32, 5 * T)), [4, 14, 24, 16])
rug = load('Objects/Furniture/Rugs/Swirling Vine Rug.png')
save('rug', tint(rug.crop((0, 2 * T, 5 * T, 4 * T)), (86, 14, 22), (196, 62, 60)), None, flat=True)
save('fireplace', load('Objects/Furniture/Fireplace.png').crop((3 * T, 0, 6 * T, 3 * T)), [4, 48, 88, 44])
save('shelf', load('Objects/Furniture/Shelf.png').crop((0, 0, 3 * T, T)), None, flat=True)
save('chest', load('Objects/Furniture/Chest.png').crop((0, 2 * T, 32, 3 * T)), [3, 12, 26, 18])
save('pillar', pillars.crop((96, 0, 128, 96)), [6, 62, 20, 30])
save('cabinet', load('Objects/Furniture/Cabinet.png').crop((0, 0, T, 2 * T)), [2, 30, 28, 32])
# cauldron over a fire: rows 1..4 of the sheet are the flame frames
cauldron_sheet = load('Objects/Furniture/Cauldron.png')
cauldron = Image.new('RGBA', (4 * T, T), (0, 0, 0, 0))
for i in range(4):
    cauldron.alpha_composite(cauldron_sheet.crop((0, (1 + i) * T, T, (2 + i) * T)), (i * T, 0))
save('cauldron', cauldron, [4, 10, 24, 20], anim={'frames': 4, 'w': T, 'h': T, 'fps': 7})

# wall torch, three animation frames laid out side by side
wl = load('Objects/Wall Items/Lighting, Wall.png')
torch = Image.new('RGBA', (3 * T, 2 * T), (0, 0, 0, 0))
for i, col in enumerate((2, 3, 4)):
    torch.alpha_composite(wl.crop((col * T, 0, (col + 1) * T, 2 * T)), (i * T, 0))
save('torch', torch, None, anim={'frames': 3, 'w': T, 'h': 2 * T, 'fps': 6}, flat=True)

json.dump(objects, open(os.path.join(OBJ, 'objects.json'), 'w'), indent=1)
with open(os.path.join(DATA, 'objects.js'), 'w') as f:
    f.write('/* GENERATED by tools/export_objects.py - do not edit by hand */\n')
    f.write('window.PACIFER_OBJECTS = ' + json.dumps(objects, indent=1, ensure_ascii=False) + ';\n')


# ---------------------------------------------------------------- characters
def sheet(parts):
    """Stack LPC layers into one 4-direction x 9-frame walk sheet."""
    out = Image.new('RGBA', (576, 256), (0, 0, 0, 0))
    for p in parts:
        path, color = (p if isinstance(p, tuple) else (p, None))
        im = Image.open(path).convert('RGBA')
        if color:
            im = tint(im, *color)
        out.alpha_composite(im)
    return out


DBROWN = ((30, 18, 10), (92, 62, 36)); HAIRBR = ((40, 26, 18), (110, 74, 44))
RED = ((90, 12, 20), (200, 50, 60)); GOLD = ((120, 80, 10), (240, 200, 80))
NAVY = ((16, 18, 40), (60, 66, 120)); BLACK = ((12, 10, 12), (60, 56, 60))
GRAY = ((70, 68, 66), (200, 196, 190)); GREEN = ((20, 46, 24), (74, 130, 70))

common = [f'{U}/shadow/adult/walk.png', f'{U}/body/bodies/male/walk.png',
          f'{U}/head/heads/human/male/walk.png']
CHARS = {
    'monk': common + [(f'{U}/feet/sandals/male/walk.png', DBROWN), (f'{U}/legs/pants/male/walk.png', DBROWN),
                      f'{U}/torso/jacket/frock/male/walk/brown.png', f'{U}/torso/waist/sash/male/walk/tan.png',
                      (f'{U}/hair/balding/adult/walk.png', HAIRBR)],
    'emperor': [common[0], (f'{U}/cape/solid/bg/walk.png', RED)] + common[1:] +
               [(f'{U}/feet/boots/basic/male/walk.png', BLACK), (f'{U}/legs/formal/male/walk.png', NAVY),
                f'{U}/torso/clothes/longsleeve/formal/male/walk/white.png',
                f'{U}/torso/jacket/tabard/male/walk/purple.png',
                (f'{U}/torso/waist/belt_leather/male/walk.png', GOLD), (f'{U}/cape/solid/fg/walk.png', RED),
                (f'{U}/beards/beard/basic/walk.png', GRAY), (f'{U}/hair/balding/adult/walk.png', GRAY),
                f'{U}/hat/formal/crown/adult/walk/gold.png'],
    'guard': common + [(f'{U}/feet/boots/basic/male/walk.png', BLACK), (f'{U}/legs/pants/male/walk.png', NAVY),
                       f'{U}/torso/chainmail/male/walk.png', (f'{U}/hat/helmet/kettle/adult/walk.png', GRAY)],
    'villager': common + [(f'{U}/feet/boots/basic/male/walk.png', DBROWN), (f'{U}/legs/pants/male/walk.png', DBROWN),
                          f'{U}/torso/clothes/longsleeve/formal/male/walk/white.png',
                          f'{U}/torso/aprons/apron/male/walk/brown.png',
                          (f'{U}/hair/buzzcut/adult/walk.png', HAIRBR)],
    # marshal of the court: mail under the royal colours
    'marshal': [common[0], (f'{U}/cape/solid/bg/walk.png', NAVY)] + common[1:] +
               [(f'{U}/feet/boots/basic/male/walk.png', BLACK), (f'{U}/legs/formal/male/walk.png', BLACK),
                f'{U}/torso/chainmail/male/walk.png', f'{U}/torso/jacket/tabard/male/walk/blue.png',
                (f'{U}/torso/waist/belt_leather/male/walk.png', GOLD), (f'{U}/cape/solid/fg/walk.png', NAVY),
                (f'{U}/hair/buzzcut/adult/walk.png', GRAY)],
    # steward who keeps the ledgers
    'steward': common + [(f'{U}/feet/boots/basic/male/walk.png', BLACK), (f'{U}/legs/formal/male/walk.png', GREEN),
                         f'{U}/torso/clothes/longsleeve/formal/male/walk/white.png',
                         f'{U}/torso/jacket/frock/male/walk/brown.png',
                         (f'{U}/torso/waist/belt_leather/male/walk.png', DBROWN),
                         (f'{U}/beards/beard/basic/walk.png', GRAY), (f'{U}/hair/balding/adult/walk.png', GRAY)],
}
for name, parts in CHARS.items():
    sheet(parts).save(os.path.join(CH, name + '.png'))
    print('character', name)
print('objects', len(objects))
