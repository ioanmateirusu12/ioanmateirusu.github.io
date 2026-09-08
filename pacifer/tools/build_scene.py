"""Build a Pacifer test scene from real free assets (LPC Revised + Universal LPC + Ninja Adventure)."""
from PIL import Image, ImageDraw, ImageFont
import random, os, sys


HERE = os.path.dirname(os.path.abspath(__file__))
LPC = os.path.join(HERE, '..', 'assets', 'lpc-revised'); ULPC = os.path.join(HERE, '..', 'assets', 'ulpc'); NA = os.path.join(HERE, '..', 'assets', 'ninja-adventure')
OUT = os.path.join(HERE, '..', 'preview')
T = 32
W, H = 28, 18
rnd = random.Random(3)

def load(p): return Image.open(p).convert('RGBA')
def tile(sheet, tx, ty, w=1, h=1): return sheet.crop((tx*T, ty*T, (tx+w)*T, (ty+h)*T))

terrain = load(f'{LPC}/Terrain/terrain_spring.png')
trees_sheet = load(f'{LPC}/Terrain/trees_spring.png')
plants = load(f'{LPC}/Terrain/plants_spring.png')
wild = load(f'{LPC}/Terrain/wildflowers_spring.png')
rocks = load(f'{LPC}/Terrain/Rocks, Grasslands.png')
walls = load(f'{LPC}/Structure/Walls/Jagged Stone Walls.png')
roof = load(f'{LPC}/Structure/Roofing/Flat Shingle Roof A.png')
pillars = load(f'{LPC}/Structure/Pillars/Stone Pillar A.png')
windows = load(f'{LPC}/Structure/Windows/Stone Windows A.png')
doors = load(f'{LPC}/Structure/Doors/64x64px Arched Doors/Arched Double Doors A.png')
fence = load(f'{LPC}/Structure/Fences/Plain Fence A.png')
lamp = load(f'{LPC}/Objects/Furniture/Lighting, Outdoors.png')
fountain = load(f'{LPC}/Structure/Misc/Fountain A.png')
barrel = load(f'{LPC}/Objects/Furniture/Barrel.png')
crate = load(f'{LPC}/Objects/Furniture/Crate.png')
houseA = load(f'{LPC}/Structure/Structures/Brick House A.png')
houseB = load(f'{LPC}/Structure/Structures/Paneled House A.png')
bridge = load(f'{LPC}/Structure/Bridges/Wood Bridge A - Rails.png')

# ---------------- map ----------------
GRASS, DIRT, WATER = 0, 1, 2
m = [[GRASS]*W for _ in range(H)]
def fill(x0, y0, x1, y1, v):
    for y in range(y0, y1+1):
        for x in range(x0, x1+1):
            if 0 <= x < W and 0 <= y < H: m[y][x] = v
fill(24, 0, 26, H-1, WATER)          # river
fill(23, 0, 23, 3, WATER); fill(23, 14, 23, H-1, WATER)
fill(0, 10, 23, 11, DIRT)            # main road
fill(15, 6, 16, 9, DIRT)             # to palace gate
fill(3, 7, 4, 9, DIRT)               # to house A
fill(3, 12, 4, 12, DIRT)             # to house B

def at(x, y):
    if x < 0 or y < 0 or x >= W or y >= H: return GRASS
    return m[y][x]

# autotile sets: outer 3x3 block origin, inner 2x2 block origin
SETS = {DIRT: ((6, 0), (6, 3)), WATER: ((3, 10), (0, 13))}
PLAIN = {GRASS: [(3, 1), (4, 1), (5, 1), (3, 2), (4, 2), (5, 2)], DIRT: [(3, 3), (4, 3), (5, 3), (3, 4), (4, 4), (5, 4)],
         WATER: [(12, 16), (13, 16), (14, 16), (15, 16), (12, 17), (13, 17), (14, 17), (15, 17)]}

def quad(img, q):  # q: 0 TL,1 TR,2 BL,3 BR of a 32px tile
    qx, qy = (q % 2) * 16, (q // 2) * 16
    return img.crop((qx, qy, qx+16, qy+16))

def grass_quadrant(x, y, q):
    dx = -1 if q % 2 == 0 else 1
    dy = -1 if q < 2 else 1
    h, v, d = at(x+dx, y), at(x, y+dy), at(x+dx, y+dy)
    others = [t for t in (h, v, d) if t != GRASS]
    if not others: return None
    base = WATER if WATER in others else DIRT
    (ox, oy), (ix, iy) = SETS[base]
    if h == GRASS and v == GRASS:      # inner corner
        tx, ty = ix + (1 if q % 2 == 0 else 0), iy + (1 if q < 2 else 0)
        return quad(tile(terrain, tx, ty), q)
    if h != GRASS and v != GRASS:      # outer corner
        tx, ty = ox + (0 if q % 2 == 0 else 2), oy + (0 if q < 2 else 2)
        return quad(tile(terrain, tx, ty), q)
    if h != GRASS:                     # vertical edge
        tx, ty = ox + (0 if q % 2 == 0 else 2), oy + 1
        return quad(tile(terrain, tx, ty), q)
    tx, ty = ox + 1, oy + (0 if q < 2 else 2)
    return quad(tile(terrain, tx, ty), q)

scene = Image.new('RGBA', (W*T, H*T), (0, 0, 0, 255))
for y in range(H):
    for x in range(W):
        v = m[y][x]
        base = tile(terrain, *rnd.choice(PLAIN[v]))
        scene.paste(base, (x*T, y*T))
        if v == GRASS:
            for q in range(4):
                g = grass_quadrant(x, y, q)
                if g is not None:
                    scene.alpha_composite(g, (x*T + (q % 2)*16, y*T + (q//2)*16))

draw = ImageDraw.Draw(scene)
def put(img, x, y): scene.alpha_composite(img, (int(x), int(y)))
def shadow(cx, cy, rx, ry, a=80):
    sh = Image.new('RGBA', scene.size, (0, 0, 0, 0))
    ImageDraw.Draw(sh).ellipse([cx-rx, cy-ry, cx+rx, cy+ry], fill=(10, 10, 30, a))
    scene.alpha_composite(sh)

# ---------------- palace ----------------
def wall_block(x0, y0, w, h, col=3):
    for j in range(h):
        row = 0 if j == 0 else (2 if j == h-1 else 1)
        for i in range(w):
            put(tile(walls, col + (i % 3), row), (x0+i)*T, (y0+j)*T)

def roof_block(x0, y0, w, h):
    for j in range(h):
        for i in range(w):
            tx = 1 if i == 0 else (3 if i == w-1 else 2)
            ty = 0 if j == 0 else (2 if j == h-1 else 1)
            put(tile(roof, tx, ty), (x0+i)*T, (y0+j)*T)

PX, PY = 10, 0          # palace origin (tile)
wall_block(PX+1, PY+3, 10, 3)          # main walls rows 3-5
roof_block(PX+1, PY+1, 10, 2)          # main roof rows 1-2
for tx_ in (PX-1, PX+11):              # towers
    wall_block(tx_, PY+2, 2, 4)
    roof_block(tx_, PY+0, 2, 2)
    shadow((tx_+1)*T, (PY+6)*T+4, 40, 6, 60)
# windows (lit, tall 32x96)
win = windows.crop((64, 0, 96, 96))
for wx in (PX+2, PX+3, PX+8, PX+9): put(win, wx*T, (PY+3)*T)
# gate: arched double doors 64x64 (dark brown closed = tiles 0,0-1,1)
put(doors.crop((0, 0, 64, 64)), (PX+5)*T, (PY+4)*T)
# pillars beside gate
pil = pillars.crop((96, 0, 128, 96))
put(pil, (PX+4)*T, (PY+3)*T); put(pil, (PX+7)*T, (PY+3)*T)
# lamps in front
lp = lamp.crop((0, 0, 32, 96))
put(lp, (PX+3)*T+8, (PY+6)*T); put(lp, (PX+8)*T-8, (PY+6)*T)
# fountain on the lawn
shadow(9*T+32, 9*T+2, 34, 8, 60); put(fountain, 8*T, 6*T+16)

# ---------------- houses ----------------
shadow(1*T+128, 7*T+2, 120, 8, 60); put(houseA, 1*T, 0*T)
shadow(1*T+80, 17*T+2, 76, 8, 60); put(houseB, 1*T, 12*T)
# fence around house A yard
for i in range(3):
    put(tile(fence, [0, 1, 2][i], 0), (6+i)*T, 7*T)
put(tile(fence, 3, 0), 8*T, 8*T); put(tile(fence, 3, 2), 8*T, 9*T)
# barrels & crates
put(barrel.crop((0, 0, 32, 64)), 9*T+4, 5*T-8)
put(crate.crop((0, 0, 32, 64)), 8*T-2, 5*T)
put(barrel.crop((96, 0, 160, 64)), 6*T+8, 14*T)

# ---------------- bridge ----------------
put(bridge.crop((128, 0, 224, 64)), 24*T, 10*T)
# fill road under the bridge deck edges is water; fine.

# ---------------- trees / plants ----------------
TREES = [(128, 0, 224, 128), (224, 0, 320, 128), (320, 0, 416, 128), (128, 256, 224, 384), (224, 256, 320, 384), (320, 256, 416, 384)]
PINES = [(128, 384, 224, 512), (224, 384, 320, 512)]
def tree(x, y, kind=None):
    box = rnd.choice(kind or TREES)
    img = trees_sheet.crop(box)
    shadow(x+48, y+120, 34, 9, 70)
    put(img, x, y)
for (x, y) in [(0, 8), (22, 12), (19, 14), (9, 13), (12, 13), (21, 6), (18, 7)]:
    tree(x*T - 16, y*T - 32)
for (x, y) in [(22, 2), (20, 0), (26, 12), (27, 4)]:
    tree(x*T - 16, y*T - 32, PINES)
# bushes / flowers
for (x, y) in [(6, 8), (7, 9), (14, 8), (17, 8), (11, 6), (20, 9), (5, 14), (14, 14)]:
    put(tile(plants, rnd.choice([0, 1, 2, 3]), 0), x*T, y*T)
for _ in range(40):
    x, y = rnd.randrange(W), rnd.randrange(H)
    if m[y][x] == GRASS and not (1 <= x <= 8 and y <= 6) and not (PX-1 <= x <= PX+12 and y <= 6) and not (1 <= x <= 6 and y >= 12):
        put(tile(wild, rnd.randrange(9), rnd.randrange(5)).crop((0, 0, 16, 16)) if rnd.random() < .5 else tile(wild, rnd.randrange(9), rnd.randrange(5)).crop((16, 16, 32, 32)), x*T + rnd.randrange(16), y*T + rnd.randrange(16))
for (x, y) in [(20, 15), (7, 16), (13, 7)]:
    put(rocks.crop((96, 96, 160, 128)), x*T, y*T)

# ---------------- characters (Universal LPC) ----------------
def tint(img, dark, light):
    """Recolor a single-hue garment: map luminance to a dark->light ramp."""
    out = img.copy(); px = out.load()
    for yy in range(out.height):
        for xx in range(out.width):
            r, g, b, a = px[xx, yy]
            if a == 0: continue
            l = (0.3*r + 0.59*g + 0.11*b) / 255
            l = min(1, l * 1.25)
            px[xx, yy] = tuple(int(dark[i] + (light[i]-dark[i]) * l) for i in range(3)) + (a,)
    return out

def frame(path, row, col=0):
    im = load(path); return im.crop((col*64, row*64, col*64+64, row*64+64))

def character(parts, row):
    out = Image.new('RGBA', (64, 64), (0, 0, 0, 0))
    for p in parts:
        path, color = (p if isinstance(p, tuple) else (p, None))
        if not os.path.exists(path):
            print('missing', path); continue
        f = frame(path, row)
        if color: f = tint(f, *color)
        out.alpha_composite(f)
    return out

BROWN = ((52, 32, 18), (150, 108, 68)); DBROWN = ((30, 18, 10), (92, 62, 36)); HAIRBR = ((40, 26, 18), (110, 74, 44))
PURPLE = ((50, 18, 66), (150, 80, 180)); RED = ((90, 12, 20), (200, 50, 60)); GOLD = ((120, 80, 10), (240, 200, 80))
NAVY = ((16, 18, 40), (60, 66, 120)); BLACK = ((12, 10, 12), (60, 56, 60)); GRAY = ((70, 68, 66), (200, 196, 190))

U = ULPC
monk_parts = [f'{U}/shadow/adult/walk.png', f'{U}/body/bodies/male/walk.png', f'{U}/head/heads/human/male/walk.png',
              (f'{U}/feet/sandals/male/walk.png', DBROWN), (f'{U}/legs/pants/male/walk.png', DBROWN),
              f'{U}/torso/jacket/frock/male/walk/brown.png', (f'{U}/torso/waist/sash/male/walk/tan.png', None),
              (f'{U}/hair/balding/adult/walk.png', HAIRBR)]
emp_parts = [f'{U}/shadow/adult/walk.png', (f'{U}/cape/solid/bg/walk.png', RED), f'{U}/body/bodies/male/walk.png', f'{U}/head/heads/human/male/walk.png',
             (f'{U}/feet/boots/basic/male/walk.png', BLACK), (f'{U}/legs/formal/male/walk.png', NAVY),
             f'{U}/torso/clothes/longsleeve/formal/male/walk/white.png', f'{U}/torso/jacket/tabard/male/walk/purple.png',
             (f'{U}/torso/waist/belt_leather/male/walk.png', GOLD), (f'{U}/cape/solid/fg/walk.png', RED),
             (f'{U}/beards/beard/basic/walk.png', GRAY), (f'{U}/hair/balding/adult/walk.png', GRAY), f'{U}/hat/formal/crown/adult/walk/gold.png']
monk = character(monk_parts, 3)      # facing right
emperor = character(emp_parts, 1)    # facing left
put(monk, 9*T, 9*T+8); put(emperor, 12*T, 9*T+8)
# a guard near the gate and a villager near the house
guard = character([f'{U}/shadow/adult/walk.png', f'{U}/body/bodies/male/walk.png', f'{U}/head/heads/human/male/walk.png',
                   (f'{U}/feet/boots/basic/male/walk.png', BLACK), (f'{U}/legs/pants/male/walk.png', NAVY),
                   f'{U}/torso/chainmail/male/walk.png', (f'{U}/hat/helmet/kettle/adult/walk.png', GRAY)], 2)
put(guard, 17*T+8, 5*T+8)
villager = character([f'{U}/shadow/adult/walk.png', f'{U}/body/bodies/male/walk.png', f'{U}/head/heads/human/male/walk.png',
                      (f'{U}/feet/boots/basic/male/walk.png', DBROWN), (f'{U}/legs/pants/male/walk.png', DBROWN),
                      f'{U}/torso/clothes/longsleeve/formal/male/walk/white.png', (f'{U}/torso/aprons/apron/male/walk/brown.png' if os.path.exists(f'{U}/torso/aprons/apron/male/walk/brown.png') else f'{U}/torso/waist/sash/male/walk/brown.png'),
                      (f'{U}/hair/buzzcut/adult/walk.png', HAIRBR)], 2)
put(villager, 5*T, 12*T-8)

# ---------------- dialog (Ninja Adventure HUD) ----------------
bubble = load(f'{NA}/dialogue-bubble.png'); facebox = load(f'{NA}/faceset-box.png')
bub = bubble.resize((bubble.width*2, bubble.height*2), Image.NEAREST)
bx, by = (scene.width - bub.width)//2, scene.height - bub.height - 12
put(bub, bx, by)
fb = facebox.resize((96, 96), Image.NEAREST)
put(fb, bx + 10, by + 12)
face = character([p for p in monk_parts if 'shadow' not in (p if isinstance(p, str) else p[0])], 2).crop((16, 4, 48, 36)).resize((80, 80), Image.NEAREST)
put(face, bx + 18, by + 20)
try:
    font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf', 15)
except Exception:
    font = ImageFont.load_default()
draw = ImageDraw.Draw(scene)
draw.text((bx + 120, by + 26), 'CALUGARUL: Maria Ta, taranii din Valea de Jos', fill=(60, 30, 20, 255), font=font)
draw.text((bx + 120, by + 48), 'nu mai pot plati darea. Daca o iertam un an,', fill=(60, 30, 20, 255), font=font)
draw.text((bx + 120, by + 70), 'pierdem 200 galbeni, dar castigam pacea.', fill=(60, 30, 20, 255), font=font)

scene.resize((scene.width*2, scene.height*2), Image.NEAREST).save(os.path.join(OUT, 'scene.png'))
# character close-ups
sheet = Image.new('RGBA', (4*64*4+50, 64*4+20), (30, 30, 36, 255))
for i, c in enumerate([monk, emperor, guard, villager]):
    sheet.alpha_composite(c.resize((256, 256), Image.NEAREST), (10 + i*266, 10))
sheet.save(os.path.join(OUT, 'characters.png'))
print('done')
