import argparse
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "vehicles"))

import bmesh
import bpy
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Matrix, Vector

import vehicle_kit as kit

ROLES = ["admin", "dispatcher", "fleet-manager", "driver", "customer"]
VIEWS = {"full": (960, 1440), "bust": (640, 640)}


def parse_args():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", required=True)
    parser.add_argument("--roles", default="all")
    parser.add_argument("--views", default="full,bust")
    parser.add_argument("--samples", type=int, default=64)
    parser.add_argument("--fraction", type=float, default=1.0)
    parser.add_argument("--cpu", action="store_true")
    return parser.parse_args(argv)


def build_materials():
    kit.build_materials()
    kit.MATERIALS.update(
        skin=kit.principled("skin", (0.86, 0.83, 0.78), rough=0.5, coat=0.15),
        hair=kit.principled("hair", (0.27, 0.28, 0.27), rough=0.6),
        shirt=kit.principled("shirt", (0.8, 0.81, 0.79), rough=0.62),
        graphite=kit.principled("graphite", (0.13, 0.14, 0.14), rough=0.58),
        slate=kit.principled("slate", (0.42, 0.44, 0.43), rough=0.6),
        pants=kit.principled("pants", (0.2, 0.215, 0.215), rough=0.66),
        shoe=kit.principled("shoe", (0.05, 0.05, 0.05), rough=0.5, coat=0.3),
        lime=kit.principled("lime", (0.44, 0.88, 0.02), rough=0.42, coat=0.3),
        reflect=kit.principled("reflect", (0.78, 0.8, 0.8), rough=0.25, metal=0.4),
        kraft=kit.principled("kraft", (0.62, 0.52, 0.38), rough=0.7),
        paper=kit.principled("paper", (0.93, 0.93, 0.9), rough=0.8),
        screen=kit.principled("screen", (0.02, 0.03, 0.03), rough=0.1, coat=1.0),
    )


def limb(name, start, end, radius, material, end_radius=None):
    kit.tube(name, start, end, radius, material, sides=32)
    kit.sphere(f"{name}-a", start, radius, material)
    kit.sphere(f"{name}-b", end, end_radius or radius, material)


def half_sphere(name, center, radius, material, scale=(1, 1, 1), cut=0.0):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=48, v_segments=28, radius=radius)
    geom = bm.verts[:] + bm.edges[:] + bm.faces[:]
    bmesh.ops.bisect_plane(bm, geom=geom, plane_co=(0, 0, cut * radius), plane_no=(0, 0, 1), clear_inner=True)
    bmesh.ops.transform(bm, matrix=Matrix.Translation(center) @ Matrix.Diagonal((*scale, 1.0)), verts=bm.verts)
    obj = kit.to_object(name, bm, material, 0.0, 0, angle=80)
    modifier = obj.modifiers.new("solid", "SOLIDIFY")
    modifier.thickness = 0.01
    return obj


def arc_tube(name, center, radius, a0, a1, thickness, material, steps=16):
    points = []
    for i in range(steps + 1):
        a = math.radians(a0 + (a1 - a0) * i / steps)
        points.append(Vector((center[0] + radius * math.cos(a), center[1], center[2] + radius * math.sin(a))))
    for i in range(steps):
        kit.tube(f"{name}{i}", points[i], points[i + 1], thickness, material, sides=16)
        kit.sphere(f"{name}-j{i}", points[i + 1], thickness, material)
    kit.sphere(f"{name}-j-start", points[0], thickness, material)


HEAD = 1.44
SHOULDER = 1.2
HEAD_R = 0.15


def hp(x, y, z):
    k = HEAD_R / 0.125
    return (x * k, y * k, HEAD + (z - 1.625) * k)


def hr(r):
    return r * HEAD_R / 0.125


def bp(x, y, z):
    return (x, y, z - 0.18)


def body(top="shirt", hair="short"):
    for side in (-1, 1):
        kit.sphere(f"shoe{side}", (side * 0.1, -0.04, 0.05), 0.11, "shoe", scale=(0.6, 1.0, 0.46))
        limb(f"leg{side}", (side * 0.1, 0.0, 0.12), (side * 0.105, 0.0, 0.68), 0.085, "pants")
    kit.box("hips", (0, 0, 0.73), (0.41, 0.25, 0.19), "pants", 0.08, segments=4)
    kit.box("torso", (0, 0, 1.0), (0.46, 0.27, 0.52), top, 0.13, segments=5)
    kit.cylinder("neck", (0, 0, 1.29), 0.055, 0.1, "skin", axis="Z")
    kit.sphere("head", (0, 0, HEAD), HEAD_R, "skin", scale=(0.95, 1.0, 1.08))
    if hair == "short":
        kit.sphere("hair", hp(0, 0.022, 1.655), hr(0.128), "hair", scale=(0.99, 1.0, 1.03))
    elif hair == "bun":
        kit.sphere("hair", hp(0, 0.024, 1.655), hr(0.129), "hair", scale=(1.0, 1.0, 1.04))
        kit.sphere("bun", hp(0, 0.105, 1.745), hr(0.058), "hair")
    return top


def arm(side, elbow, hand, sleeve):
    shoulder = (side * 0.225, 0.0, SHOULDER)
    limb(f"upper{side}", shoulder, elbow, 0.066, sleeve)
    limb(f"fore{side}", elbow, hand, 0.058, sleeve)
    kit.sphere(f"hand{side}", hand, 0.058, "skin", scale=(0.9, 1.0, 1.1))


def arm_down(side, sleeve):
    arm(side, (side * 0.275, 0.0, 0.95), (side * 0.285, -0.02, 0.72), sleeve)


def build_admin():
    sleeve = body(top="graphite")
    for side in (-1, 1):
        arm(side, (side * 0.27, -0.03, 0.96), (side * 0.18, -0.31, 0.88), sleeve)
    kit.box("laptop-base", bp(0, -0.34, 1.02), (0.42, 0.28, 0.024), "satin", 0.01)
    kit.box("laptop-lid", bp(0, -0.485, 1.155), (0.42, 0.022, 0.28), "satin", 0.012, rotation=(math.radians(-14), 0, 0))
    kit.box("laptop-screen", bp(0, -0.472, 1.155), (0.39, 0.006, 0.25), "screen", 0.004, rotation=(math.radians(-14), 0, 0))
    kit.cylinder("laptop-mark", bp(0, -0.499, 1.16), 0.032, 0.006, "lime", axis="Y")
    kit.box("badge", bp(0.11, -0.138, 1.29), (0.065, 0.01, 0.085), "lime", 0.01)


def build_dispatcher():
    sleeve = body(top="shirt")
    arm_down(-1, sleeve)
    arm(1, (0.28, 0.02, 0.95), (0.13, -0.27, 1.02), sleeve)
    kit.box("tablet", bp(0.05, -0.3, 1.24), (0.3, 0.024, 0.21), "satin", 0.02, rotation=(math.radians(-55), 0, 0))
    kit.box("tablet-screen", bp(0.05, -0.293, 1.248), (0.27, 0.006, 0.18), "screen", 0.004, rotation=(math.radians(-55), 0, 0))
    arc_tube("headband", hp(0, 0, 1.63), hr(0.142), 0, 180, 0.016, "lime")
    for side in (-1, 1):
        kit.cylinder(f"earcup{side}", hp(side * 0.135, 0, 1.62), hr(0.048), hr(0.045), "lime", axis="X", bevel=0.012)
    kit.tube("mic", hp(-0.15, -0.02, 1.6), hp(-0.075, -0.135, 1.535), 0.009, "graphite", sides=12)
    kit.sphere("mic-tip", hp(-0.072, -0.14, 1.533), 0.021, "graphite")


def build_fleet_manager():
    sleeve = body(top="slate")
    arm_down(1, sleeve)
    arm(-1, (-0.28, 0.02, 0.95), (-0.11, -0.25, 0.99), sleeve)
    rot = (math.radians(-28), 0, math.radians(-12))
    kit.box("clipboard", bp(-0.05, -0.28, 1.22), (0.25, 0.016, 0.33), "kraft", 0.01, rotation=rot)
    kit.box("clipboard-paper", bp(-0.05, -0.29, 1.21), (0.22, 0.006, 0.28), "paper", 0.003, rotation=rot)
    kit.box("clipboard-clip", bp(-0.03, -0.32, 1.365), (0.09, 0.02, 0.04), "satin", 0.008, rotation=rot)
    for i, dz in enumerate((0.05, 0.0, -0.05)):
        kit.box(f"clipboard-line{i}", bp(-0.05, -0.297, 1.22 + dz), (0.15, 0.004, 0.013), "lime" if i == 0 else "slate", 0.002, rotation=rot)
    half_sphere("helmet", hp(0, 0.0, 1.66), hr(0.148), "lime", scale=(1.0, 1.05, 0.9))
    kit.cylinder("helmet-brim", hp(0, -0.03, 1.665), hr(0.165), 0.018, "lime", axis="Z", bevel=0.006)
    kit.box("helmet-ridge", hp(0, 0, 1.79), (hr(0.04), hr(0.24), hr(0.03)), "lime", 0.015)


def build_driver():
    sleeve = body(top="shirt")
    kit.box("vest", (0, 0, 0.99), (0.475, 0.29, 0.46), "lime", 0.13, segments=5)
    for i, z in enumerate((0.88, 1.04)):
        kit.box(f"vest-stripe{i}", (0, 0, z), (0.482, 0.298, 0.038), "reflect", 0.016)
    for side in (-1, 1):
        arm(side, (side * 0.28, -0.03, 0.92), (side * 0.2, -0.28, 0.85), sleeve)
    kit.box("parcel", bp(0, -0.29, 1.06), (0.36, 0.28, 0.26), "kraft", 0.012)
    kit.box("parcel-tape", bp(0, -0.29, 1.191), (0.075, 0.282, 0.004), "lime", 0.001)
    kit.box("parcel-tape-front", bp(0, -0.431, 1.06), (0.075, 0.004, 0.262), "lime", 0.001)
    half_sphere("cap", hp(0, 0.008, 1.668), hr(0.133), "graphite", scale=(1.0, 1.0, 0.82))
    kit.cylinder("cap-visor", hp(0, -0.1, 1.672), hr(0.09), 0.014, "graphite", axis="Z", bevel=0.004)
    kit.sphere("cap-button", hp(0, 0.008, 1.78), 0.017, "lime")


def build_customer():
    sleeve = body(top="shirt", hair="bun")
    kit.box("scarf", (0, -0.01, 1.255), (0.3, 0.22, 0.05), "lime", 0.024)
    for side in (-1, 1):
        arm(side, (side * 0.26, -0.09, 0.96), (side * 0.12, -0.38, 0.95), sleeve)
    kit.box("package", bp(0, -0.41, 1.15), (0.27, 0.21, 0.16), "kraft", 0.01)
    kit.box("package-tape", bp(0, -0.41, 1.231), (0.27, 0.05, 0.004), "lime", 0.001)


BUILDERS = {
    "admin": build_admin,
    "dispatcher": build_dispatcher,
    "fleet-manager": build_fleet_manager,
    "driver": build_driver,
    "customer": build_customer,
}


def fit_camera(view, aspect):
    scene = bpy.context.scene
    data = bpy.data.cameras.new("camera")
    camera = bpy.data.objects.new("camera", data)
    scene.collection.objects.link(camera)
    scene.camera = camera
    if view == "full":
        lo, hi = kit.bounds(kit.vehicle_objects())
        azimuth, elevation, lens, margin = math.radians(28), math.radians(7), 70, 0.05
    else:
        lo, hi = Vector((-0.26, -0.2, 1.16)), Vector((0.26, 0.2, 1.72))
        azimuth, elevation, lens, margin = math.radians(18), math.radians(4), 85, 0.0
    data.lens = lens
    data.clip_end = 100
    center = (lo + hi) / 2
    corners = [Vector((x, y, z)) for x in (lo.x, hi.x) for y in (lo.y, hi.y) for z in (lo.z, hi.z)]
    direction = Vector((math.sin(azimuth) * math.cos(elevation), -math.cos(azimuth) * math.cos(elevation), math.sin(elevation)))
    distance = (hi - lo).length * 3
    for _ in range(6):
        camera.location = center + direction * distance
        camera.rotation_euler = (-direction).to_track_quat("-Z", "Y").to_euler()
        bpy.context.view_layer.update()
        projected = [world_to_camera_view(scene, camera, c) for c in corners]
        spread = max(max(abs(p.x - 0.5), abs(p.y - 0.5)) for p in projected) * 2
        distance *= spread / (1 - margin * 2)
    return camera


def main():
    args = parse_args()
    roles = ROLES if args.roles == "all" else args.roles.split(",")
    views = args.views.split(",")
    os.makedirs(args.out, exist_ok=True)
    for role in roles:
        for view in views:
            kit.reset_scene()
            build_materials()
            BUILDERS[role]()
            width, height = VIEWS[view]
            width, height = int(width * args.fraction), int(height * args.fraction)
            kit.setup_render(args.samples, width, height, cpu=args.cpu)
            plane = kit.setup_studio()
            if view == "bust":
                plane.hide_render = True
            fit_camera(view, width / height)
            suffix = "-bust" if view == "bust" else ""
            kit.render_to(os.path.join(args.out, f"{role}{suffix}.png"))


main()
