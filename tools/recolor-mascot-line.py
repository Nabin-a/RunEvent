"""Recolour the registration stepper rabbits for the LINE theme (25 Nov 2026): the yellow/blue
sprites go yellow -> green, blue -> charcoal (map_px handles slate/mint art the same way).
The animated clips in anim/ are skipped: they keep their usual colours in every theme.
The profile menu rabbits are not made here: they come from output/line-night
(tools/build-line-night-assets.py).
Usage: python tools/recolor-mascot-line.py src/assets/mascot src/assets/mascot-line"""
import sys, os, colorsys
from PIL import Image

LINE_H = 145 / 360  # LINE green #06C755

def map_px(r, g, b, a):
    if a == 0:
        return (r, g, b, a)
    h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
    hd = h * 360
    # the soft ground shadow is a see-through slate: keep it, just without the blue tint
    if a < 160 and 175 <= hd <= 235 and v < 0.35:
        return (round(v * 255), round(v * 255), round(v * 255), a)
    # slate shirt/sleeve trims: blue-teal hue, some saturation, darker than the skin
    if 175 <= hd <= 235 and s >= 0.3 and 0.12 <= v <= 0.72:
        nv = min(1.0, 0.42 + (v - 0.12) * 0.95)
        ns = min(1.0, 0.75 + s * 0.3)
        nr, ng, nb = colorsys.hsv_to_rgb(LINE_H, ns, nv)
        return (round(nr * 255), round(ng * 255), round(nb * 255), a)
    # mint sleeves/shorts/shoe trims: green-aqua hue, light
    if 120 <= hd <= 178 and s >= 0.12 and v >= 0.5:
        nv = 0.10 + (v - 0.5) * 0.45
        nr, ng, nb = colorsys.hsv_to_rgb(0, 0, nv)
        return (round(nr * 255), round(ng * 255), round(nb * 255), a)
    return (r, g, b, a)

def map_px_sprite(r, g, b, a):
    """older step-tracker sprites: yellow shirt -> LINE green, blue shorts/shoes -> charcoal"""
    if a == 0:
        return (r, g, b, a)
    h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
    hd = h * 360
    if 35 <= hd <= 80 and s >= 0.35 and v >= 0.45:
        nr, ng, nb = colorsys.hsv_to_rgb(LINE_H, min(1.0, 0.7 + s * 0.3), min(1.0, 0.35 + v * 0.45))
        return (round(nr * 255), round(ng * 255), round(nb * 255), a)
    if 185 <= hd <= 250 and s >= 0.35 and v >= 0.25:
        nv = 0.08 + v * 0.22
        return (round(nv * 255), round(nv * 255), round(nv * 255), a)
    return (r, g, b, a)

MAPPER = map_px

def recolor_frame(fr):
    fr = fr.convert('RGBA')
    fr.putdata([MAPPER(*p) for p in fr.getdata()])
    return fr

def process(src, dst):
    im = Image.open(src)
    n = getattr(im, 'n_frames', 1)
    if n == 1:
        recolor_frame(im).save(dst, 'WEBP', quality=82, method=6)
        return
    frames, durs = [], []
    for i in range(n):
        im.seek(i)
        durs.append(im.info.get('duration', 40))
        frames.append(recolor_frame(im.copy()))
    frames[0].save(dst, 'WEBP', save_all=True, append_images=frames[1:], duration=durs,
                   loop=im.info.get('loop', 0), quality=80, method=6)

src_root, out_root = sys.argv[1], sys.argv[2]
for d, _, files in os.walk(src_root):
    for f in files:
        # profile art comes from output/line-night; the animated clips (anim/) keep their usual
        # colours in the LINE theme (user request, 25 Nov 2026), so neither is made here
        if not f.endswith('.webp') or 'profile' in d or 'anim' in d:
            continue
        s = os.path.join(d, f)
        o = os.path.join(out_root, os.path.relpath(s, src_root))
        os.makedirs(os.path.dirname(o), exist_ok=True)
        MAPPER = map_px_sprite if os.path.dirname(os.path.relpath(s, src_root)) == '' else map_px
        process(s, o)
        print(os.path.relpath(s, src_root), os.path.getsize(s), '->', os.path.getsize(o))
