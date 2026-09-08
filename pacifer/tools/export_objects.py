"""Exporta obiectele de joc (fiecare cu cutie de coliziune) si foile complete de personaje.

Rulare: python3 tools/export_objects.py   (necesita Pillow)
Scrie assets/objects/*.png + assets/objects/objects.json si assets/characters/*.png
"""
from PIL import Image
import json, os

HERE = os.path.dirname(os.path.abspath(__file__))
A = os.path.join(HERE, '..', 'assets')
LPC = os.path.join(A, 'lpc-revised'); U = os.path.join(A, 'ulpc')
OBJ = os.path.join(A, 'objects'); CH = os.path.join(A, 'characters')
os.makedirs(OBJ, exist_ok=True); os.makedirs(CH, exist_ok=True)
T = 32

def load(p): return Image.open(p).convert('RGBA')
def tile(sheet, tx, ty, w=1, h=1): return sheet.crop((tx*T, ty*T, (tx+w)*T, (ty+h)*T))

objects = {}
def save(name, img, col, **extra):
    img.save(os.path.join(OBJ, name + '.png'))
    objects[name] = dict(file=f'{name}.png', w=img.width, h=img.height, col=col, **extra)

trees = load(f'{LPC}/Terrain/trees_spring.png')
for i, box in enumerate([(128, 0, 224, 128), (224, 0, 320, 128), (320, 0, 416, 128), (128, 256, 224, 384), (224, 256, 320, 384), (320, 256, 416, 384)]):
    save(f'tree{i+1}', trees.crop(box), [30, 100, 36, 26])
for i, box in enumerate([(128, 384, 224, 512), (224, 384, 320, 512)]):
    save(f'pine{i+1}', trees.crop(box), [34, 104, 28, 22])

walls = load(f'{LPC}/Structure/Walls/Jagged Stone Walls.png'); roof = load(f'{LPC}/Structure/Roofing/Flat Shingle Roof A.png')
pillars = load(f'{LPC}/Structure/Pillars/Stone Pillar A.png'); windows = load(f'{LPC}/Structure/Windows/Stone Windows A.png')
doors = load(f'{LPC}/Structure/Doors/64x64px Arched Doors/Arched Double Doors A.png')

def wall_block(dst, x0, y0, w, h, col=3):
    for j in range(h):
        row = 0 if j == 0 else (2 if j == h-1 else 1)
        for i in range(w): dst.alpha_composite(tile(walls, col + (i % 3), row), ((x0+i)*T, (y0+j)*T))
def roof_block(dst, x0, y0, w, h):
    for j in range(h):
        for i in range(w):
            tx = 1 if i == 0 else (3 if i == w-1 else 2); ty = 0 if j == 0 else (2 if j == h-1 else 1)
            dst.alpha_composite(tile(roof, tx, ty), ((x0+i)*T, (y0+j)*T))

# palace: 14 tiles wide, 6 tall. Gate opening at tiles x=6..7 (bottom).
pal = Image.new('RGBA', (14*T, 6*T), (0, 0, 0, 0))
wall_block(pal, 2, 3, 10, 3); roof_block(pal, 2, 1, 10, 2)
for tx_ in (0, 12): wall_block(pal, tx_, 2, 2, 4); roof_block(pal, tx_, 0, 2, 2)
win = windows.crop((64, 0, 96, 96))
for wx in (3, 4, 9, 10): pal.alpha_composite(win, (wx*T, 3*T))
pal.alpha_composite(doors.crop((0, 0, 64, 64)), (6*T, 4*T))
pil = pillars.crop((96, 0, 128, 96)); pal.alpha_composite(pil, (5*T, 3*T)); pal.alpha_composite(pil, (8*T, 3*T))
save('palace', pal, [0, 2*T, 14*T, 4*T], door=[6*T, 5*T, 2*T, T])

save('houseA', load(f'{LPC}/Structure/Structures/Brick House A.png'), [8, 96, 240, 128], door=[64, 192, 32, 32])
save('houseB', load(f'{LPC}/Structure/Structures/Paneled House A.png'), [0, 64, 160, 96], door=[112, 128, 32, 32])
save('fountain', load(f'{LPC}/Structure/Misc/Fountain A.png'), [4, 40, 56, 52])
save('lamp', load(f'{LPC}/Objects/Furniture/Lighting, Outdoors.png').crop((0, 0, 32, 96)), [10, 78, 12, 16])
barrel = load(f'{LPC}/Objects/Furniture/Barrel.png'); crate = load(f'{LPC}/Objects/Furniture/Crate.png')
save('barrel', barrel.crop((0, 0, 32, 64)), [2, 28, 28, 34]); save('barrels', barrel.crop((96, 0, 160, 64)), [2, 20, 60, 42])
save('crate', crate.crop((0, 0, 32, 64)), [1, 30, 30, 32])
fence = load(f'{LPC}/Structure/Fences/Plain Fence A.png')
fh = Image.new('RGBA', (96, 32)); [fh.alpha_composite(tile(fence, i, 0), (i*T, 0)) for i in range(3)]
save('fence_h', fh, [0, 12, 96, 16])
fv = Image.new('RGBA', (32, 96)); [fv.alpha_composite(tile(fence, 3, i), (0, i*T)) for i in range(3)]
save('fence_v', fv, [10, 8, 12, 84])
plants = load(f'{LPC}/Terrain/plants_spring.png')
for i in range(4): save(f'bush{i+1}', tile(plants, i, 0), [2, 8, 28, 22])
save('rock', load(f'{LPC}/Terrain/Rocks, Grasslands.png').crop((96, 96, 160, 128)), [4, 8, 56, 22])
save('bridge', load(f'{LPC}/Structure/Bridges/Wood Bridge A - Rails.png').crop((128, 0, 224, 64)), None, walkable=[0, 0, 96, 64])
json.dump(objects, open(os.path.join(OBJ, 'objects.json'), 'w'), indent=1)

# ---- characters: full walk sheets (4 rows x 9 frames, 64x64) ----
def tint(img, dark, light):
    out = img.copy(); px = out.load()
    for yy in range(out.height):
        for xx in range(out.width):
            r, g, b, a = px[xx, yy]
            if a == 0: continue
            l = min(1, (0.3*r + 0.59*g + 0.11*b) / 255 * 1.25)
            px[xx, yy] = tuple(int(dark[i] + (light[i]-dark[i]) * l) for i in range(3)) + (a,)
    return out

def sheet(parts):
    out = Image.new('RGBA', (576, 256), (0, 0, 0, 0))
    for p in parts:
        path, color = (p if isinstance(p, tuple) else (p, None))
        im = load(path)
        if color: im = tint(im, *color)
        out.alpha_composite(im)
    return out

BROWN = ((52, 32, 18), (150, 108, 68)); DBROWN = ((30, 18, 10), (92, 62, 36)); HAIRBR = ((40, 26, 18), (110, 74, 44))
RED = ((90, 12, 20), (200, 50, 60)); GOLD = ((120, 80, 10), (240, 200, 80)); NAVY = ((16, 18, 40), (60, 66, 120))
BLACK = ((12, 10, 12), (60, 56, 60)); GRAY = ((70, 68, 66), (200, 196, 190))
common = [f'{U}/shadow/adult/walk.png', f'{U}/body/bodies/male/walk.png', f'{U}/head/heads/human/male/walk.png']
CHARS = {
 'monk': common[:1] + common[1:] + [(f'{U}/feet/sandals/male/walk.png', DBROWN), (f'{U}/legs/pants/male/walk.png', DBROWN),
          f'{U}/torso/jacket/frock/male/walk/brown.png', f'{U}/torso/waist/sash/male/walk/tan.png', (f'{U}/hair/balding/adult/walk.png', HAIRBR)],
 'emperor': [common[0], (f'{U}/cape/solid/bg/walk.png', RED)] + common[1:] + [(f'{U}/feet/boots/basic/male/walk.png', BLACK), (f'{U}/legs/formal/male/walk.png', NAVY),
          f'{U}/torso/clothes/longsleeve/formal/male/walk/white.png', f'{U}/torso/jacket/tabard/male/walk/purple.png', (f'{U}/torso/waist/belt_leather/male/walk.png', GOLD),
          (f'{U}/cape/solid/fg/walk.png', RED), (f'{U}/beards/beard/basic/walk.png', GRAY), (f'{U}/hair/balding/adult/walk.png', GRAY), f'{U}/hat/formal/crown/adult/walk/gold.png'],
 'guard': common + [(f'{U}/feet/boots/basic/male/walk.png', BLACK), (f'{U}/legs/pants/male/walk.png', NAVY), f'{U}/torso/chainmail/male/walk.png', (f'{U}/hat/helmet/kettle/adult/walk.png', GRAY)],
 'villager': common + [(f'{U}/feet/boots/basic/male/walk.png', DBROWN), (f'{U}/legs/pants/male/walk.png', DBROWN), f'{U}/torso/clothes/longsleeve/formal/male/walk/white.png',
          f'{U}/torso/aprons/apron/male/walk/brown.png', (f'{U}/hair/buzzcut/adult/walk.png', HAIRBR)],
}
for name, parts in CHARS.items():
    sheet(parts).save(os.path.join(CH, name + '.png')); print('character', name)
print('objects', len(objects))
