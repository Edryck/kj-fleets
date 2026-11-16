import type { Map as MapLibreMap } from "maplibre-gl";
import type { MapLeg } from "../components/RouteLegs";
import { prefersReducedMotion } from "../motion/reducedMotion";
import { arcPoints, setArcData, setCometData, setLegData, type SceneArc } from "./mapLayers";

const STAGGER = 0.17;
const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;
const noop = () => {};

function lerp(a: [number, number], b: [number, number], f: number): [number, number] {
    return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
}

export function partialLine(points: [number, number][], progress: number): [number, number][] {
    if (points.length < 2) return points.slice();
    const budget = Math.min(1, Math.max(0, progress)) * (points.length - 1);
    const whole = Math.floor(budget);
    const f = budget - whole;
    const cut = points.slice(0, whole + 1);
    if (f > 0 && whole + 1 < points.length) cut.push(lerp(points[whole], points[whole + 1], f));
    return cut;
}

function cutLegs(legs: MapLeg[], progress: number): MapLeg[] {
    const total = legs.reduce((n, leg) => n + Math.max(0, leg.points.length - 1), 0);
    let budget = progress * total;
    const out: MapLeg[] = [];
    for (const leg of legs) {
        const segments = leg.points.length - 1;
        if (budget <= 0 || segments < 1) break;
        if (budget >= segments) {
            out.push(leg);
            budget -= segments;
            continue;
        }
        const points = partialLine(leg.points, budget / segments);
        if (points.length > 1) out.push({ ...leg, points });
        budget = 0;
    }
    return out;
}

export function animateLegs(map: MapLibreMap, legs: MapLeg[], duration = 1400): () => void {
    if (prefersReducedMotion()) {
        setLegData(map, legs);
        return noop;
    }
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
        const t = Math.min(1, (now - t0) / duration);
        setLegData(map, cutLegs(legs, easeOutCubic(t)));
        raf = t < 1 ? requestAnimationFrame(tick) : 0;
    };
    raf = requestAnimationFrame(tick);
    return () => {
        if (raf) cancelAnimationFrame(raf);
        raf = 0;
    };
}

export function animateArcs(map: MapLibreMap, arcs: SceneArc[], duration = 900): Promise<void> {
    if (prefersReducedMotion()) {
        setArcData(map, arcs, 1);
        return Promise.resolve();
    }
    return new Promise((resolve) => {
        const t0 = performance.now();
        const tick = (now: number) => {
            const t = Math.min(1, (now - t0) / duration);
            setArcData(map, arcs, easeOutCubic(t));
            if (t < 1) requestAnimationFrame(tick);
            else resolve();
        };
        requestAnimationFrame(tick);
    });
}

export function cometPositions(
    paths: [number, number][][],
    elapsedMs: number,
    period = 2200,
    cycles = 2,
): ([number, number] | null)[] {
    return paths.map((points, i) => {
        const u = elapsedMs / period - i * STAGGER;
        if (u < 0 || u > cycles || points.length < 2) return null;
        const k = (u % 1) * (points.length - 1);
        const j = Math.floor(k);
        return lerp(points[j], points[Math.min(j + 1, points.length - 1)], k - j);
    });
}

export function cometsDone(count: number, elapsedMs: number, period = 2200, cycles = 2): boolean {
    return elapsedMs > period * (cycles + STAGGER * Math.max(0, count - 1));
}

export function startComets(
    map: MapLibreMap,
    arcs: SceneArc[],
    options: { period?: number; cycles?: number } = {},
): () => void {
    if (prefersReducedMotion() || arcs.length === 0) return noop;
    const { period = 2200, cycles = 2 } = options;
    const paths = arcs.map((arc) => arcPoints(arc.from, arc.to, 64));
    let raf = 0;
    const t0 = performance.now();
    const frame = (now: number) => {
        const elapsed = now - t0;
        if (cometsDone(paths.length, elapsed, period, cycles)) {
            setCometData(map, []);
            raf = 0;
            return;
        }
        const points = cometPositions(paths, elapsed, period, cycles).filter(
            (p): p is [number, number] => p !== null,
        );
        setCometData(map, points);
        raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
        if (raf) cancelAnimationFrame(raf);
        raf = 0;
        setCometData(map, []);
    };
}

export function introSpin(map: MapLibreMap, degrees = 22, duration = 12000): () => void {
    if (prefersReducedMotion()) return noop;
    map.easeTo({
        bearing: map.getBearing() + degrees,
        duration,
        easing: easeOutCubic,
        essential: true,
    });
    return () => map.stop();
}
