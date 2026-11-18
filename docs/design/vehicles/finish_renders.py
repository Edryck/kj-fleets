import argparse
import json
import os

from PIL import Image, ImageChops, ImageDraw, ImageFilter


def crop_box(alpha, threshold, pad):
    mask = alpha.point(lambda a: 255 if a > threshold else 0)
    left, top, right, bottom = mask.getbbox()
    width, height = alpha.size
    return (max(0, left - pad), max(0, top - pad), min(width, right + pad), min(height, bottom + pad))


def fade_shadow(render, reach=0.08):
    alpha = render.getchannel("A")
    body = alpha.point(lambda a: 255 if a >= 250 else 0).getbbox()
    span = max(body[2] - body[0], body[3] - body[1])
    radius = span * reach
    mask = Image.new("L", render.size, 0)
    ImageDraw.Draw(mask).rectangle(body, fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(radius / 2)).point(lambda v: min(255, v * 2))
    render.putalpha(ImageChops.multiply(alpha, mask))
    return render


def finish(source, target, key, view, scale, quality):
    render = fade_shadow(Image.open(os.path.join(source, f"{key}-{view}.png")).convert("RGBA"))
    box = crop_box(render.getchannel("A"), 8, 4)
    size = (round((box[2] - box[0]) * scale), round((box[3] - box[1]) * scale))
    shot = render.crop(box).resize(size, Image.LANCZOS)
    shot.save(os.path.join(target, f"{key}-{view}.webp"), "WEBP", quality=quality, method=6, alpha_quality=90)
    paint_path = os.path.join(source, f"{key}-{view}-paint.png")
    if os.path.exists(paint_path):
        paint = Image.open(paint_path).convert("RGBA")
        alpha = paint.getchannel("A")
        white = Image.new("RGBA", paint.size, (255, 255, 255, 0))
        white.putalpha(alpha)
        mask = white.crop(box).resize(size, Image.LANCZOS)
        mask.save(os.path.join(target, f"{key}-{view}-paint.webp"), "WEBP", quality=80, method=6, alpha_quality=80)
    return size


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--src", required=True)
    parser.add_argument("--out", required=True)
    parser.add_argument("--scale", type=float, default=0.5)
    parser.add_argument("--quality", type=int, default=86)
    args = parser.parse_args()
    os.makedirs(args.out, exist_ok=True)
    sizes = {}
    for name in sorted(os.listdir(args.src)):
        if not name.endswith(".png") or name.endswith("-paint.png"):
            continue
        key, view = name[:-4].rsplit("-", 1)
        sizes.setdefault(key, {})[view] = finish(args.src, args.out, key, view, args.scale, args.quality)
    print(json.dumps(sizes))


if __name__ == "__main__":
    main()
