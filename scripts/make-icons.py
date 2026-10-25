"""Generate the app icons into public/. Run: python3 scripts/make-icons.py"""
import os
from PIL import Image, ImageDraw

OUT = os.path.join(os.path.dirname(__file__), "..", "public")
BG = (31, 111, 80)        # forest green
FG = (255, 253, 248)      # warm white
SS = 4                    # supersampling for smooth edges


def draw_mark(size, safe):
    """Check mark inside a ring. `safe` is the fraction of the canvas the
    artwork may occupy (maskable icons need a smaller safe zone)."""
    big = size * SS
    img = Image.new("RGB", (big, big), BG)
    d = ImageDraw.Draw(img)
    c = big / 2
    r = big * safe / 2
    ring = big * 0.045
    d.ellipse([c - r, c - r, c + r, c + r], outline=FG, width=int(ring))
    # check mark
    pts = [
        (c - r * 0.42, c + r * 0.02),
        (c - r * 0.1, c + r * 0.34),
        (c + r * 0.46, c - r * 0.30),
    ]
    w = int(big * 0.07)
    d.line(pts, fill=FG, width=w, joint="curve")
    for p in (pts[0], pts[-1]):
        d.ellipse([p[0] - w / 2, p[1] - w / 2, p[0] + w / 2, p[1] + w / 2], fill=FG)
    return img.resize((size, size), Image.LANCZOS)


def save(name, size, safe):
    draw_mark(size, safe).save(os.path.join(OUT, name), optimize=True)


save("icon-192.png", 192, 0.72)
save("icon-512.png", 512, 0.72)
save("icon-512-maskable.png", 512, 0.56)
save("apple-touch-icon.png", 180, 0.72)
print("icons written to", os.path.abspath(OUT))
