# The castle on the loading screen (0.6.83): an original block castle like the game's castles
# (castle stone, red and blue roof tiles, moat and bridge). Writes an SVG; turn it into the PNG the game uses with:
#   python scripts/splash-castle.py castle.svg && rsvg-convert castle.svg -o www/splash/castle.png
import random, sys
random.seed(7)
B = 10          # block size in px
W, H = 400, 330   # castle layer only: the sky and the ground are drawn by the page around it
G = 310           # ground line (y px) under the castle

def shade(hexc, f):
    h = hexc.lstrip('#'); r, g, b = int(h[0:2],16), int(h[2:4],16), int(h[4:6],16)
    c = lambda v: max(0, min(255, int(v*f)))
    return '#%02x%02x%02x' % (c(r), c(g), c(b))

out = []
def rect(x, y, w, h, fill, extra=''):
    out.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="{fill}" {extra}/>')

def block(col, row, color, light=1.0, top=True, noise=0.08):
    # col from the left, row from the ground up (0 = first row above the ground)
    x = col*B; y = G - (row+1)*B
    f = light * (1 + random.uniform(-noise, noise))
    base = shade(color, f)
    rect(x, y, B, B, base)
    rect(x, y, B, 1.5, shade(color, f*1.18))          # lit top edge
    rect(x, y, 1.5, B, shade(color, f*1.10))          # lit left edge
    rect(x, y+B-1.5, B, 1.5, shade(color, f*0.72))    # shadow bottom edge
    rect(x+B-1.5, y, 1.5, B, shade(color, f*0.80))    # shadow right edge

STONE = '#9a9ca3'; STONE_D = '#7d7f86'
RED = '#b8432f'; BLUE = '#2f62b0'; WOOD = '#8a5a2b'; DARK = '#2a2530'
GLOW = '#f6b94a'; GRASS = '#5ea93e'; DIRT = '#7a5230'; WATER = '#3b7cc6'

grid = {}
def put(c, r, color, **k): grid[(c, r)] = (color, k)

# keep (behind)
for c in range(14, 26):
    for r in range(0, 21): put(c, r, STONE_D, light=0.92)
for i, r in enumerate(range(21, 27)):
    for c in range(14+i, 26-i): put(c, r, RED, light=0.95)
# curtain wall
for c in range(8, 32):
    for r in range(0, 10): put(c, r, STONE)
for c in range(8, 32, 2): put(c, 10, STONE)
# towers
def tower(c0, c1, roof):
    for c in range(c0, c1+1):
        for r in range(0, 17): put(c, r, STONE, light=1.04 if c > (c0+c1)/2 else 0.9)
    for i, r in enumerate(range(17, 23)):
        for c in range(c0-1+i, c1+2-i): put(c, r, roof)
tower(3, 9, RED)
tower(30, 36, BLUE)
# windows
for c, r in [(6, 12), (6, 7), (33, 12), (33, 7), (17, 16), (22, 16), (19, 18), (20, 18)]:
    put(c, r, GLOW, light=1.0, noise=0.02); put(c, r+1, GLOW, light=1.05, noise=0.02)
for c in [11, 14, 25, 28]:
    put(c, 6, DARK, noise=0.0)
# gate
for c in range(18, 22):
    for r in range(0, 6): put(c, r, DARK, noise=0.0)
put(17, 5, STONE); put(22, 5, STONE)
put(18, 6, STONE); put(21, 6, STONE)


def castle_layer():
    out.clear()
    out.append(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W*2}" height="{H*2}">')
    out.append('<defs><linearGradient id="warm" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#1a2440" stop-opacity="0.22"/><stop offset="0.6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#ffcf80" stop-opacity="0.16"/></linearGradient></defs>')
    random.seed(11)
    for (c, r), (color, k) in sorted(grid.items(), key=lambda t: (t[0][1], t[0][0])):
        block(c, r, color, **k)
    for x, top, col in [(60, G-23*B, '#e0463a'), (330, G-23*B, '#f2c230'), (200, G-27*B, '#3fa7e0')]:
        rect(x-1, top-30, 3, 30, '#4a3220')
        rect(x+2, top-30, 18, 11, col)
        rect(x+2, top-30, 18, 2, shade(col, 1.2))
    for c in range(18, 22):
        rect(c*B+4, G-6*B, 2, 6*B, '#5a4a3a')
    for r in range(1, 6):
        rect(18*B, G-r*B, 4*B, 2, '#5a4a3a')
    for tc in [0, 37]:
        for r in range(0, 3): block(tc+1, r, WOOD)
        for r in range(3, 7):
            for c in range(tc, tc+3): block(c, r, '#2f6b2e', light=0.9)
    # moat and bridge (the page draws the grass and earth below)
    for c in range(0, 40):
        water = 2 <= c <= 37
        block(c, -1, WATER if water else GRASS, light=0.95 if water else 1.0, noise=0.05)
        block(c, -2, WATER if water else DIRT, light=0.85, noise=0.05)
    for c in range(18, 22):
        block(c, -1, WOOD); block(c, -2, WOOD, light=0.9)
    out.append('</svg>')
    return '\n'.join(out)

open(sys.argv[1], 'w').write(castle_layer())
