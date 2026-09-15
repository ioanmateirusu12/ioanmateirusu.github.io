"""Turn the stock orange-hooded character into Brother Pacifer.

Run:  python3 tools/make_monk.py       (needs Pillow)

The sheet it starts from is one of the pack's townsfolk: a chibi with a huge
orange hood and two black eye slits. At the size it is actually drawn on screen
the flat orange reads as a pumpkin, not a man - so two things change here.

1. The palette becomes a monk's habit: undyed brown wool instead of orange, with
   a darker rim to the cowl.
2. A FACE is opened inside the cowl. The eyes are found first - black pixels with
   hood all round them - and the face is the patch of hood about them, so every
   frame gets a face in the right place without any frame being touched by hand,
   and the frame that looks away (the back view, which has no eyes) keeps the
   cowl closed, which is exactly right.

The untouched original stays in assets/pixelboy/characters/original/.
"""
from PIL import Image
import os

HERE = os.path.dirname(os.path.abspath(__file__))
CHARS = os.path.join(HERE, '..', 'assets', 'pixelboy', 'characters')
SRC = os.path.join(CHARS, 'original', 'monk.png')
OUT = os.path.join(CHARS, 'monk.png')
T = 16

HOOD_LIT, HOOD_MID, HOOD_RIM = (239, 160, 66), (226, 125, 45), (192, 58, 36)
BLACK = (2, 2, 2)

HABIT = {                      # what the stock colours become
    HOOD_LIT: (156, 132, 102),     # wool, lit
    HOOD_MID: (122, 100, 80),      # wool, in shade
    HOOD_RIM: (78, 61, 46),        # the rim of the cowl
    (43, 33, 42): (58, 44, 34),    # the habit itself
    (101, 121, 111): (107, 86, 64),
    (143, 171, 180): (192, 168, 130),   # hands and sleeve
    (46, 57, 57): (46, 38, 32),
    (81, 97, 78): (90, 73, 54),
}
SKIN, SKIN_SHADE = (226, 180, 140), (188, 143, 106)


def eyes_of(px):
    """Black pixels with hood on both sides: the eye slits, and nothing else."""
    found = []
    for y in range(1, T - 1):
        for x in range(1, T - 1):
            if px[x, y][:3] != BLACK or px[x, y][3] == 0:
                continue
            around = [px[x - 1, y], px[x + 1, y], px[x, y - 1], px[x, y + 1]]
            hood = sum(1 for p in around if p[3] and p[:3] in (HOOD_LIT, HOOD_MID))
            if hood >= 3:
                found.append((x, y))
    return found


src = Image.open(SRC).convert('RGBA')
out = Image.new('RGBA', src.size)
cols, rows = src.width // T, src.height // T

for ty in range(rows):
    for tx in range(cols):
        frame = src.crop((tx * T, ty * T, tx * T + T, ty * T + T))
        px = frame.load()
        eyes = eyes_of(px)
        # the face is the hood around the eyes: two to the sides, one above,
        # three below, with the four corners left as hood so it reads as a face
        # inside a cowl and not as a square window cut in one
        face = None
        if eyes:
            xs = [e[0] for e in eyes]; ys = [e[1] for e in eyes]
            face = (min(xs) - 2, min(ys) - 1, max(xs) + 2, max(ys) + 3)
        for y in range(T):
            for x in range(T):
                c = px[x, y]
                if c[3] == 0:
                    continue
                rgb = c[:3]
                corner = face and (x in (face[0], face[2]) and y in (face[1], face[3]))
                if face and not corner and rgb in (HOOD_LIT, HOOD_MID) and \
                   face[0] <= x <= face[2] and face[1] <= y <= face[3]:
                    px[x, y] = (*(SKIN if rgb == HOOD_LIT else SKIN_SHADE), 255)
                elif rgb in HABIT:
                    px[x, y] = (*HABIT[rgb], 255)
        out.paste(frame, (tx * T, ty * T))

out.save(OUT)
print('wrote', os.path.relpath(OUT, HERE))
