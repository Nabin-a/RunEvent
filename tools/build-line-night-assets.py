"""Build the LINE theme's images from output/line-night (25 Nov 2026, user request).

Run from the repository root:  python tools/build-line-night-assets.py

- Profile menu rabbits: the supplied transparent PNGs in output/line-night/profile-mascots, trimmed
  and fitted into the same canvas size as the usual art so the page layout does not move
  -> src/assets/mascot-line/profile.
- Scenes: the supplied night landscape and the three night event covers, resized to the usual
  sizes -> src/assets/illustrations/*-night.webp.
- The animated rabbits and step-tracker sprites are not taken from here (user: "animation mascot
  ไม่ต้องเอามา ... เอาของเราเองที่เคยทำก่อนหน้า"): they come from tools/recolor-mascot-line.py.
"""
import os
from PIL import Image

ROOT = os.getcwd()
SRC = os.path.join(ROOT, 'output', 'line-night')
MASCOT = os.path.join(ROOT, 'src', 'assets', 'mascot')
MASCOT_LINE = os.path.join(ROOT, 'src', 'assets', 'mascot-line')
ILLUS = os.path.join(ROOT, 'src', 'assets', 'illustrations')

PROFILE = {
    'personal': '01-personal.png',
    'emergency': '02-emergency.png',
    'addresses': '03-address.png',
    'participants': '04-participants.png',
    'history': '05-certificates.png',
    'connections': '06-connections.png',
    'devices': '07-devices.png',
    'privacy': '08-privacy.png',
}

SCENES = {
    'hero-running-track-night.webp': ('hero-running-track.png', (1600, 533)),
    'cover-bangkok-night.webp': ('cover-bangkok.png', (1200, 600)),
    'cover-chiang-mai-night.webp': ('cover-chiang-mai.png', (1200, 600)),
    'cover-coast-night.webp': ('cover-coast.png', (1200, 600)),
}


def fit_profile(src, like, dst):
    usual = Image.open(like)
    W, H = usual.size
    art = Image.open(src).convert('RGBA')
    # ignore faint stray pixels from the image edit when finding the rabbit's edges
    art = art.crop(art.getchannel('A').point(lambda a: 255 if a > 48 else 0).getbbox())
    scale = min(W / art.width, H / art.height)
    art = art.resize((max(1, round(art.width * scale)), max(1, round(art.height * scale))), Image.LANCZOS)
    canvas = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    canvas.alpha_composite(art, ((W - art.width) // 2, H - art.height))
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    canvas.save(dst, 'WEBP', quality=86, method=6)


def main():
    for key, file in PROFILE.items():
        fit_profile(os.path.join(SRC, 'profile-mascots', file),
                    os.path.join(MASCOT, 'profile', key + '.webp'),
                    os.path.join(MASCOT_LINE, 'profile', key + '.webp'))
        print('prof', key, '<-', file)
    for out, (file, size) in SCENES.items():
        im = Image.open(os.path.join(SRC, 'illustrations', file)).convert('RGB')
        im.resize(size, Image.LANCZOS).save(os.path.join(ILLUS, out), 'WEBP', quality=84, method=6)
        print('scene', out, '<-', file)


if __name__ == '__main__':
    main()
