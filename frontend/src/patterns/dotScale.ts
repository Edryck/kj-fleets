const DEFAULT_CAP = 12;

export function dotScale(
    counts: number[],
    stale: number[],
    cap = DEFAULT_CAP,
): { perDot: number; dots: number[]; staleDots: number[] } {
    const peak = Math.max(0, ...counts);
    const perDot = peak > cap ? Math.ceil(peak / cap) : 1;
    const dots = counts.map((count) => Math.ceil(Math.max(0, count) / perDot));
    const staleDots = stale.map((value, index) =>
        Math.min(Math.ceil(Math.max(0, value) / perDot), dots[index] ?? 0),
    );
    return { perDot, dots, staleDots };
}
