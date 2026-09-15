"""Build data/objects.js - the catalogue of everything that can stand in the world.

Run:  python3 tools/build_objects.py      (needs Pillow)

Nothing is cut into separate image files. Each object is a rectangle of one of the
two tilesets, and this script only works out its COLLISION BOX, by looking at the
sprite's own pixels: it finds what is actually drawn, and makes the solid part out
of the bottom slice of that - the trunk of a tree, the base of a house. A box can
therefore never disagree with the art, which is the mistake that is easiest to make
by hand and hardest to see.

`foot` says how much of the drawn height counts as footprint (0.4 = the bottom 40%).
`cols` overrides the rule for pieces that are solid in more than one place, and
`solid: False` marks flat scenery you can walk over.

EVERY rectangle below was read off a labelled contact sheet of the tileset
(tools/contact.py) rather than guessed. Guessing is how you end up drawing half a
ruin where you wanted a well, or two stacked houses where you wanted one.
"""
from PIL import Image
import json, os

HERE = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.join(HERE, '..', 'assets', 'pixelboy')
DATA = os.path.join(HERE, '..', 'data')
T = 16

SHEETS = {
    'medieval': Image.open(os.path.join(ASSETS, 'medieval.png')).convert('RGBA'),
    'nature': Image.open(os.path.join(ASSETS, 'nature.png')).convert('RGBA'),
}

# sheet, tile x, tile y, tiles wide, tiles tall, and how tall the footprint is
CATALOGUE = {
    # ---- the castle. These are the only multi-tile buildings on the sheet that
    # are one coherent drawing; everything larger is built out of the wall kit.
    # keep      : banner-topped pavilion, red curtains under the arches
    # hall      : stone hall, two lit windows over two arched gates
    # gate_tower: portcullis on the left, an open arch on the right - so the
    #             left half is solid all the way down and the right half is not
    'keep':       dict(sheet='medieval', sx=3, sy=3, w=2, h=3, foot=0.32, door=[8, 44, 16, 8]),
    'hall':       dict(sheet='medieval', sx=3, sy=6, w=2, h=2, foot=0.45, door=[6, 28, 20, 8]),
    'gate_tower': dict(sheet='medieval', sx=3, sy=8, w=2, h=3,
                       cols=[[0, 0, 16, 48], [16, 0, 16, 32]], door=[16, 32, 16, 16]),
    'keep_gate':  dict(sheet='medieval', sx=8, sy=8, w=2, h=3,
                       cols=[[0, 0, 16, 48], [16, 0, 16, 32]], door=[16, 32, 16, 16]),
    'watchtower': dict(sheet='medieval', sx=5, sy=6, w=1, h=2, foot=0.45),
    'statue':     dict(sheet='medieval', sx=7, sy=3, w=1, h=2, foot=0.35),
    'ruin':       dict(sheet='medieval', sx=17, sy=9, w=2, h=2, foot=0.45),

    # ---- the town. One tile each: cottages seen from the road, not enterable.
    'house_red':   dict(sheet='medieval', sx=6, sy=6, w=1, h=1, foot=0.55),
    'house_stone': dict(sheet='medieval', sx=7, sy=6, w=1, h=1, foot=0.55),
    'house_tan':   dict(sheet='medieval', sx=8, sy=6, w=1, h=1, foot=0.55),
    'hut':         dict(sheet='medieval', sx=9, sy=5, w=1, h=1, foot=0.60),
    'hut_round':   dict(sheet='medieval', sx=9, sy=4, w=1, h=1, foot=0.60),
    'tent':        dict(sheet='medieval', sx=8, sy=7, w=1, h=1, foot=0.60),
    'fountain':      dict(sheet='medieval', sx=5, sy=5, w=1, h=1, foot=0.80),
    'fountain_tall': dict(sheet='medieval', sx=6, sy=5, w=1, h=1, foot=0.70),
    'shrine':      dict(sheet='medieval', sx=11, sy=6, w=1, h=1, foot=0.55),
    'grave':       dict(sheet='medieval', sx=11, sy=7, w=1, h=1, foot=0.55),

    # ---- nature. tree_pair and tree_tall are drawn across two cells: taking one
    # half of either gives a tree sliced down the middle.
    'tree':      dict(sheet='medieval', sx=13, sy=5, w=1, h=1, foot=0.30),
    'tree_pair': dict(sheet='medieval', sx=11, sy=5, w=2, h=1, foot=0.30),
    'tree_tall': dict(sheet='medieval', sx=14, sy=4, w=2, h=2, foot=0.20),
    'tree_big':  dict(sheet='medieval', sx=15, sy=9, w=2, h=2, foot=0.25),
    'tree_bare': dict(sheet='medieval', sx=12, sy=7, w=1, h=1, foot=0.30),
    'bush':      dict(sheet='medieval', sx=10, sy=5, w=1, h=1, solid=False),
    'rock':      dict(sheet='medieval', sx=15, sy=7, w=1, h=1, foot=0.80),
    'pebbles':   dict(sheet='medieval', sx=12, sy=6, w=1, h=1, solid=False),
    'twigs':     dict(sheet='medieval', sx=13, sy=6, w=1, h=1, solid=False),

    # ---- props
    'sign':     dict(sheet='medieval', sx=17, sy=4, w=1, h=1, foot=0.40),
    'cart':     dict(sheet='medieval', sx=16, sy=4, w=1, h=1, foot=0.60),
    'barrel':   dict(sheet='medieval', sx=16, sy=5, w=1, h=1, foot=0.65),
    'table':    dict(sheet='medieval', sx=17, sy=5, w=1, h=1, foot=0.65),
    'crate':    dict(sheet='medieval', sx=17, sy=7, w=1, h=1, foot=0.70),
    'pen':      dict(sheet='medieval', sx=16, sy=6, w=1, h=1, foot=0.85),
    'campfire': dict(sheet='medieval', sx=16, sy=7, w=1, h=1, foot=0.60),
    'chair':    dict(sheet='medieval', sx=16, sy=8, w=1, h=1, foot=0.70),

    # ---- indoors. The hall pieces come from the room kit on the nature sheet:
    # a colonnade, a seat of state, a floor seal and a long table, which between
    # them are the difference between a throne hall and a large empty room.
    'throne':    dict(sheet='nature', sx=17, sy=38, w=1, h=1, foot=0.55),
    'seal':      dict(sheet='nature', sx=18, sy=35, w=2, h=2, solid=False),
    'colonnade': dict(sheet='nature', sx=18, sy=37, w=1, h=1, foot=0.60),
    'banquet':   dict(sheet='nature', sx=18, sy=38, w=3, h=1, foot=0.55),
    'bench':     dict(sheet='nature', sx=16, sy=38, w=1, h=1, foot=0.60),
    'portrait':  dict(sheet='nature', sx=19, sy=39, w=1, h=1, solid=False),
    'chest':  dict(sheet='nature', sx=3, sy=38, w=1, h=1, foot=0.65),
    'shelf':  dict(sheet='nature', sx=11, sy=38, w=1, h=1, foot=0.80),
    'pot':    dict(sheet='nature', sx=1, sy=38, w=1, h=1, foot=0.65),
    'banner': dict(sheet='nature', sx=12, sy=39, w=1, h=1, solid=False),
}


def drawn_box(sheet, sx, sy, w, h):
    """The rectangle the artist actually painted inside this cell, in pixels
    relative to the cell's top-left corner."""
    cell = SHEETS[sheet].crop((sx * T, sy * T, (sx + w) * T, (sy + h) * T))
    box = cell.getbbox()          # None when the cell is empty
    return box or (0, 0, cell.width, cell.height)


def build():
    out = {}
    for name, spec in CATALOGUE.items():
        o = {k: spec[k] for k in ('sheet', 'sx', 'sy', 'w', 'h')}
        x0, y0, x1, y1 = drawn_box(spec['sheet'], spec['sx'], spec['sy'], spec['w'], spec['h'])
        o['art'] = [x0, y0, x1 - x0, y1 - y0]
        if spec.get('solid') is False:
            o['solid'] = False
        elif 'cols' in spec:
            o['cols'] = spec['cols']
        else:
            foot = spec.get('foot', 0.5)
            fh = max(3, round((y1 - y0) * foot))
            o['col'] = [x0, y1 - fh, x1 - x0, fh]
        if 'door' in spec:
            o['door'] = spec['door']
        out[name] = o
    return out


objects = build()
with open(os.path.join(DATA, 'objects.js'), 'w') as f:
    f.write('/* GENERATED by tools/build_objects.py - edit the catalogue there, not here.\n'
            ' *\n'
            ' * sheet/sx/sy/w/h : which rectangle of which tileset to draw (in tiles of 16 px)\n'
            ' * art             : the part of that rectangle the artist actually painted\n'
            ' * col / cols      : the solid box(es), in pixels from the sprite top-left,\n'
            ' *                   worked out from the art itself\n'
            ' * door            : the doorway, shown by the debug overlay\n'
            ' * solid:false     : flat scenery, walk straight over it\n'
            ' */\n')
    f.write('window.PACIFER_OBJECTS = ' + json.dumps(objects, indent=1) + ';\n')

print(f'{len(objects)} objects ->', os.path.relpath(os.path.join(DATA, 'objects.js'), HERE))
for n, o in objects.items():
    a = o.get('art', [0, 0, 0, 0])
    if a[2] == 0 or a[3] == 0:
        print('  WARNING: nothing drawn in cell for', n)
    elif a[2] * a[3] < 40:
        print(f'  WARNING: {n} is only {a[2]}x{a[3]} px of art - too small to read')
