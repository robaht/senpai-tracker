#!/usr/bin/env python3
"""Generate all app icons from the pixel-art "DEATH book" sprite.

The design is a 48x48 pixel-art sprite drawn procedurally (GBA-style palette,
dithered vignette, black grimoire with DEATH lettering, red apple). Every
shipped icon asset is derived from it:

  assets/icon.png                     1024  iOS/Expo app icon
  assets/android-icon-foreground.png   512  adaptive foreground (transparent)
  assets/android-icon-background.png   512  adaptive background (vignette)
  assets/android-icon-monochrome.png   432  adaptive monochrome (white)
  public/favicon.png                    48  web favicon (1:1 pixels)
  public/favicon.svg                       vector favicon (one rect per run)
  public/apple-touch-icon.png          180  bg-padded 3x sprite

Run from the repo root: python3 scripts/generate-icons.py
"""

import struct
import zlib
from pathlib import Path

N = 48

P = {
    "bg0": "#140A20", "bg1": "#1C1030", "bg2": "#2A1A4A",
    "out": "#0A0612",
    "bk": "#12101A", "bkHi": "#3E3858", "bkSh": "#08060E",
    "ttl": "#E8E4F0", "dim": "#8A84A8",
    "pg": "#E7DEC4", "pgSh": "#C7BC9C",
    "ap": "#C8281C", "apSh": "#7E150C", "apHi": "#F2A08E",
    "stem": "#4A2E23", "leaf": "#2E9E3A",
    "spk": "#6A5A9C",
}

FONT = {
    "D": ["##.", "#.#", "#.#", "#.#", "##."],
    "E": ["###", "#..", "##.", "#..", "###"],
    "A": [".#.", "#.#", "###", "#.#", "#.#"],
    "T": ["###", ".#.", ".#.", ".#.", ".#."],
    "H": ["#.#", "#.#", "###", "#.#", "#.#"],
}


def rgba(hex_color):
    h = hex_color.lstrip("#")
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), 255)


def dit(x, y, a, b):
    return a if (x + y) & 1 else b


def sprite(bg=False, book=False, apple=False):
    """Return a 48x48 grid of RGBA tuples (None = transparent)."""
    g = [[None] * N for _ in range(N)]

    def px(x, y, c):
        if 0 <= x < N and 0 <= y < N:
            g[y][x] = rgba(P[c]) if isinstance(c, str) else c

    if bg:
        for y in range(N):
            for x in range(N):
                d = max(abs(x - 24), abs(y - 26)) / 24
                if d < 0.46:
                    c = "bg2"
                elif d < 0.52:
                    c = dit(x, y, "bg2", "bg1")
                elif d < 0.78:
                    c = "bg1"
                elif d < 0.84:
                    c = dit(x, y, "bg1", "bg0")
                else:
                    c = "bg0"
                px(x, y, c)
        for x, y in [(5, 14), (9, 30), (42, 18), (40, 34), (6, 40), (43, 7), (20, 4), (36, 44)]:
            px(x, y, "spk")

    if book:
        bx0, by0, bx1, by1 = 13, 14, 35, 40
        for x in range(bx0 + 1, bx1 + 2):
            px(x, by1 + 1, "pgSh")
        for y in range(by0 + 1, by1 + 2):
            px(bx1 + 1, y, "pg")
        px(bx1 + 1, by1 + 1, "pgSh")
        for x in range(bx0 + 1, bx1 + 3):
            px(x, by1 + 2, "out")
        for y in range(by0 + 1, by1 + 3):
            px(bx1 + 2, y, "out")
        for y in range(by0, by1 + 1):
            for x in range(bx0, bx1 + 1):
                border = x in (bx0, bx1) or y in (by0, by1)
                px(x, y, "out" if border else "bk")
        for x in range(bx0 + 1, bx1):
            px(x, by0 + 1, "bkHi")
        for y in range(by0 + 1, by1):
            px(bx0 + 1, y, "bkHi")
        for x in range(bx0 + 2, bx1):
            px(x, by1 - 1, "bkSh")
        for y in range(by0 + 2, by1):
            px(bx1 - 1, y, "bkSh")
        for x, y in [(15, 35), (16, 35), (15, 34), (33, 35), (32, 35), (33, 34)]:
            px(x, y, "dim")
        for i, ch in enumerate("DEATH"):
            gx = 15 + i * 4
            for r in range(5):
                for c in range(3):
                    if FONT[ch][r][c] == "#":
                        px(gx + c, 19 + r, "ttl")
        for x in range(21, 28):
            px(x, 26, "dim")

    if apple:
        acx, acy, r = 12.5, 38.5, 4.3

        def in_a(x, y):
            dx, dy = x + 0.5 - acx, y + 0.5 - acy
            return dx * dx + dy * dy <= r * r

        for y in range(33, 45):
            for x in range(7, 19):
                if not in_a(x, y):
                    continue
                if not (in_a(x - 1, y) and in_a(x + 1, y) and in_a(x, y - 1) and in_a(x, y + 1)):
                    px(x, y, "out")
                    continue
                dx, dy = x + 0.5 - acx, y + 0.5 - acy
                v = dx * 0.7 + dy
                px(x, y, "apHi" if v < -2.0 else ("apSh" if v > 1.4 else "ap"))
        px(12, 33, "stem"); px(12, 32, "stem"); px(13, 31, "stem")
        px(14, 32, "leaf"); px(15, 32, "leaf"); px(15, 31, "leaf")

    return g


def write_png(path, grid):
    h = len(grid)
    w = len(grid[0])
    raw = b""
    for row in grid:
        raw += b"\x00"
        for c in row:
            raw += bytes(c if c else (0, 0, 0, 0))

    def chunk(ctype, data):
        return (struct.pack(">I", len(data)) + ctype + data
                + struct.pack(">I", zlib.crc32(ctype + data) & 0xFFFFFFFF))

    ihdr = struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0)
    png = (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr)
           + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b""))
    Path(path).write_bytes(png)
    print(f"{path}  {w}x{h}  {len(png)} bytes")


def scale_nearest(src, size):
    n = len(src)
    return [[src[y * n // size][x * n // size] for x in range(size)] for y in range(size)]


def blit_scaled(dst, src, ox, oy, k):
    for sy in range(len(src)):
        for sx in range(len(src[0])):
            c = src[sy][sx]
            if c is None:
                continue
            for dy in range(oy + sy * k, oy + (sy + 1) * k):
                if not 0 <= dy < len(dst):
                    continue
                row = dst[dy]
                for dx in range(ox + sx * k, ox + (sx + 1) * k):
                    if 0 <= dx < len(row):
                        row[dx] = c


def solid(size, color):
    return [[rgba(color)] * size for _ in range(size)]


def transparent(size):
    return [[None] * size for _ in range(size)]


def whiten(grid):
    return [[(255, 255, 255, 255) if c else None for c in row] for row in grid]


def to_svg(grid):
    rects = []
    for y in range(N):
        x = 0
        while x < N:
            c = grid[y][x]
            run = 1
            while x + run < N and grid[y][x + run] == c:
                run += 1
            hexc = "#{:02x}{:02x}{:02x}".format(*c[:3])
            rects.append(f'<rect x="{x}" y="{y}" width="{run}" height="1" fill="{hexc}"/>')
            x += run
    return ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" '
            'shape-rendering="crispEdges">' + "".join(rects) + "</svg>\n")


def main():
    root = Path(__file__).resolve().parent.parent
    full = sprite(bg=True, book=True, apple=True)
    objects = sprite(book=True, apple=True)
    bg_only = sprite(bg=True)

    write_png(root / "assets/icon.png", scale_nearest(full, 1024))
    write_png(root / "public/favicon.png", full)
    (root / "public/favicon.svg").write_text(to_svg(full))
    print(f"{root / 'public/favicon.svg'}  vector")

    touch = solid(180, P["bg0"])
    blit_scaled(touch, full, 18, 18, 3)
    write_png(root / "public/apple-touch-icon.png", touch)

    fg = transparent(512)
    blit_scaled(fg, objects, 49, -3, 9)
    write_png(root / "assets/android-icon-foreground.png", fg)

    mono = transparent(432)
    blit_scaled(mono, whiten(objects), 32, -14, 8)
    write_png(root / "assets/android-icon-monochrome.png", mono)

    write_png(root / "assets/android-icon-background.png", scale_nearest(bg_only, 512))


if __name__ == "__main__":
    main()
