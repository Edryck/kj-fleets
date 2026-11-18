import argparse
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import vehicle_kit as kit
from mathutils import Vector
from models import MODELS
from motorcycles import build_motorcycle

VIEWS = {"34": (1920, 1200), "side": (1800, 900)}


def parse_args():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", required=True)
    parser.add_argument("--models", default="all")
    parser.add_argument("--views", default="34,side")
    parser.add_argument("--samples", type=int, default=160)
    parser.add_argument("--preview", action="store_true")
    parser.add_argument("--no-mask", action="store_true")
    parser.add_argument("--cpu", action="store_true")
    parser.add_argument("--fraction", type=float, default=1.0)
    parser.add_argument("--gain", type=float, default=1.0)
    return parser.parse_args(argv)


def run_parts(spec, parts):
    half = spec.get("width", 0) / 2
    for part in parts:
        kind = part[0]
        if kind == "box":
            _, name, center, size, material, bevel = part[:6]
            rotation = part[6] if len(part) > 6 else (0, 0, 0)
            kit.box(name, center, size, material, bevel, rotation=rotation)
        elif kind == "pair":
            _, name, center, size, material, bevel = part[:6]
            rot = part[6] if len(part) > 6 else (0, 0, 0)
            x, y, z = center
            kit.box(f"{name}-l", (x, y, z), size, material, bevel, rotation=rot)
            kit.box(f"{name}-r", (x, -y, z), size, material, bevel, rotation=(-rot[0], rot[1], -rot[2]))
        elif kind == "side":
            _, name, polygon, material = part[:4]
            proud = part[4] if len(part) > 4 else 0.006
            inner = part[5] if len(part) > 5 else half
            bevel = part[6] if len(part) > 6 else 0.008
            for sign in (1, -1):
                y0 = sign * (inner - 0.02)
                y1 = sign * (inner + proud)
                kit.prism(f"{name}{sign}", polygon, min(y0, y1), max(y0, y1), material, bevel=bevel, segments=2)
        elif kind == "through":
            _, name, polygon, y_half, material = part[:5]
            bevel = part[5] if len(part) > 5 else 0.01
            kit.prism(name, polygon, -y_half, y_half, material, bevel=bevel, segments=3)
        elif kind == "slab":
            _, name, top, bottom, y_half, material = part[:6]
            inset = part[6] if len(part) > 6 else 0.05
            thick = part[7] if len(part) > 7 else 0.014
            kit.slab(name, top, bottom, y_half, material, inset=inset, thick=thick)
        elif kind == "cyl":
            _, name, center, radius, depth, material, axis = part[:7]
            bevel = part[7] if len(part) > 7 else 0.0
            kit.cylinder(name, center, radius, depth, material, axis=axis, bevel=bevel)
        elif kind == "pair_cyl":
            _, name, center, radius, depth, material, axis = part[:7]
            bevel = part[7] if len(part) > 7 else 0.0
            x, y, z = center
            kit.cylinder(f"{name}-l", (x, y, z), radius, depth, material, axis=axis, bevel=bevel)
            kit.cylinder(f"{name}-r", (x, -y, z), radius, depth, material, axis=axis, bevel=bevel)
        elif kind == "mirror":
            _, x, z, reach, height = part[:5]
            for sign in (1, -1):
                y0 = sign * (half - 0.02)
                y1 = sign * (half + reach)
                kit.tube(f"mirror-arm{sign}", (x + 0.06, y0, z + height * 0.35), (x, y1, z + height * 0.3), 0.022, "trim")
                kit.tube(f"mirror-arm-low{sign}", (x + 0.06, y0, z - height * 0.3), (x, y1, z - height * 0.3), 0.018, "trim")
                kit.box(f"mirror{sign}", (x - 0.02, y1 + sign * 0.03, z), (0.09, 0.12, height), "trim", 0.03)
        elif kind == "lamp":
            _, name, a, b, y, width = part[:6]
            t0, t1 = part[6] if len(part) > 6 else (0.04, 0.96)
            a, b = Vector(a), Vector(b)
            span = (b - a).length
            d = (b - a).normalized()
            n = Vector((d.y, -d.x))
            if n.x + n.y < 0:
                n = -n
            mid = a + d * span * (t0 + t1) / 2
            length = span * (t1 - t0)
            theta = math.atan2(-d.y, d.x)
            for sign in (1, -1):
                hc = mid + n * 0.012
                lc = mid + n * 0.03
                kit.box(f"{name}-housing{sign}", (hc.x, sign * y, hc.y), (length, width, 0.05), "glass", 0.015, rotation=(0, theta, 0))
                kit.box(f"{name}-lens{sign}", (lc.x, sign * y, lc.y), (length * 0.84, width * 0.8, 0.03), "lamp", 0.01, rotation=(0, theta, 0))
        elif kind == "seam":
            _, name, x, z0, z1 = part[:5]
            width = part[5] if len(part) > 5 else 0.012
            for sign in (1, -1):
                y = sign * (half + 0.002)
                kit.prism(f"{name}{sign}", [(x - width / 2, z0), (x + width / 2, z0), (x + width / 2, z1), (x - width / 2, z1)], y - 0.02, y + 0.004, "trim")


def body_outline(x_rear, x_front, profile, arches, zb, rear_radius=0.06, front_radius=0.05):
    points = [(x_rear, zb)]
    radii = [rear_radius]
    for x, cz, radius in sorted(arches):
        arc = kit.arch_points(x, cz, radius, zb)
        points += arc
        radii += [0] * len(arc)
    points.append((x_front, zb))
    radii.append(front_radius)
    for x, z, r in profile:
        points.append((x, z))
        radii.append(r)
    return kit.soften(points, radii)


def build_van(spec):
    half = spec["width"] / 2
    r = spec["wheel_r"]
    gap = spec.get("arch_gap", 0.075)
    arches = [(x, r, r + gap) for x in spec["axles"]]
    outline = body_outline(0.0, spec["front_x"], spec["profile"], arches, spec["sill"])
    kit.prism("body", outline, -half, half, "paint", bevel=spec.get("bevel", 0.09), segments=6)
    for i, (x, cz, radius) in enumerate(arches):
        kit.cylinder(f"well{i}", (x, 0, cz), radius - 0.015, spec["width"] - 0.08, "chassis", sides=48)
    tire_w = spec.get("tire_w", 0.23)
    track = half - tire_w / 2 - spec.get("tire_inset", 0.03)
    for i, x in enumerate(spec["axles"]):
        kit.axle_pair(f"axle{i}", x, r, track, r, tire_w, style="van")
    run_parts(spec, spec["parts"])


def build_cabover(spec):
    cab = spec["cab"]
    half_cab = cab["width"] / 2
    r_front = spec["wheel_r"]
    front_x = spec["axles"][-1]
    arches = [(front_x, r_front, r_front + spec.get("arch_gap", 0.08))]
    outline = body_outline(cab["rear_x"], cab["front_x"], cab["profile"], arches, cab["bottom"], 0.04, 0.04)
    kit.prism("cab", outline, -half_cab, half_cab, "paint", bevel=cab.get("bevel", 0.09), segments=6)
    kit.cylinder("well-front", (front_x, 0, r_front), r_front + spec.get("arch_gap", 0.08) - 0.015, cab["width"] - 0.1, "chassis", sides=48)
    chassis = spec["chassis"]
    for sign in (1, -1):
        kit.box(f"rail{sign}", ((chassis["x0"] + chassis["x1"]) / 2, sign * chassis["gauge"] / 2, chassis["z"]), (chassis["x1"] - chassis["x0"], 0.1, chassis["h"]), "chassis", 0.01)
    cargo = spec.get("cargo")
    if cargo:
        x0, x1 = cargo["x0"], cargo["x1"]
        z0, z1 = cargo["z0"], cargo["z1"]
        w = cargo["width"]
        kit.box("cargo", ((x0 + x1) / 2, 0, (z0 + z1) / 2), (x1 - x0, w, z1 - z0), "box", cargo.get("bevel", 0.05), segments=4)
        kit.box("cargo-floor", ((x0 + x1) / 2, 0, z0 - 0.06), (x1 - x0 + 0.02, w - 0.04, 0.12), "chassis", 0.01)
        for i, z in enumerate(cargo.get("ribs", [])):
            for sign in (1, -1):
                kit.box(f"rib{i}{sign}", ((x0 + x1) / 2, sign * (w / 2 + 0.006), z), (x1 - x0 - 0.12, 0.014, 0.03), "box", 0.006)
        stripe = cargo.get("stripe")
        if stripe:
            for sign in (1, -1):
                kit.box(f"cargo-stripe{sign}", ((x0 + x1) / 2 + 0.02, sign * (w / 2 + 0.008), stripe), (x1 - x0 - 0.24, 0.012, 0.06), "stripe", 0.004)
        for sign in (1, -1):
            kit.box(f"cargo-rear-post{sign}", (x0 - 0.005, sign * (w / 2 - 0.05), (z0 + z1) / 2), (0.03, 0.06, z1 - z0 - 0.04), "satin", 0.01)
        kit.box("cargo-rear-split", (x0 - 0.006, 0, (z0 + z1) / 2), (0.02, 0.025, z1 - z0 - 0.1), "satin", 0.005)
    tire_w = spec.get("tire_w", 0.3)
    front_track = half_cab - tire_w / 2 - 0.05
    kit.axle_pair("front", front_x, r_front, front_track, r_front, tire_w, style="truck")
    rear_track = spec.get("rear_track", front_track - tire_w * 0.5)
    for i, x in enumerate(spec["axles"][:-1]):
        dual = spec.get("dual", [True] * 9)[i]
        kit.axle_pair(f"rear{i}", x, r_front, rear_track, r_front, tire_w, style="truck", dual=dual)
        kit.box(f"axle-beam{i}", (x, 0, r_front), (0.16, rear_track * 2 - tire_w, 0.14), "chassis", 0.02)
    kit.box("front-beam", (front_x, 0, r_front), (0.14, front_track * 2 - tire_w, 0.12), "chassis", 0.02)
    run_parts({"width": cab["width"]}, spec["parts"])


def build(spec):
    family = spec["family"]
    if family == "van":
        build_van(spec)
    elif family == "cabover":
        build_cabover(spec)
    elif family == "motorcycle":
        build_motorcycle(spec)


def main():
    args = parse_args()
    keys = list(MODELS) if args.models == "all" else args.models.split(",")
    views = args.views.split(",")
    os.makedirs(args.out, exist_ok=True)
    for key in keys:
        spec = MODELS[key]
        for view in views:
            kit.reset_scene()
            kit.build_materials()
            build(spec)
            width, height = VIEWS[view]
            kit.LIGHT["gain"] = args.gain
            width, height = int(width * args.fraction), int(height * args.fraction)
            kit.setup_render(24 if args.preview else args.samples, width, height, cpu=args.cpu)
            kit.setup_studio()
            kit.frame_camera(view, width / height)
            kit.render_to(os.path.join(args.out, f"{key}-{view}.png"))
            if not args.no_mask:
                kit.render_mask(os.path.join(args.out, f"{key}-{view}-paint.png"))


main()
