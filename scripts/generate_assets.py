#!/usr/bin/env python3
"""
Generates all visual identity assets for ENKEL using the official pixel-art notepad & pencil icon:
- Sidebar logo & README banner (src/assets/logo.svg, docs/assets/logo-banner.svg, docs/assets/logo-banner.png)
- Application icons (icon.ico, icon.png, 32x32.png, 128x128.png, 128x128@2x.png)
Uses only Python standard library (zlib, base64, struct, os).
"""

import base64
import os
import struct
import zlib

BG_BLACK = (8, 9, 9, 255)           # #080909 - Pure deep black background
FG_WHITE = (255, 255, 255, 255)     # #FFFFFF - Crisp white pixel art
TRANSPARENT = (0, 0, 0, 0)

ICON_W = 490
ICON_H = 416
ICON_MASK_B64 = (
    "eNrt3UGS4yAQBMDi/5/e48TG7nhibEA0nXW3EaSQbIUako8zvk2m58aWqmS8zLaGxr5ecV48MGNbWxs7dRP0tFHZ1dTOPl0mPUiT"
    "PhGANOnO1KRJkyZNmjRp0qRJkyZNmrQnJ6RJkyZNmrRfZKRJkyZNmjRp0qRJkyZNmjRp0qRJexpKmjRp0qRJkyZNmjRp/7JIkyZ9"
    "qfSQD0MaNWnSpEmTJk2aNGnSpEkLaSFNmjRp0qRJoyZNmjRp0qRJkxa/vYU0adKkSZMmTZo0adKoSYNeIF2rBExdVgVpFXhLOqzW"
    "8s7Jq6r21y2ddaZ82CGrXywbWtKkSZMmTZo0adKkSZMmTZo0adKkSZMmTZo0adKkSZMmTZo0adKkSZMmTZp0iXdDSZMmTZq0+zRp"
    "0qRJkyZNmvQnwxLSF0gfVv2b1Dlg0mmy1gBp0o8cDy9zWkgLadKkSZMmTZo0adKkqw7thIfxpLtIe0ZGmjRpcZ8W0qRJkyZNmvQF"
    "0iFNmvRN0iFNmvRN0iHdQzqkW0g/U0JEert0SPeQDuke0iHdQzqke0iHdA/pkO4hHdI9pEO6h3RI95AO6R7SId1DOqSFtExdinq6"
    "9KiUQornDQXpJcO1fOBJHzKfSZMmTZo0adKkSZMmTZo0adKkSS/bXJE0adKkSbtPkzanSZvTpEmTJk2aNGnSfnuTJk3a1Zs0adKk"
    "SZMmTZo0adLPS8uZp7766Rr7rpxYPy2PSVsTgTRp0qRJC2khTZo0adKkSZMmTZo0adKkSZMW0kKaNGnSpEmTJk2aNGnSpEmTJi2k"
    "hTRp0iBJX1BISZo0adKkSZMm/Yh0q6VMOksP0qRJkyZNmjRp0qRJkyZNmjRp0qRJkyZNmjRp0qRJkyZNmjRp0qRJkyZNmjRp0qRJ"
    "L90YjfQR0jv6QbqGdEiTJr2jsGxSy6QPgV7eMOlDZvTyZm+UTu6qnd11KqXKiiy5tEo6pEmTJv2GdEiTJk2atPs0adKkSZMmTZo0"
    "adKkSZMmTZo0adKkSXvuTZo0adKkSZMm3VL69ZeR3l56s/jF7lcfIl3rIv2mdKkdOEmTJk2aNGnSpEmTJk2aNGnSpEnvWv6CdJt1"
    "TkiTJk2aNGnSpEmTJk2aNGnSpEmTJk2aNGnSu17rTq3tBUi/3dJpyqQfuEgnZ1aokCZdVnqQJk2aNGnSpEmTJk2aNGnSpEmTJk2a"
    "NGnSpEnHZtKkSZMmTZo0adKkSZMmTZo06dqVGqTXSFcaONJLpEOaNGnSpEmTJk2aNGnSpEmTJk2aNGnSpEmTJk2aNGnSpEmTbrIH"
    "3o4iNNKkSZMmTZr009KD9PHWf/V/fo1/SFf9/3XB8JAmTXq69NdHBumLpA8bWtKkSZMmTZo0adKkSZMmTZo0adKkSZMmTZo0adKk"
    "SZMmTZo0adKkSZOecjzfHOHYnZ+7tYP6okk0asdrt6RJkyZNmjRp0qRJkyZNmjRp0qRJkyZNmjRp0qRJkyZNmjRp0qRJkyZNmjRp"
    "0qRJkyZNmjRp0qRJkyZNmjTpztLj5LEL6h6JuNTIf73/dT/mfEDUZOoDIC2khbSQFtKkSZMmTZo0adKkhbSQFtJCmjRp0qRJkyZN"
    "mjRp0kJaSAtpIU2aNOp20n8A2WQEGg=="
)

ICON_MASK = zlib.decompress(base64.b64decode(ICON_MASK_B64))

SVG_ICON_GRID = [
    "......####.......####......####..................",
    "......####.......####......####..................",
    "......####.......####......####..................",
    "......####.......####......####..................",
    "..#################################..............",
    "..#################################..............",
    "..########.......####......####..................",
    "###...####.......####......####....###...........",
    "###...####.......####......####....###...........",
    "###...####.......####......####....###...........",
    "###................................###...........",
    "###................................###....####...",
    "###................................##.....####...",
    "###................................#......####...",
    "###.....#################.............####....###",
    "###.....#################.............####....###",
    "###.....#################.............####....###",
    "###................................###....####...",
    "###................................###....####...",
    "###................................###....####...",
    "###.............................###.......####...",
    "###.....##############..........###.......####...",
    "###.....##############..........###.......####...",
    "###.....##############.......#####.....###.......",
    "###..........................###.......###.......",
    "###..........................###.......###.......",
    "###........................##........##..........",
    "###.....##########.........##........##..........",
    "###.....##########......#####.....#####..........",
    "###.....##########......###.......###............",
    "###.....................###.......###............",
    "###.....................###.....##...............",
    "###.....................###.....##...............",
    "###........................#####.................",
    "###........................#####...###...........",
    "###........................#####...###...........",
    "...###################.............###...........",
    "...###################.............###...........",
    "...###################.............###...........",
    "......................#############..............",
    "......................#############..............",
    "......................#############..............",
]

# Clean pixel-art letters for E, N, K, E, L (7x11)
PIXEL_LETTERS = {
    "E": [
        "#######",
        "#######",
        "##.....",
        "##.....",
        "#####..",
        "#####..",
        "##.....",
        "##.....",
        "##.....",
        "#######",
        "#######",
    ],
    "N": [
        "##...##",
        "###..##",
        "####.##",
        "####.##",
        "#######",
        "##.####",
        "##.####",
        "##..###",
        "##..###",
        "##...##",
        "##...##",
    ],
    "K": [
        "##...##",
        "##..##.",
        "##.##..",
        "####...",
        "###....",
        "####...",
        "##.##..",
        "##..##.",
        "##..##.",
        "##...##",
        "##...##",
    ],
    "L": [
        "##.....",
        "##.....",
        "##.....",
        "##.....",
        "##.....",
        "##.....",
        "##.....",
        "##.....",
        "##.....",
        "#######",
        "#######",
    ],
}


def build_word_grid(word: str, spacing: int = 2):
    rows = 11
    grid = [[] for _ in range(rows)]
    for idx, ch in enumerate(word):
        glyph = PIXEL_LETTERS[ch]
        for r in range(rows):
            grid[r].extend([1 if c == "#" else 0 for c in glyph[r]])
            if idx < len(word) - 1:
                grid[r].extend([0] * spacing)
    return grid


def write_png(filepath: str, width: int, height: int, rgba_rows):
    """Writes an RGBA pixel buffer to a standard PNG file."""
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    raw = bytearray()
    for row in rgba_rows:
        raw.append(0)
        for r, g, b, a in row:
            raw.extend((r, g, b, a))

    def make_chunk(chunk_type: bytes, data: bytes) -> bytes:
        chunk = chunk_type + data
        crc = zlib.crc32(chunk) & 0xFFFFFFFF
        return struct.pack(">I", len(data)) + chunk + struct.pack(">I", crc)

    ihdr = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)
    idat = zlib.compress(bytes(raw), level=9)
    png_bytes = (
        b"\x89PNG\r\n\x1a\n"
        + make_chunk(b"IHDR", ihdr)
        + make_chunk(b"IDAT", idat)
        + make_chunk(b"IEND", b"")
    )
    with open(filepath, "wb") as f:
        f.write(png_bytes)


def write_ico(filepath: str, png_entries):
    """Writes a multi-resolution Windows .ico file embedding PNG payloads."""
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    count = len(png_entries)
    header = struct.pack("<HHH", 0, 1, count)
    offset = 6 + count * 16
    entries = bytearray()
    payload = bytearray()

    for size, png_data in png_entries:
        w = 0 if size >= 256 else size
        h = 0 if size >= 256 else size
        entry = struct.pack(
            "<BBBBHHII",
            w,
            h,
            0,
            0,
            1,
            32,
            len(png_data),
            offset,
        )
        entries.extend(entry)
        payload.extend(png_data)
        offset += len(png_data)

    with open(filepath, "wb") as f:
        f.write(header + entries + payload)


def generate_wordmark_svg(filepath: str, transparent_bg: bool = True):
    """
    Generates the vector SVG with the notepad & pencil pixel icon on the left
    and the ENKEL pixel wordmark on the right.
    """
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    icon_rows = len(SVG_ICON_GRID)      # 42
    icon_cols = len(SVG_ICON_GRID[0])   # 49
    icon_scale = 3                      # 42 * 3 = 126px tall

    word_grid = build_word_grid("ENKEL", spacing=2)
    word_rows = len(word_grid)          # 11
    word_cols = len(word_grid[0])       # 43
    word_scale = 10                     # 11 * 10 = 110px tall

    pad_x = 24
    pad_y = 20
    gap_x = 32

    icon_w_px = icon_cols * icon_scale
    icon_h_px = icon_rows * icon_scale
    word_w_px = word_cols * word_scale
    word_h_px = word_rows * word_scale

    total_w = pad_x * 2 + icon_w_px + gap_x + word_w_px
    total_h = pad_y * 2 + icon_h_px

    lines = [
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {total_w} {total_h}" width="{total_w}" height="{total_h}" shape-rendering="crispEdges">'
    ]
    if not transparent_bg:
        lines.append(f'  <rect width="{total_w}" height="{total_h}" rx="16" fill="#080909"/>')

    # 1. Notepad + pencil pixel icon on the left
    for r in range(icon_rows):
        c = 0
        row_str = SVG_ICON_GRID[r]
        while c < icon_cols:
            if row_str[c] == "#":
                start = c
                while c < icon_cols and row_str[c] == "#":
                    c += 1
                x = pad_x + start * icon_scale
                y = pad_y + r * icon_scale
                w = (c - start) * icon_scale
                lines.append(f'  <rect x="{x}" y="{y}" width="{w}" height="{icon_scale}" fill="#FFFFFF"/>')
            else:
                c += 1

    # 2. ENKEL pixel wordmark on the right
    word_ox = pad_x + icon_w_px + gap_x
    word_oy = pad_y + (icon_h_px - word_h_px) // 2
    for r in range(word_rows):
        c = 0
        while c < word_cols:
            if word_grid[r][c] == 1:
                start = c
                while c < word_cols and word_grid[r][c] == 1:
                    c += 1
                x = word_ox + start * word_scale
                y = word_oy + r * word_scale
                w = (c - start) * word_scale
                lines.append(f'  <rect x="{x}" y="{y}" width="{w}" height="{word_scale}" fill="#FFFFFF"/>')
            else:
                c += 1

    lines.append("</svg>")
    with open(filepath, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")


def generate_wordmark_png(filepath: str):
    """Generates the dark banner PNG with the notepad & pencil pixel icon + ENKEL wordmark."""
    icon_rows = len(SVG_ICON_GRID)
    icon_cols = len(SVG_ICON_GRID[0])
    icon_scale = 3

    word_grid = build_word_grid("ENKEL", spacing=2)
    word_rows = len(word_grid)
    word_cols = len(word_grid[0])
    word_scale = 10

    pad_x = 32
    pad_y = 24
    gap_x = 32

    icon_w_px = icon_cols * icon_scale
    icon_h_px = icon_rows * icon_scale
    word_w_px = word_cols * word_scale
    word_h_px = word_rows * word_scale

    total_w = pad_x * 2 + icon_w_px + gap_x + word_w_px
    total_h = pad_y * 2 + icon_h_px

    canvas = [[BG_BLACK for _ in range(total_w)] for _ in range(total_h)]

    for r in range(icon_rows):
        for c in range(icon_cols):
            if SVG_ICON_GRID[r][c] == "#":
                for dy in range(icon_scale):
                    for dx in range(icon_scale):
                        canvas[pad_y + r * icon_scale + dy][pad_x + c * icon_scale + dx] = FG_WHITE

    word_ox = pad_x + icon_w_px + gap_x
    word_oy = pad_y + (icon_h_px - word_h_px) // 2
    for r in range(word_rows):
        for c in range(word_cols):
            if word_grid[r][c] == 1:
                for dy in range(word_scale):
                    for dx in range(word_scale):
                        canvas[word_oy + r * word_scale + dy][word_ox + c * word_scale + dx] = FG_WHITE

    write_png(filepath, total_w, total_h, canvas)


def render_app_icon_buffer(size: int):
    """
    Renders a square size x size RGBA buffer of the official pixel-art notepad & pencil icon
    on a smooth anti-aliased rounded-square black badge using exact area-averaging so thin
    strokes and inner lines stay sharp and balanced even at 24x24 and 32x32 on the taskbar.
    """
    canvas = [[TRANSPARENT for _ in range(size)] for _ in range(size)]

    pad = size * 0.08
    rad = size * 0.21
    x0 = pad
    y0 = pad
    x1 = size - pad
    y1 = size - pad

    # 4x4 supersampled anti-aliased rounded-square black badge
    sub = 4
    inv_sub = 1.0 / sub
    for y in range(size):
        for x in range(size):
            inside = 0
            for sy in range(sub):
                py = y + (sy + 0.5) * inv_sub
                if py < y0 or py > y1:
                    continue
                dy = 0.0
                if py < y0 + rad:
                    dy = (y0 + rad) - py
                elif py > y1 - rad:
                    dy = py - (y1 - rad)
                for sx in range(sub):
                    px = x + (sx + 0.5) * inv_sub
                    if px < x0 or px > x1:
                        continue
                    dx = 0.0
                    if px < x0 + rad:
                        dx = (x0 + rad) - px
                    elif px > x1 - rad:
                        dx = px - (x1 - rad)
                    if dx * dx + dy * dy <= rad * rad:
                        inside += 1
            if inside > 0:
                alpha = int(round(255 * inside / (sub * sub)))
                canvas[y][x] = (10, 11, 11, alpha)

    # Fit the 490x416 icon centered inside the badge with smooth exact area-averaging
    avail = size - 2.0 * pad
    draw_w = max(1, int(round(avail * 0.70)))
    draw_h = max(1, int(round(draw_w * ICON_H / ICON_W)))
    ox = (size - draw_w) // 2
    oy = (size - draw_h) // 2

    for ty in range(draw_h):
        sy0 = int(ty * ICON_H / draw_h)
        sy1 = max(sy0 + 1, int((ty + 1) * ICON_H / draw_h))
        for tx in range(draw_w):
            sx0 = int(tx * ICON_W / draw_w)
            sx1 = max(sx0 + 1, int((tx + 1) * ICON_W / draw_w))
            total = (sy1 - sy0) * (sx1 - sx0)
            hits = 0
            for sy in range(sy0, sy1):
                row_off = sy * ICON_W
                for sx in range(sx0, sx1):
                    if ICON_MASK[row_off + sx]:
                        hits += 1
            if hits > 0:
                cov = hits / total
                # Keep high-res crisp while preserving smooth readable anti-aliasing at small sizes
                if size >= 128:
                    cov = 1.0 if cov >= 0.45 else (cov / 0.45) * 0.35
                py = oy + ty
                px = ox + tx
                if 0 <= py < size and 0 <= px < size:
                    br, bg, bb, ba = canvas[py][px]
                    fr = int(round(br * (1.0 - cov) + 246 * cov))
                    fg = int(round(bg * (1.0 - cov) + 248 * cov))
                    fb = int(round(bb * (1.0 - cov) + 248 * cov))
                    canvas[py][px] = (fr, fg, fb, max(ba, int(round(255 * cov))))

    return canvas


def main():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    # 1. Wordmark SVGs & PNGs (Sidebar Logo & README Banner)
    generate_wordmark_svg(os.path.join(base_dir, "src", "assets", "logo.svg"), transparent_bg=True)
    generate_wordmark_svg(os.path.join(base_dir, "docs", "assets", "logo-banner.svg"), transparent_bg=False)
    generate_wordmark_png(os.path.join(base_dir, "docs", "assets", "logo-banner.png"))

    # 2. App icons for Tauri & Windows executable/installer
    icons_dir = os.path.join(base_dir, "src-tauri", "icons")
    size_map = {
        "32x32.png": 32,
        "128x128.png": 128,
        "128x128@2x.png": 256,
        "icon.png": 512,
    }
    for filename, sz in size_map.items():
        buf = render_app_icon_buffer(sz)
        write_png(os.path.join(icons_dir, filename), sz, sz, buf)

    # Multi-resolution .ico (16, 24, 32, 48, 64, 128, 256)
    ico_entries = []
    for sz in (16, 24, 32, 48, 64, 128, 256):
        tmp_path = os.path.join(icons_dir, f"_tmp_{sz}.png")
        buf = render_app_icon_buffer(sz)
        write_png(tmp_path, sz, sz, buf)
        with open(tmp_path, "rb") as f:
            ico_entries.append((sz, f.read()))
        os.remove(tmp_path)

    write_ico(os.path.join(icons_dir, "icon.ico"), ico_entries)
    print("All ENKEL notepad & pencil pixel icons generated successfully.")


if __name__ == "__main__":
    main()
