"""Generate Journey.icns: stacked sticky notes on paper. Deterministic, stdlib+PIL only."""
import os
import struct
import sys
from PIL import Image, ImageDraw

# Minimal ICNS writer: 'icns' magic + PNG payload entries.
# ic07=128, ic08=256, ic09=512, ic10=1024. Readable since macOS 10.8.
ICNS_TYPES = (("ic07", 128), ("ic08", 256), ("ic09", 512), ("ic10", 1024))


def write_icns(master: Image.Image, path: str) -> None:
    entries = b""
    for ostype, size in ICNS_TYPES:
        img = master.resize((size, size), Image.LANCZOS)
        tmp = f"{path}.{size}.png"
        img.save(tmp)
        with open(tmp, "rb") as f:
            payload = f.read()
        os.remove(tmp)
        entries += ostype.encode("ascii") + struct.pack(">I", 8 + len(payload)) + payload
    with open(path, "wb") as f:
        f.write(b"icns" + struct.pack(">I", 8 + len(entries)) + entries)

HERE = os.path.dirname(os.path.abspath(__file__))
SIZE = 1024


def sticky(color, angle, w=560, h=520):
    pad = 200
    img = Image.new("RGBA", (w + pad * 2, h + pad * 2), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    x0, y0 = pad, pad
    # shadow
    d.rounded_rectangle([x0 + 14, y0 + 26, x0 + w + 14, y0 + h + 26], radius=44,
                        fill=(35, 39, 47, 70))
    # paper
    d.rounded_rectangle([x0, y0, x0 + w, y0 + h], radius=44, fill=color + (255,))
    d.rounded_rectangle([x0, y0, x0 + w, y0 + h], radius=44,
                        outline=(35, 39, 47, 60), width=6)
    # sheen
    d.rounded_rectangle([x0 + 24, y0 + 24, x0 + w - 24, y0 + 150], radius=28,
                        fill=(255, 255, 255, 90))
    # checklist lines
    for i, y in enumerate(range(y0 + 220, y0 + h - 40, 88)):
        if i == 0:  # checked box
            d.rounded_rectangle([x0 + 70, y, x0 + 130, y + 60], radius=14,
                                fill=(35, 39, 47, 255))
            d.line([x0 + 82, y + 32, x0 + 98, y + 48, x0 + 122, y + 14],
                   fill=(255, 255, 255, 255), width=12, joint="curve")
        else:
            d.rounded_rectangle([x0 + 70, y, x0 + 130, y + 60], radius=14,
                                outline=(35, 39, 47, 200), width=8)
        d.rounded_rectangle([x0 + 160, y + 12, x0 + w - 70, y + 48], radius=18,
                            fill=(35, 39, 47, 45))
    # tape
    tape = Image.new("RGBA", (300, 84), (255, 255, 255, 160))
    td = ImageDraw.Draw(tape)
    td.line([0, 0, 0, 84], fill=(35, 39, 47, 40), width=4)
    td.line([299, 0, 299, 84], fill=(35, 39, 47, 40), width=4)
    tape = tape.rotate(-4, expand=True, resample=Image.BICUBIC)
    img.alpha_composite(tape, (x0 + w // 2 - tape.width // 2, y0 - 52))
    return img.rotate(angle, expand=True, resample=Image.BICUBIC)


def main():
    base = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    d = ImageDraw.Draw(base)
    d.rounded_rectangle([8, 8, SIZE - 8, SIZE - 8], radius=230,
                        fill=(246, 242, 233, 255))
    # faint grid
    for x in range(64, SIZE, 64):
        d.line([x, 24, x, SIZE - 24], fill=(35, 39, 47, 14), width=2)
    for y in range(64, SIZE, 64):
        d.line([24, y, SIZE - 24, y], fill=(35, 39, 47, 14), width=2)
    d.rounded_rectangle([8, 8, SIZE - 8, SIZE - 8], radius=230,
                        outline=(35, 39, 47, 70), width=8)

    layers = [
        (sticky((207, 228, 255), -9), (-150, -40)),    # blue Learn
        (sticky((255, 217, 225), 7), (150, -60)),      # pink Build
        (sticky((255, 243, 163), -2), (0, 130)),       # yellow Deliver
    ]
    for img, (dx, dy) in layers:
        base.alpha_composite(img, (SIZE // 2 - img.width // 2 + dx,
                                   SIZE // 2 - img.height // 2 + dy))

    write_icns(base, os.path.join(HERE, "Journey.icns"))
    print("Journey.icns OK")


if __name__ == "__main__":
    sys.exit(main())
