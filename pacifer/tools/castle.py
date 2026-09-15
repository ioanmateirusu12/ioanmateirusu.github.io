"""Builders for the royal-capital pieces: curtain walls, towers, the gatehouse and
the keep. They are composed tile by tile from the LPC stone-wall, roof, pillar,
window and door sheets, the same way a level artist would stamp them in an editor.

Imported by export_objects.py; not meant to be run on its own.
"""
from PIL import Image

T = 32


def sheet_tile(sheet, tx, ty, w=1, h=1):
    return sheet.crop((tx * T, ty * T, (tx + w) * T, (ty + h) * T))


class Stonework:
    """One colour block of a 6x9 LPC wall sheet: 3 columns of texture variants,
    rows cap / middle / base."""

    def __init__(self, sheet, col=0, row=0):
        self.sheet, self.col, self.row = sheet, col, row

    def cap(self, i=0):
        return sheet_tile(self.sheet, self.col + i % 3, self.row)

    def face(self, i=0):
        return sheet_tile(self.sheet, self.col + i % 3, self.row + 1)

    def base(self, i=0):
        return sheet_tile(self.sheet, self.col + i % 3, self.row + 2)


def battlements(dst, x_px, y_px, width_tiles, stone):
    """A crenellated crown: merlons (full height) alternating with lower gaps."""
    for i in range(width_tiles * 2):
        cap = stone.cap(i // 2)
        sx = (i % 2) * 16
        if i % 2 == 0:
            dst.alpha_composite(cap.crop((sx, 0, sx + 16, T)), (x_px + i * 16, y_px))
        else:
            dst.alpha_composite(cap.crop((sx, 0, sx + 16, 16)), (x_px + i * 16, y_px + 16))


def wall_run(width_tiles, body_tiles, stone):
    """Curtain wall seen from the front: battlements, wall face, footing."""
    h = 1 + body_tiles + 1
    img = Image.new('RGBA', (width_tiles * T, h * T), (0, 0, 0, 0))
    battlements(img, 0, 0, width_tiles, stone)
    for j in range(body_tiles):
        for i in range(width_tiles):
            img.alpha_composite(stone.face(i), (i * T, (1 + j) * T))
    for i in range(width_tiles):
        img.alpha_composite(stone.base(i), (i * T, (1 + body_tiles) * T))
    return img


def wall_side(height_tiles, stone):
    """Curtain wall running north-south: the walkway seen from above, with merlons
    biting into both edges."""
    img = Image.new('RGBA', (T, height_tiles * T), (0, 0, 0, 0))
    for j in range(height_tiles):
        img.alpha_composite(stone.cap(j), (0, j * T))
    face = stone.face(1)
    for j in range(height_tiles * 2):
        if j % 2:
            continue
        strip = face.crop((0, 0, 8, 16))
        img.alpha_composite(strip, (0, j * 16))
        img.alpha_composite(strip, (T - 8, j * 16))
    return img


def tower(stone, width=3, body=5):
    """Corner tower: an open, crenellated top over taller stonework."""
    h = 1 + body + 1
    img = Image.new('RGBA', (width * T, h * T), (0, 0, 0, 0))
    battlements(img, 0, 0, width, stone)
    for j in range(body):
        for i in range(width):
            img.alpha_composite(stone.face(i), (i * T, (1 + j) * T))
    for i in range(width):
        img.alpha_composite(stone.base(i), (i * T, (1 + body) * T))
    return img


def gatehouse(stone, doors, width=6, body=3):
    """Two blocks of stonework with an arched gate between them."""
    h = 1 + body + 1
    img = Image.new('RGBA', (width * T, h * T), (0, 0, 0, 0))
    gate_x = width // 2 - 1          # the gate is two tiles wide, centred
    battlements(img, 0, 0, width, stone)
    for j in range(body):
        for i in range(width):
            img.alpha_composite(stone.face(i), (i * T, (1 + j) * T))
    for i in range(width):
        img.alpha_composite(stone.base(i), (i * T, (1 + body) * T))
    img.alpha_composite(doors.crop((0, 0, 2 * T, 2 * T)), (gate_x * T, (body - 1) * T))
    return img, gate_x


def keep(stone, doors, windows, pillars, width=16, body=5):
    """The royal keep: a crenellated hall between two taller towers, with
    ornamental windows and a grand arched door."""
    hall_x, hall_w = 3, width - 6
    twr = tower(stone, width=3, body=body + 2)
    h_px = twr.height
    img = Image.new('RGBA', (width * T, h_px), (0, 0, 0, 0))
    hall_top = h_px - (1 + body + 1) * T
    battlements(img, hall_x * T, hall_top, hall_w, stone)
    for j in range(body):
        for i in range(hall_w):
            img.alpha_composite(stone.face(i), ((hall_x + i) * T, hall_top + (1 + j) * T))
    for i in range(hall_w):
        img.alpha_composite(stone.base(i), ((hall_x + i) * T, hall_top + (1 + body) * T))
    # ornamental windows along the facade
    win = windows.crop((0, 0, T, 3 * T))
    for i in (1, 2, hall_w - 3, hall_w - 2):
        img.alpha_composite(win, ((hall_x + i) * T, hall_top + T))
    # grand door in the middle, flanked by pillars
    dx = hall_x + hall_w // 2 - 1
    door_y = hall_top + (body - 1) * T
    img.alpha_composite(doors.crop((0, 0, 2 * T, 2 * T)), (dx * T, door_y))
    pil = pillars.crop((3 * T, 0, 4 * T, 3 * T))
    img.alpha_composite(pil, ((dx - 1) * T, door_y - T))
    img.alpha_composite(pil, ((dx + 2) * T, door_y - T))
    img.alpha_composite(twr, (0, 0))
    img.alpha_composite(twr, ((width - 3) * T, 0))
    return img, dx, (door_y + 2 * T) // T


def market_stall(roof, counter, width=3):
    """A shop counter under a shingled awning."""
    h = 3 + 2
    img = Image.new('RGBA', (width * T, h * T), (0, 0, 0, 0))
    for j in range(3):
        for i in range(width):
            tx = 1 if i == 0 else (3 if i == width - 1 else 2)
            img.alpha_composite(sheet_tile(roof, tx, j), (i * T, j * T))
    for j in range(2):
        for i in range(width):
            img.alpha_composite(sheet_tile(counter, 2 + i % 3, j), (i * T, (3 + j) * T))
    return img
