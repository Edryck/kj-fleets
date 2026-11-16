export type GlassVariant = "regular" | "clear";

export interface GlassConfig {
    bezel?: number;
    bezelRatio?: number;
    thickness: number;
    blur: number;
    refraction: number;
    specSaturation: number;
    specOpacity: number;
    light: number;
}

export const GLASS: Record<GlassVariant, GlassConfig> = {
    regular: {
        bezel: 26,
        thickness: 46,
        blur: 4.5,
        refraction: 1,
        specSaturation: 4,
        specOpacity: 0.85,
        light: -125,
    },
    clear: {
        bezelRatio: 0.42,
        thickness: 34,
        blur: 0.6,
        refraction: 1.15,
        specSaturation: 5,
        specOpacity: 0.95,
        light: -125,
    },
};

const REFRACTIVE_INDEX = 1.5;
const SLOPE_DELTA = 0.001;
const RIM_REACH = 14;
const RIM_FALLOFF = 1.15;
const GLOW_FALLOFF = 5.5;
const BACKLIGHT = 0.55;

export function squircle(x: number): number {
    return Math.pow(1 - Math.pow(1 - x, 4), 0.25);
}

export function refractionProfile(
    bezel: number,
    thickness: number,
    samples = 128,
): { magnitudes: Float32Array; max: number } {
    const raw = new Float32Array(samples);
    for (let i = 0; i < samples; i++) {
        const x = i / (samples - 1);
        const xa = Math.max(0, x - SLOPE_DELTA);
        const xb = Math.min(1, x + SLOPE_DELTA);
        const slope = ((squircle(xb) - squircle(xa)) / (xb - xa)) * (thickness / bezel);
        const incident = Math.atan(Math.abs(slope));
        const refracted = Math.asin(Math.sin(incident) / REFRACTIVE_INDEX);
        raw[i] = squircle(x) * thickness * Math.tan(incident - refracted);
    }
    const max = Math.max(...raw) || 1;
    return { magnitudes: raw.map((value) => value / max), max };
}

export function bezelFor(width: number, height: number, config: GlassConfig): number {
    const shortest = Math.min(width, height);
    if (config.bezelRatio) return shortest * config.bezelRatio;
    return Math.min(config.bezel ?? 0, shortest * 0.3);
}

export function glassPixels(
    width: number,
    height: number,
    radius: number,
    bezel: number,
    magnitudes: Float32Array,
    lightDeg: number,
): { displacement: Uint8ClampedArray; specular: Uint8ClampedArray } {
    const displacement = new Uint8ClampedArray(width * height * 4);
    const specular = new Uint8ClampedArray(width * height * 4);
    const lightX = Math.cos((lightDeg * Math.PI) / 180);
    const lightY = Math.sin((lightDeg * Math.PI) / 180);
    const halfW = width / 2;
    const halfH = height / 2;
    const last = magnitudes.length - 1;
    const normalReach = Math.max(bezel, RIM_REACH);
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const i = (y * width + x) * 4;
            const cx = x + 0.5 - halfW;
            const cy = y + 0.5 - halfH;
            const qx = Math.abs(cx) - (halfW - radius);
            const qy = Math.abs(cy) - (halfH - radius);
            const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0));
            const depth = -(outside + Math.min(Math.max(qx, qy), 0) - radius);
            let nx = 0;
            let ny = 0;
            if (depth < normalReach) {
                if (qx > 0 && qy > 0) {
                    const length = Math.hypot(qx, qy) || 1;
                    nx = qx / length;
                    ny = qy / length;
                } else if (qx > qy) {
                    nx = 1;
                } else {
                    ny = 1;
                }
                nx *= Math.sign(cx) || 1;
                ny *= Math.sign(cy) || 1;
            }
            let mx = 0;
            let my = 0;
            if (depth >= 0 && depth < bezel) {
                const magnitude = magnitudes[Math.min(last, Math.round((depth / bezel) * last))];
                mx = -nx * magnitude;
                my = -ny * magnitude;
            }
            displacement[i] = 128 + mx * 127;
            displacement[i + 1] = 128 + my * 127;
            displacement[i + 2] = 128;
            displacement[i + 3] = 255;
            if (depth >= -0.5 && depth < RIM_REACH) {
                const facing = nx * lightX + ny * lightY;
                const lit = facing >= 0 ? facing : -BACKLIGHT * facing;
                const cover = Math.min(1, depth + 0.5);
                const inset = Math.max(depth, 0);
                const rim = Math.exp(-inset / RIM_FALLOFF) * (0.28 + 0.72 * Math.pow(lit, 1.6));
                const glow = Math.exp(-inset / GLOW_FALLOFF) * 0.4 * Math.pow(lit, 3);
                specular[i] = 255;
                specular[i + 1] = 255;
                specular[i + 2] = 255;
                specular[i + 3] = Math.min(1, rim + glow) * cover * 255;
            }
        }
    }
    return { displacement, specular };
}

export function filterKey(
    variant: GlassVariant,
    width: number,
    height: number,
    radius: number,
): string {
    return `${variant}:${width}x${height}:${Math.round(radius)}`;
}

export function displacementScale(max: number, refraction: number): number {
    return max * 2 * refraction;
}
