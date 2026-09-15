"""Labelled contact sheet: every 16px cell of a tileset, zoomed, on a checkerboard,
with its (x,y) tile coordinate written in the corner."""
from PIL import Image, ImageDraw, ImageFont
import sys, os

SRC = sys.argv[1]; OUT = sys.argv[2]
Y0 = int(sys.argv[3]) if len(sys.argv) > 3 else 0
Y1 = int(sys.argv[4]) if len(sys.argv) > 4 else 10**9
Z = 4; T = 16; GUT = 14          # zoom, tile size, label gutter

im = Image.open(SRC).convert('RGBA')
NX, NY = im.width // T, im.height // T
Y1 = min(Y1, NY)
rows = Y1 - Y0
cell = T * Z + GUT
W, H = NX * cell + 30, rows * cell + 22

out = Image.new('RGB', (W, H), (26, 26, 30))
d = ImageDraw.Draw(out)
try:
    f = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 11)
except OSError:
    f = ImageFont.load_default()

# checkerboard so transparent pixels are obvious
chk = Image.new('RGBA', (T * Z, T * Z))
cd = ImageDraw.Draw(chk)
for cy in range(0, T * Z, 8):
    for cx in range(0, T * Z, 8):
        cd.rectangle([cx, cy, cx + 7, cy + 7],
                     fill=(70, 70, 78) if (cx // 8 + cy // 8) % 2 else (48, 48, 54))

for ty in range(Y0, Y1):
    for tx in range(NX):
        px, py = 30 + tx * cell, 22 + (ty - Y0) * cell
        tile = im.crop((tx * T, ty * T, tx * T + T, ty * T + T)).resize((T * Z, T * Z), Image.NEAREST)
        bg = chk.copy(); bg.alpha_composite(tile)
        out.paste(bg.convert('RGB'), (px, py))
        d.rectangle([px, py, px + T * Z, py + T * Z], outline=(120, 120, 130))
        d.text((px + 1, py + T * Z + 1), f'{tx},{ty}', font=f, fill=(210, 210, 120))

out.save(OUT)
print(OUT, out.size, f'tiles {NX}x{Y1-Y0} from y={Y0}')
