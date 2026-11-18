import argparse
import os
import sys

from PIL import Image, ImageChops, ImageDraw, ImageFilter

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "vehicles"))

from finish_renders import crop_box


def contact_shadow(image, spread=0.62, depth=0.035):
    alpha = image.getchannel("A")
    solid = alpha.point(lambda a: 255 if a >= 200 else 0)
    left, top, right, bottom = solid.getbbox()
    body = solid.filter(ImageFilter.MaxFilter(5))
    rx = (right - left) * spread / 2
    ry = image.height * depth
    cx = (left + right) / 2
    feet = Image.new("L", image.size, 0)
    ImageDraw.Draw(feet).ellipse((cx - rx, bottom - ry, cx + rx, bottom + ry * 0.6), fill=255)
    feet = feet.filter(ImageFilter.GaussianBlur(ry * 0.8))
    image.putalpha(ImageChops.multiply(alpha, ImageChops.lighter(body, feet)))
    return image


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--src", required=True)
    parser.add_argument("--out", required=True)
    parser.add_argument("--full-height", type=int, default=600)
    parser.add_argument("--bust-size", type=int, default=256)
    args = parser.parse_args()
    os.makedirs(args.out, exist_ok=True)
    for name in sorted(os.listdir(args.src)):
        if not name.endswith(".png"):
            continue
        image = Image.open(os.path.join(args.src, name)).convert("RGBA")
        stem = name[:-4]
        if stem.endswith("-bust"):
            result = image.resize((args.bust_size, args.bust_size), Image.LANCZOS)
        else:
            image = contact_shadow(image)
            cropped = image.crop(crop_box(image.getchannel("A"), 6, 6))
            width = round(cropped.width * args.full_height / cropped.height)
            result = cropped.resize((width, args.full_height), Image.LANCZOS)
        result.save(os.path.join(args.out, f"{stem}.webp"), "WEBP", quality=86, method=6, alpha_quality=90)
        print(stem, result.size)


if __name__ == "__main__":
    main()
