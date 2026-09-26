from pathlib import Path
from PIL import Image, ImageDraw

ACCENT = (74, 144, 226, 255)
WHITE = (255, 255, 255, 255)


def draw_icon(size, full_bleed):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if full_bleed:
        d.rectangle([0, 0, size, size], fill=ACCENT)
        scale = 0.5
    else:
        d.rounded_rectangle([0, 0, size - 1, size - 1], radius=int(size * 0.22), fill=ACCENT)
        scale = 0.6
    w = size * scale
    x0 = (size - w) / 2
    y0 = (size - w * 0.9) / 2 + size * 0.02
    x1 = x0 + w
    y1 = y0 + w * 0.9
    stroke = max(2, int(size * 0.035))
    d.rounded_rectangle([x0, y0, x1, y1], radius=int(w * 0.12), outline=WHITE, width=stroke)
    d.rounded_rectangle([x0, y0, x1, y0 + w * 0.26], radius=int(w * 0.12), fill=WHITE)
    d.rectangle([x0, y0 + w * 0.13, x1, y0 + w * 0.26], fill=WHITE)
    for cx in (x0 + w * 0.28, x1 - w * 0.28):
        d.rounded_rectangle([cx - stroke * 0.6, y0 - w * 0.08, cx + stroke * 0.6, y0 + w * 0.1], radius=stroke, fill=WHITE)
    r = w * 0.055
    for row in range(2):
        for col in range(3):
            cx = x0 + w * (0.25 + 0.25 * col)
            cy = y0 + w * (0.45 + 0.2 * row)
            d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=WHITE)
    return img


out = Path(".")

draw_icon(192, False).save(out / "icon-192.png")
draw_icon(512, False).save(out / "icon-512.png")
draw_icon(512, True).save(out / "icon-maskable-512.png")
draw_icon(180, True).convert("RGB").save(out / "apple-touch-icon.png")
print("icons written")
