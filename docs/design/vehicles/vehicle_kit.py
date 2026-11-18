import math

import bmesh
import bpy
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Matrix, Vector

MATERIALS = {}
LIGHT = {"world": 0.35, "gain": 1.0, "key": 420, "top": 260, "fill": 110, "rim": 180}
PAINTED = {"paint"}


def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    MATERIALS.clear()


def principled(name, color, rough=0.5, metal=0.0, coat=0.0, coat_rough=0.05, emit=None, strength=0.0):
    material = bpy.data.materials.new(name)
    if material.node_tree is None and hasattr(material, "use_nodes"):
        material.use_nodes = True
    shader = next(n for n in material.node_tree.nodes if n.bl_idname == "ShaderNodeBsdfPrincipled")
    shader.inputs["Base Color"].default_value = (*color, 1.0)
    shader.inputs["Roughness"].default_value = rough
    shader.inputs["Metallic"].default_value = metal
    shader.inputs["Coat Weight"].default_value = coat
    shader.inputs["Coat Roughness"].default_value = coat_rough
    if emit:
        shader.inputs["Emission Color"].default_value = (*emit, 1.0)
        shader.inputs["Emission Strength"].default_value = strength
    return material


def build_materials():
    MATERIALS.update(
        paint=principled("paint", (0.82, 0.83, 0.81), rough=0.34, coat=0.6, coat_rough=0.06),
        box=principled("box", (0.84, 0.85, 0.83), rough=0.42, coat=0.25),
        stripe=principled("stripe", (0.44, 0.88, 0.02), rough=0.38, coat=0.3),
        glass=principled("glass", (0.012, 0.022, 0.019), rough=0.05, coat=1.0, coat_rough=0.02),
        trim=principled("trim", (0.018, 0.019, 0.019), rough=0.55),
        satin=principled("satin", (0.05, 0.052, 0.053), rough=0.4, coat=0.3),
        rubber=principled("rubber", (0.014, 0.014, 0.014), rough=0.86),
        rim=principled("rim", (0.52, 0.535, 0.535), rough=0.3, metal=0.75),
        hub=principled("hub", (0.08, 0.085, 0.085), rough=0.4, metal=0.5),
        chrome=principled("chrome", (0.82, 0.83, 0.83), rough=0.1, metal=1.0),
        lamp=principled("lamp", (0.6, 0.64, 0.68), rough=0.08, metal=0.6, coat=1.0, emit=(1.0, 0.98, 0.94), strength=0.6),
        amber=principled("amber", (0.92, 0.42, 0.03), rough=0.15, coat=0.8),
        tail=principled("tail", (0.52, 0.02, 0.02), rough=0.15, coat=0.8),
        chassis=principled("chassis", (0.03, 0.031, 0.032), rough=0.6),
        engine=principled("engine", (0.26, 0.27, 0.275), rough=0.38, metal=0.65),
        seat=principled("seat", (0.024, 0.024, 0.024), rough=0.72),
    )


def to_object(name, bm, material, bevel=0.0, segments=4, angle=32.0):
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    obj.data.materials.append(MATERIALS[material])
    if bevel > 0:
        modifier = obj.modifiers.new("bevel", "BEVEL")
        modifier.width = bevel
        modifier.segments = segments
        modifier.limit_method = "ANGLE"
        modifier.angle_limit = math.radians(30)
        modifier.use_clamp_overlap = True
        depsgraph = bpy.context.evaluated_depsgraph_get()
        evaluated = obj.evaluated_get(depsgraph)
        baked = bpy.data.meshes.new_from_object(evaluated)
        obj.modifiers.clear()
        old = obj.data
        obj.data = baked
        bpy.data.meshes.remove(old)
    obj.data.shade_smooth()
    obj.data.set_sharp_from_angle(angle=math.radians(angle))
    obj["material_key"] = material
    return obj


def soften(points, radii, steps=8):
    result = []
    count = len(points)
    for i, point in enumerate(points):
        radius = radii[i] if i < len(radii) else 0
        if radius <= 0:
            result.append(point)
            continue
        prev = Vector(points[i - 1])
        here = Vector(point)
        nxt = Vector(points[(i + 1) % count])
        a = (prev - here)
        b = (nxt - here)
        da = min(radius, a.length * 0.48)
        db = min(radius, b.length * 0.48)
        start = here + a.normalized() * da
        end = here + b.normalized() * db
        for s in range(steps + 1):
            t = s / steps
            q = start * (1 - t) ** 2 + here * 2 * (1 - t) * t + end * t * t
            result.append((q.x, q.y))
    return result


def arch_points(cx, cz, radius, zb, steps=26):
    dz = zb - cz
    dz = max(-radius * 0.95, min(radius * 0.95, dz))
    half = math.sqrt(radius * radius - dz * dz)
    angle = math.asin(dz / radius)
    points = [(cx - half, zb)]
    start, stop = math.pi - angle, angle
    for i in range(1, steps):
        t = start + (stop - start) * i / steps
        points.append((cx + radius * math.cos(t), cz + radius * math.sin(t)))
    points.append((cx + half, zb))
    return points


def outline(x_rear, x_front, zb, top, arches):
    points = [(x_rear, zb)]
    for cx, cz, radius in sorted(arches):
        points.extend(arch_points(cx, cz, radius, zb))
    points.append((x_front, zb))
    points.extend(top)
    return points


def dedupe(points, eps=1e-4):
    clean = []
    for p in points:
        if not clean or (Vector(p) - Vector(clean[-1])).length > eps:
            clean.append(p)
    if len(clean) > 2 and (Vector(clean[0]) - Vector(clean[-1])).length <= eps:
        clean.pop()
    return clean


def prism(name, points, y0, y1, material, bevel=0.0, segments=4, angle=32.0):
    points = dedupe(points)
    bm = bmesh.new()
    verts = [bm.verts.new((x, y0, z)) for x, z in points]
    face = bm.faces.new(verts)
    extruded = bmesh.ops.extrude_face_region(bm, geom=[face])
    moved = [g for g in extruded["geom"] if isinstance(g, bmesh.types.BMVert)]
    bmesh.ops.translate(bm, verts=moved, vec=(0, y1 - y0, 0))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    return to_object(name, bm, material, bevel, segments, angle)


def box(name, center, size, material, bevel=0.0, segments=3, rotation=(0, 0, 0)):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    scale = Matrix.Diagonal((*size, 1.0))
    rot = (
        Matrix.Rotation(rotation[2], 4, "Z")
        @ Matrix.Rotation(rotation[1], 4, "Y")
        @ Matrix.Rotation(rotation[0], 4, "X")
    )
    bmesh.ops.transform(bm, matrix=Matrix.Translation(center) @ rot @ scale, verts=bm.verts)
    return to_object(name, bm, material, bevel, segments)


def cylinder(name, center, radius, depth, material, axis="Y", bevel=0.0, segments=3, sides=48, radius2=None):
    bm = bmesh.new()
    bmesh.ops.create_cone(
        bm,
        cap_ends=True,
        segments=sides,
        radius1=radius,
        radius2=radius if radius2 is None else radius2,
        depth=depth,
    )
    if axis == "Y":
        turn = Matrix.Rotation(math.radians(-90), 4, "X")
    elif axis == "X":
        turn = Matrix.Rotation(math.radians(90), 4, "Y")
    else:
        turn = Matrix.Identity(4)
    bmesh.ops.transform(bm, matrix=Matrix.Translation(center) @ turn, verts=bm.verts)
    return to_object(name, bm, material, bevel, segments)


def tube(name, start, end, radius, material, sides=20, bevel=0.0):
    start, end = Vector(start), Vector(end)
    direction = end - start
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=sides, radius1=radius, radius2=radius, depth=direction.length)
    rot = direction.to_track_quat("Z", "Y").to_matrix().to_4x4()
    bmesh.ops.transform(bm, matrix=Matrix.Translation((start + end) / 2) @ rot, verts=bm.verts)
    return to_object(name, bm, material, bevel, 2)


def sphere(name, center, radius, material, scale=(1, 1, 1)):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=40, v_segments=24, radius=radius)
    bmesh.ops.transform(bm, matrix=Matrix.Translation(center) @ Matrix.Diagonal((*scale, 1.0)), verts=bm.verts)
    return to_object(name, bm, material, 0.0, 0, angle=80)


def slab(name, p_top, p_bottom, y_half, material, inset=0.05, thick=0.014, lift=0.004, bevel=0.012, outward=1):
    a, b = Vector(p_top), Vector(p_bottom)
    d = (b - a).normalized()
    n = Vector((d.y, -d.x)) * outward
    if n.x < 0 and outward == 1:
        n = -n
    a2 = a + d * inset + n * lift
    b2 = b - d * inset + n * lift
    points = [(a2.x, a2.y), (b2.x, b2.y), ((b2 + n * thick).x, (b2 + n * thick).y), ((a2 + n * thick).x, (a2 + n * thick).y)]
    return prism(name, points, -y_half, y_half, material, bevel=bevel, segments=2)


def wheel(name, x, z, y, radius, width, side, style="van", dual=False):
    parts = []
    tires = [0.0] if not dual else [-(width * 0.53), width * 0.53]
    for i, offset in enumerate(tires):
        yc = y + side * offset
        parts.append(cylinder(f"{name}-tire{i}", (x, yc, z), radius, width, "rubber", bevel=width * 0.24, segments=5, sides=64))
    outer = y + side * (tires[-1] if side > 0 else -tires[0]) if dual else y
    face_y = outer + side * (width * 0.5 - 0.012)
    if style == "truck":
        rim_r = radius * 0.6
        parts.append(cylinder(f"{name}-rim", (x, face_y - side * 0.03, z), rim_r, 0.07, "rim", bevel=0.012, sides=48))
        parts.append(cylinder(f"{name}-dish", (x, face_y - side * 0.0, z), rim_r * 0.72, 0.04, "rim", bevel=0.01, sides=48))
        parts.append(cylinder(f"{name}-hub", (x, face_y + side * 0.012, z), rim_r * 0.36, 0.06, "hub", bevel=0.01, sides=32))
        for k in range(8 if radius > 0.45 else 6):
            a = 2 * math.pi * k / (8 if radius > 0.45 else 6)
            parts.append(cylinder(f"{name}-nut{k}", (x + math.cos(a) * rim_r * 0.5, face_y + side * 0.018, z + math.sin(a) * rim_r * 0.5), rim_r * 0.06, 0.04, "chrome", sides=12))
        for k in range(6):
            a = 2 * math.pi * (k + 0.5) / 6
            parts.append(cylinder(f"{name}-vent{k}", (x + math.cos(a) * rim_r * 0.8, face_y + side * 0.004, z + math.sin(a) * rim_r * 0.8), rim_r * 0.1, 0.03, "hub", sides=16))
    else:
        rim_r = radius * 0.64
        parts.append(cylinder(f"{name}-rim", (x, face_y - side * 0.02, z), rim_r, 0.05, "rim", bevel=0.01, sides=48))
        parts.append(cylinder(f"{name}-hub", (x, face_y + side * 0.008, z), rim_r * 0.3, 0.04, "hub", bevel=0.008, sides=32))
        holes = 6
        for k in range(holes):
            a = 2 * math.pi * k / holes
            parts.append(cylinder(f"{name}-hole{k}", (x + math.cos(a) * rim_r * 0.62, face_y + side * 0.004, z + math.sin(a) * rim_r * 0.62), rim_r * 0.17, 0.03, "hub", sides=20))
    return parts


def axle_pair(name, x, z, half_track, radius, width, style="van", dual=False):
    parts = []
    for side in (-1, 1):
        parts += wheel(f"{name}{'L' if side > 0 else 'R'}", x, z, side * half_track, radius, width, side, style, dual)
    return parts


def setup_render(samples, width, height, transparent=True, cpu=False):
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    if cpu:
        scene.cycles.device = "CPU"
    else:
        prefs = bpy.context.preferences.addons["cycles"].preferences
        prefs.compute_device_type = "METAL"
        prefs.get_devices()
        for device in prefs.devices:
            device.use = device.type == "METAL"
        scene.cycles.device = "GPU"
    scene.cycles.samples = samples
    scene.cycles.use_adaptive_sampling = True
    scene.cycles.use_denoising = True
    scene.cycles.max_bounces = 6
    scene.render.film_transparent = transparent
    scene.render.resolution_x = width
    scene.render.resolution_y = height
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.view_settings.view_transform = "AgX"
    scene.view_settings.look = "None"
    scene.view_settings.exposure = 0.0


def setup_world(strength=0.9):
    world = bpy.data.worlds.new("studio")
    bpy.context.scene.world = world
    if world.node_tree is None and hasattr(world, "use_nodes"):
        world.use_nodes = True
    nodes = world.node_tree.nodes
    background = next(n for n in nodes if n.bl_idname == "ShaderNodeBackground")
    sky = nodes.new("ShaderNodeTexGradient")
    coords = nodes.new("ShaderNodeTexCoord")
    mapping = nodes.new("ShaderNodeMapping")
    mapping.inputs["Rotation"].default_value = (0, math.radians(-90), 0)
    ramp = nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].color = (0.32, 0.34, 0.34, 1)
    ramp.color_ramp.elements[1].color = (1.0, 1.0, 1.0, 1)
    links = world.node_tree.links
    links.new(coords.outputs["Generated"], mapping.inputs["Vector"])
    links.new(mapping.outputs["Vector"], sky.inputs["Vector"])
    links.new(sky.outputs["Fac"], ramp.inputs["Fac"])
    links.new(ramp.outputs["Color"], background.inputs["Color"])
    background.inputs["Strength"].default_value = strength


def area_light(name, location, target, size, energy, color=(1, 1, 1)):
    data = bpy.data.lights.new(name, "AREA")
    data.size = size
    data.energy = energy
    data.color = color
    obj = bpy.data.objects.new(name, data)
    bpy.context.scene.collection.objects.link(obj)
    obj.location = location
    direction = Vector(target) - Vector(location)
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    return obj


def vehicle_objects():
    return [o for o in bpy.context.scene.objects if o.type == "MESH" and not o.get("ground")]


def bounds(objects):
    xs, ys, zs = [], [], []
    for obj in objects:
        for corner in obj.bound_box:
            world = obj.matrix_world @ Vector(corner)
            xs.append(world.x)
            ys.append(world.y)
            zs.append(world.z)
    return Vector((min(xs), min(ys), min(zs))), Vector((max(xs), max(ys), max(zs)))


def setup_studio():
    lo, hi = bounds(vehicle_objects())
    center = (lo + hi) / 2
    size = max((hi - lo).x, (hi - lo).z)
    scale = size / 6.0
    ground = bpy.data.meshes.new("ground")
    bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=size * 6)
    bm.to_mesh(ground)
    bm.free()
    plane = bpy.data.objects.new("ground", ground)
    plane["ground"] = True
    plane.is_shadow_catcher = True
    bpy.context.scene.collection.objects.link(plane)
    setup_world(LIGHT["world"])
    s = size
    k = LIGHT["gain"] * scale * scale
    area_light("key", center + Vector((s * 0.55, -s * 0.85, s * 1.25)), center, s * 1.1, LIGHT["key"] * k)
    area_light("top", center + Vector((0, 0, s * 1.6)), center, s * 1.6, LIGHT["top"] * k)
    area_light("fill", center + Vector((-s * 0.9, -s * 0.9, s * 0.45)), center, s * 1.2, LIGHT["fill"] * k)
    area_light("rim", center + Vector((-s * 0.6, s * 1.1, s * 0.9)), center, s * 0.9, LIGHT["rim"] * k)
    return plane


def frame_camera(view, aspect, margin=0.06):
    scene = bpy.context.scene
    objects = vehicle_objects()
    lo, hi = bounds(objects)
    center = (lo + hi) / 2
    data = bpy.data.cameras.new("camera")
    camera = bpy.data.objects.new("camera", data)
    scene.collection.objects.link(camera)
    scene.camera = camera
    corners = [Vector((x, y, z)) for x in (lo.x, hi.x) for y in (lo.y, hi.y) for z in (lo.z, hi.z)]
    if view == "side":
        data.type = "ORTHO"
        camera.location = (center.x, lo.y - 30, center.z)
        camera.rotation_euler = (math.radians(90), 0, 0)
        span_x = (hi.x - lo.x)
        span_z = (hi.z - lo.z)
        data.ortho_scale = max(span_x, span_z * aspect) * (1 + margin * 2)
        data.clip_end = 100
        return camera
    data.type = "PERSP"
    data.lens = 58
    data.clip_end = 200
    azimuth = math.radians(54)
    elevation = math.radians(15)
    direction = Vector((math.cos(elevation) * math.cos(azimuth), -math.cos(elevation) * math.sin(azimuth), math.sin(elevation)))
    target = center
    distance = (hi - lo).length * 2.2
    for _ in range(6):
        camera.location = target + direction * distance
        camera.rotation_euler = (-direction).to_track_quat("-Z", "Y").to_euler()
        bpy.context.view_layer.update()
        projected = [world_to_camera_view(scene, camera, c) for c in corners]
        spread = max(max(abs(p.x - 0.5), abs(p.y - 0.5)) for p in projected) * 2
        distance *= spread / (1 - margin * 2)
    return camera


def render_to(path):
    bpy.context.scene.render.filepath = path
    bpy.ops.render.render(write_still=True)


def render_mask(path, samples=24):
    scene = bpy.context.scene
    white = bpy.data.materials.new("mask-paint")
    if white.node_tree is None and hasattr(white, "use_nodes"):
        white.use_nodes = True
    nodes = white.node_tree.nodes
    for node in list(nodes):
        nodes.remove(node)
    out = nodes.new("ShaderNodeOutputMaterial")
    emission = nodes.new("ShaderNodeEmission")
    emission.inputs["Color"].default_value = (1, 1, 1, 1)
    white.node_tree.links.new(emission.outputs["Emission"], out.inputs["Surface"])
    hold = bpy.data.materials.new("mask-hold")
    if hold.node_tree is None and hasattr(hold, "use_nodes"):
        hold.use_nodes = True
    nodes = hold.node_tree.nodes
    for node in list(nodes):
        nodes.remove(node)
    out = nodes.new("ShaderNodeOutputMaterial")
    holdout = nodes.new("ShaderNodeHoldout")
    hold.node_tree.links.new(holdout.outputs["Holdout"], out.inputs["Surface"])
    saved = {}
    for obj in scene.objects:
        if obj.type != "MESH":
            continue
        if obj.get("ground"):
            obj.hide_render = True
            continue
        saved[obj.name] = list(obj.data.materials)
        target = white if obj.get("material_key") in PAINTED else hold
        obj.data.materials.clear()
        obj.data.materials.append(target)
    samples_before = scene.cycles.samples
    denoise_before = scene.cycles.use_denoising
    scene.cycles.samples = samples
    scene.cycles.use_denoising = False
    render_to(path)
    scene.cycles.samples = samples_before
    scene.cycles.use_denoising = denoise_before
    for obj in scene.objects:
        if obj.name in saved:
            obj.data.materials.clear()
            for material in saved[obj.name]:
                obj.data.materials.append(material)
        if obj.get("ground"):
            obj.hide_render = False
