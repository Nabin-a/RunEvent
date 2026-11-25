"""Registration stepper rabbits from the supplied 10-pose set (25 Nov 2026, user request):
07 (wiping sweat) where the rabbit stops on a middle step, 06 (cheerful stride) on the last step.

Run from the repository root:  python tools/build-step-mascots.py
Then:                          python tools/recolor-mascot-line.py src/assets/mascot src/assets/mascot-line

Per pose: the flat grey background is keyed out (flood fill from the edges, soft edge), the ground
shadow is kept as a see-through grey, and the picture is trimmed and scaled to 240px tall like the
other stepper sprites. The outfit keeps its supplied blue and lime, the same as the stepper's run,
stand and cheer sprites, so the rabbit does not change clothes when it stops. (recolor() turns blue
to slate and lime to mint if the stepper sprites are ever moved to the site palette.)
"""
import colorsys
import os
from collections import deque

import numpy as np
from PIL import Image

SRC = os.path.join('กระต่าย_KraTai', '10 ท่า', 'Rabbit_10_Act', 'JPG')
OUT = os.path.join('src', 'assets', 'mascot')
POSES = {'step-tired.webp': '07.jpg', 'step-finish.webp': '06.jpg'}
HEIGHT = 240

SLATE = colorsys.rgb_to_hsv(0x34 / 255, 0x49 / 255, 0x5f / 255)
MINT = colorsys.rgb_to_hsv(0x9b / 255, 0xe8 / 255, 0xc7 / 255)


def key_background(img):
    rgb = np.asarray(img.convert('RGB'), dtype=np.int32)
    h, w, _ = rgb.shape
    bg = np.median(np.concatenate([rgb[0], rgb[-1], rgb[:, 0], rgb[:, -1]]), axis=0)
    dist = np.sqrt(((rgb - bg) ** 2).sum(axis=-1))
    # flood fill the background from the border through pixels close to the backdrop colour
    seen = np.zeros((h, w), dtype=bool)
    q = deque()
    for x in range(w):
        q.append((0, x))
        q.append((h - 1, x))
    for y in range(h):
        q.append((y, 0))
        q.append((y, w - 1))
    while q:
        y, x = q.popleft()
        if y < 0 or y >= h or x < 0 or x >= w or seen[y, x] or dist[y, x] > 14:
            continue
        seen[y, x] = True
        q.extend(((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)))
    alpha = np.where(seen, 0, 255).astype(np.float32)
    # soft edge: pixels touching the background fade with their distance from the backdrop colour
    edge = np.zeros_like(seen)
    edge[1:, :] |= seen[:-1, :]
    edge[:-1, :] |= seen[1:, :]
    edge[:, 1:] |= seen[:, :-1]
    edge[:, :-1] |= seen[:, 1:]
    edge &= ~seen
    alpha[edge] = np.clip((dist[edge] - 6) / 40, 0.15, 1) * 255
    # the ground shadow (a darker flat grey, low saturation) becomes see-through
    mx = rgb.max(axis=-1)
    mn = rgb.min(axis=-1)
    shadow = (~seen) & (mx - mn < 14) & (mx > 140) & (mx < bg.max() - 10)
    out = np.dstack([rgb, alpha]).astype(np.float32)
    out[shadow, :3] = 40
    out[shadow, 3] = 70
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), 'RGBA')


def recolor(img):
    px = img.load()
    w, h = img.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            hh, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
            hd = hh * 360
            if 190 <= hd <= 240 and s >= 0.45:
                # blue shirt, cuffs, shorts, shoes -> slate, keeping the light and dark shading
                nv = min(1.0, SLATE[2] * v / 0.78)
                nr, ng, nb = colorsys.hsv_to_rgb(SLATE[0], SLATE[1], nv)
            elif 50 <= hd <= 90 and s >= 0.35:
                # lime panels and shoe trims -> mint
                nv = min(1.0, MINT[2] * v / 0.85)
                nr, ng, nb = colorsys.hsv_to_rgb(MINT[0], MINT[1], nv)
            else:
                continue
            px[x, y] = (round(nr * 255), round(ng * 255), round(nb * 255), a)
    return img


def main():
    os.makedirs(OUT, exist_ok=True)
    for out, src in POSES.items():
        img = key_background(Image.open(os.path.join(SRC, src)))
        img = img.crop(img.getchannel('A').point(lambda a: 255 if a > 24 else 0).getbbox())
        img = img.resize((round(img.width * HEIGHT / img.height), HEIGHT), Image.LANCZOS)
        img.save(os.path.join(OUT, out), 'WEBP', quality=88, method=6)
        print(out, '<-', src, img.size)


if __name__ == '__main__':
    main()
