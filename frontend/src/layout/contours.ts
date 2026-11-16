const CENTERS: [number, number, number][] = [
    [1180, 260, 1],
    [320, 820, 0.8],
];
const RINGS = 16;
const SEGMENTS = 64;
const RING_STEP = 46;
const STRETCH = 1.25;

function wobble(t: number, ring: number): number {
    return (
        1 +
        0.09 * Math.sin(3 * t + ring * 0.7) +
        0.05 * Math.sin(5 * t - ring) +
        0.03 * Math.sin(9 * t + ring * 1.3)
    );
}

export function contourPaths(): string[] {
    const paths: string[] = [];
    for (const [cx, cy, scale] of CENTERS) {
        for (let ring = 1; ring <= RINGS; ring++) {
            const points: string[] = [];
            for (let step = 0; step <= SEGMENTS; step++) {
                const t = (step / SEGMENTS) * Math.PI * 2;
                const radius = ring * RING_STEP * scale * wobble(t, ring);
                points.push(
                    `${(cx + Math.cos(t) * radius * STRETCH).toFixed(1)},${(cy + Math.sin(t) * radius).toFixed(1)}`,
                );
            }
            paths.push(`M${points.join("L")}Z`);
        }
    }
    return paths;
}
