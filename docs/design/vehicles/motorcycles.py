import math

import bpy

import vehicle_kit as kit


def torus(name, center, major, minor, material):
    bpy.ops.mesh.primitive_torus_add(
        major_radius=major,
        minor_radius=minor,
        major_segments=72,
        minor_segments=14,
        location=center,
        rotation=(math.radians(90), 0, 0),
    )
    obj = bpy.context.active_object
    obj.name = name
    obj.data.materials.append(kit.MATERIALS[material])
    obj.data.shade_smooth()
    obj["material_key"] = material
    return obj


def arc_band(name, cx, cz, r_in, r_out, a0, a1, y_half, material, steps=28, bevel=0.012):
    outer = []
    inner = []
    for i in range(steps + 1):
        a = math.radians(a0 + (a1 - a0) * i / steps)
        outer.append((cx + r_out * math.cos(a), cz + r_out * math.sin(a)))
        inner.append((cx + r_in * math.cos(a), cz + r_in * math.sin(a)))
    return kit.prism(name, outer + inner[::-1], -y_half, y_half, material, bevel=bevel, segments=2)


def moto_wheel(name, x, radius, tire_w, rim_r, spokes=5, disc_side=0):
    z = radius
    section = radius - rim_r
    tire = torus(f"{name}-tire", (x, 0, z), radius - section / 2, section / 2, "rubber")
    tire.scale = (1, 1, tire_w / section)
    rim = torus(f"{name}-rim", (x, 0, z), rim_r, 0.016, "rim")
    rim.scale = (1, 1, 1.7)
    kit.cylinder(f"{name}-hub", (x, 0, z), 0.05, tire_w * 1.15, "hub", bevel=0.01, sides=32)
    length = rim_r - 0.045
    for k in range(spokes):
        a = 2 * math.pi * k / spokes + 0.3
        cx = x + math.cos(a) * (0.045 + length / 2)
        cz = z + math.sin(a) * (0.045 + length / 2)
        kit.box(f"{name}-spoke{k}", (cx, 0, cz), (length, 0.022, 0.026), "rim", 0.006, rotation=(0, -a, 0))
    if disc_side:
        kit.cylinder(f"{name}-disc", (x, disc_side * (tire_w / 2 + 0.02), z), radius * 0.4, 0.006, "chrome", sides=48)
        kit.box(f"{name}-caliper", (x - radius * 0.28, disc_side * (tire_w / 2 + 0.03), z + radius * 0.22), (0.07, 0.035, 0.09), "satin", 0.01)


def mirrors(x, z, half):
    for sign in (1, -1):
        kit.tube(f"mirror-stalk{sign}", (x + 0.02, sign * (half - 0.04), z), (x - 0.03, sign * (half + 0.01), z + 0.15), 0.007, "satin", sides=10)
        kit.sphere(f"mirror{sign}", (x - 0.04, sign * (half + 0.02), z + 0.18), 0.045, "trim", scale=(0.4, 1.0, 0.65))


def handlebar(x, z, half):
    kit.tube("bar", (x, -half, z), (x, half, z), 0.012, "satin", sides=14)
    for sign in (1, -1):
        kit.tube(f"grip{sign}", (x, sign * (half - 0.11), z), (x - 0.01, sign * (half + 0.01), z), 0.019, "seat", sides=16)
        kit.box(f"lever{sign}", (x + 0.05, sign * (half - 0.07), z - 0.005), (0.07, 0.11, 0.012), "satin", 0.004, rotation=(0, 0, sign * 0.25))


def cargo_box(x, z_floor, size, stripe=True):
    sx, sy, sz = size
    kit.box("rack", (x, 0, z_floor - 0.015), (sx + 0.06, sy * 0.85, 0.024), "satin", 0.006)
    for sign in (1, -1):
        kit.tube(f"rack-leg{sign}", (x - sx * 0.3, sign * sy * 0.36, z_floor - 0.02), (x + sx * 0.35, sign * 0.1, z_floor - 0.24), 0.012, "satin", sides=12)
    kit.box("cargo-box", (x, 0, z_floor + sz / 2), (sx, sy, sz), "box", 0.04, segments=4)
    kit.box("cargo-lid-seam", (x, 0, z_floor + sz * 0.78), (sx + 0.006, sy + 0.006, 0.012), "satin", 0.004)
    if stripe:
        kit.box("cargo-stripe", (x, 0, z_floor + sz * 0.24), (sx + 0.008, sy + 0.008, 0.032), "stripe", 0.006)
    kit.box("cargo-latch", (x - sx / 2 - 0.006, 0, z_floor + sz * 0.7), (0.02, 0.07, 0.05), "satin", 0.005)


def build_cg(spec):
    rear_x, front_x = 0.32, 1.64
    r = 0.315
    moto_wheel("rear", rear_x, r, 0.095, 0.232, spokes=5)
    moto_wheel("front", front_x, r, 0.085, 0.232, spokes=5, disc_side=1)
    for sign in (1, -1):
        kit.tube(f"fork-lower{sign}", (front_x, sign * 0.075, r), (1.565, sign * 0.075, 0.6), 0.031, "satin", sides=18)
        kit.tube(f"fork-upper{sign}", (1.565, sign * 0.075, 0.6), (1.43, sign * 0.075, 1.0), 0.022, "chrome", sides=18)
    kit.box("triple-clamp", (1.435, 0, 0.99), (0.08, 0.2, 0.03), "satin", 0.01, rotation=(0, -0.38, 0))
    arc_band("front-fender", front_x, r, r + 0.025, r + 0.045, 35, 125, 0.06, "paint")
    kit.sphere("headlight-shell", (1.53, 0, 1.0), 0.1, "trim", scale=(1.0, 1.2, 1.0))
    kit.cylinder("headlight", (1.6, 0, 1.0), 0.072, 0.035, "lamp", axis="X", bevel=0.006)
    for sign in (1, -1):
        kit.box(f"indicator{sign}", (1.5, sign * 0.17, 0.98), (0.06, 0.05, 0.035), "amber", 0.01)
    kit.box("dash", (1.42, 0, 1.11), (0.1, 0.16, 0.05), "trim", 0.015, rotation=(0, -0.5, 0))
    handlebar(1.37, 1.13, 0.37)
    mirrors(1.36, 1.14, 0.3)
    kit.tube("backbone", (1.42, 0, 0.98), (0.95, 0, 0.83), 0.03, "satin", sides=16)
    kit.tube("backbone-rear", (0.95, 0, 0.83), (0.35, 0, 0.88), 0.026, "satin", sides=16)
    kit.tube("downtube", (1.38, 0, 0.92), (1.12, 0, 0.42), 0.03, "satin", sides=16)
    tank = kit.soften([(0.92, 0.83), (1.33, 0.92), (1.38, 0.99), (1.25, 1.05), (0.99, 1.02), (0.86, 0.94)], [0.04, 0.06, 0.06, 0.1, 0.1, 0.06])
    kit.prism("tank", tank, -0.15, 0.15, "paint", bevel=0.085, segments=6)
    for sign in (1, -1):
        lo, hi = sorted((sign * 0.138, sign * 0.157))
        kit.prism(f"tank-stripe{sign}", [(1.02, 0.93), (1.3, 0.96), (1.29, 0.985), (1.02, 0.955)], lo, hi, "stripe", bevel=0.004, segments=1)
    seat = kit.soften([(0.48, 0.86), (0.94, 0.86), (1.0, 0.93), (0.95, 0.98), (0.62, 0.96), (0.4, 0.94), (0.38, 0.89)], [0.02, 0.03, 0.05, 0.05, 0.06, 0.04, 0.03])
    kit.prism("seat", seat, -0.13, 0.13, "seat", bevel=0.05, segments=5)
    cover = kit.soften([(0.6, 0.66), (0.88, 0.7), (0.92, 0.86), (0.52, 0.86)], [0.02, 0.03, 0.02, 0.03])
    kit.prism("side-cover", cover, -0.12, 0.12, "paint", bevel=0.03, segments=3)
    for sign in (1, -1):
        lo, hi = sorted((sign * 0.11, sign * 0.127))
        kit.prism(f"cover-stripe{sign}", [(0.6, 0.76), (0.86, 0.79), (0.86, 0.81), (0.6, 0.78)], lo, hi, "stripe", bevel=0.003, segments=1)
    kit.box("engine", (0.95, 0, 0.48), (0.32, 0.22, 0.26), "engine", 0.035)
    kit.box("cylinder", (1.11, 0, 0.62), (0.15, 0.14, 0.2), "engine", 0.02, rotation=(0, -0.45, 0))
    for k in range(4):
        kit.box(f"fin{k}", (1.08 + 0.025 * k, 0, 0.6 + 0.045 * k), (0.2, 0.16, 0.008), "engine", 0.002, rotation=(0, -0.45, 0))
    kit.cylinder("crank-cover", (0.9, -0.12, 0.43), 0.105, 0.04, "engine", axis="Y", bevel=0.012)
    kit.tube("header", (1.14, -0.05, 0.52), (1.07, -0.13, 0.33), 0.022, "chrome", sides=14)
    kit.tube("header-run", (1.07, -0.13, 0.33), (0.66, -0.17, 0.36), 0.022, "chrome", sides=14)
    kit.tube("muffler", (0.68, -0.18, 0.37), (0.16, -0.18, 0.5), 0.052, "chrome", sides=24)
    kit.tube("heat-shield", (0.62, -0.225, 0.4), (0.3, -0.225, 0.47), 0.026, "satin", sides=16)
    for sign in (1, -1):
        kit.tube(f"swingarm{sign}", (0.84, sign * 0.1, 0.42), (rear_x, sign * 0.085, r), 0.024, "satin", sides=14)
        kit.tube(f"shock{sign}", (0.4, sign * 0.115, 0.36), (0.55, sign * 0.115, 0.85), 0.018, "satin", sides=14)
        kit.tube(f"spring{sign}", (0.43, sign * 0.115, 0.45), (0.52, sign * 0.115, 0.76), 0.03, "stripe", sides=14)
        kit.tube(f"peg{sign}", (0.82, sign * 0.12, 0.33), (0.8, sign * 0.22, 0.33), 0.016, "seat", sides=12)
    kit.box("chain-guard", (0.58, 0.1, 0.38), (0.52, 0.02, 0.07), "satin", 0.008, rotation=(0, 0.1, 0))
    arc_band("rear-fender", rear_x, r, r + 0.025, r + 0.045, 60, 175, 0.07, "satin")
    kit.box("taillight", (0.06, 0, 0.84), (0.04, 0.12, 0.05), "tail", 0.012)
    cargo_box(0.3, 0.96, (0.46, 0.44, 0.44))


def build_biz(spec):
    rear_x, front_x = 0.3, 1.55
    rr, fr = 0.262, 0.29
    moto_wheel("rear", rear_x, rr, 0.09, 0.17, spokes=5)
    moto_wheel("front", front_x, fr, 0.075, 0.2, spokes=5, disc_side=1)
    for sign in (1, -1):
        kit.tube(f"fork{sign}", (front_x, sign * 0.07, fr), (1.38, sign * 0.07, 0.98), 0.026, "satin", sides=18)
    arc_band("front-fender", front_x, fr, fr + 0.025, fr + 0.045, 30, 135, 0.055, "paint")
    shield = kit.soften(
        [(1.42, 1.0), (1.47, 0.86), (1.36, 0.6), (1.2, 0.4), (1.06, 0.36), (1.1, 0.5), (1.24, 0.7), (1.31, 0.96)],
        [0.04, 0.12, 0.12, 0.08, 0.03, 0.06, 0.1, 0.04],
    )
    kit.prism("leg-shield", shield, -0.21, 0.21, "paint", bevel=0.07, segments=6)
    floor = kit.soften([(0.6, 0.35), (1.12, 0.32), (1.15, 0.42), (0.66, 0.48)], [0.02, 0.03, 0.03, 0.03])
    kit.prism("floor", floor, -0.13, 0.13, "trim", bevel=0.03, segments=3)
    rear_body = kit.soften(
        [(0.07, 0.72), (0.2, 0.84), (0.96, 0.86), (1.0, 0.77), (0.84, 0.5), (0.52, 0.42), (0.16, 0.56)],
        [0.06, 0.06, 0.05, 0.06, 0.12, 0.1, 0.08],
    )
    kit.prism("rear-body", rear_body, -0.165, 0.165, "paint", bevel=0.085, segments=6)
    for sign in (1, -1):
        lo, hi = sorted((sign * 0.15, sign * 0.172))
        kit.prism(f"body-stripe{sign}", [(0.24, 0.7), (0.86, 0.73), (0.85, 0.755), (0.24, 0.725)], lo, hi, "stripe", bevel=0.004, segments=1)
    seat = kit.soften([(0.15, 0.85), (0.98, 0.87), (0.99, 0.92), (0.9, 0.98), (0.3, 0.98), (0.12, 0.92)], [0.02, 0.03, 0.04, 0.05, 0.06, 0.04])
    kit.prism("seat", seat, -0.14, 0.14, "seat", bevel=0.05, segments=5)
    cowl = kit.soften([(1.29, 1.02), (1.52, 1.01), (1.59, 1.08), (1.52, 1.17), (1.32, 1.19), (1.25, 1.1)], [0.03, 0.04, 0.05, 0.05, 0.04, 0.04])
    kit.prism("cowl", cowl, -0.2, 0.2, "paint", bevel=0.06, segments=5)
    kit.box("headlight", (1.585, 0, 1.085), (0.03, 0.17, 0.06), "lamp", 0.012)
    for sign in (1, -1):
        kit.box(f"indicator{sign}", (1.56, sign * 0.17, 1.07), (0.04, 0.05, 0.03), "amber", 0.01)
    handlebar(1.36, 1.13, 0.33)
    mirrors(1.32, 1.17, 0.26)
    kit.box("engine", (0.76, 0, 0.36), (0.34, 0.2, 0.18), "engine", 0.03)
    kit.cylinder("crank-cover", (0.72, -0.105, 0.33), 0.09, 0.035, "engine", axis="Y", bevel=0.01)
    kit.tube("header", (0.95, -0.06, 0.32), (0.66, -0.16, 0.27), 0.02, "chrome", sides=14)
    kit.tube("muffler", (0.68, -0.17, 0.28), (0.14, -0.17, 0.42), 0.048, "chrome", sides=24)
    kit.tube("heat-shield", (0.6, -0.215, 0.31), (0.3, -0.215, 0.38), 0.024, "satin", sides=16)
    for sign in (1, -1):
        kit.tube(f"swingarm{sign}", (0.66, sign * 0.1, 0.34), (rear_x, sign * 0.085, rr), 0.022, "satin", sides=14)
        kit.tube(f"shock{sign}", (0.36, sign * 0.115, 0.3), (0.45, sign * 0.12, 0.72), 0.017, "satin", sides=14)
        kit.tube(f"spring{sign}", (0.38, sign * 0.115, 0.38), (0.44, sign * 0.12, 0.64), 0.028, "stripe", sides=14)
        kit.tube(f"peg{sign}", (0.66, sign * 0.12, 0.28), (0.64, sign * 0.21, 0.28), 0.015, "seat", sides=12)
    arc_band("rear-fender", rear_x, rr, rr + 0.025, rr + 0.045, 70, 175, 0.07, "trim")
    kit.box("taillight", (0.05, 0, 0.74), (0.04, 0.14, 0.05), "tail", 0.012)
    cargo_box(0.24, 0.97, (0.42, 0.4, 0.4))


def build_motorcycle(spec):
    if spec["layout"] == "street":
        build_cg(spec)
    else:
        build_biz(spec)
