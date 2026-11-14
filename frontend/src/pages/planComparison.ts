export interface PlanComparison {
    diffKm: number;
    diffPct: number | null;
    summary: string | null;
}

const km = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

// diferença em favor do Húngaro; Guloso em 0 km não tem base para percentual
export function comparePlans(
    comparison: Partial<Record<"HUNGARIAN" | "GREEDY", number>>,
): PlanComparison {
    const { HUNGARIAN: hungarian, GREEDY: greedy } = comparison;
    if (hungarian == null || greedy == null) return { diffKm: 0, diffPct: null, summary: null };
    const diffKm = greedy - hungarian;
    const diffPct = greedy > 0 ? (diffKm / greedy) * 100 : null;
    if (Math.abs(diffKm) < 0.05)
        return { diffKm: 0, diffPct: diffPct === null ? null : 0, summary: "Mesmo resultado" };
    const winner = diffKm > 0 ? "Húngaro" : "Guloso";
    const loser = diffKm > 0 ? "o Guloso" : "o Húngaro";
    const pct = diffPct == null ? "" : ` (${km.format(Math.abs(diffPct))}%)`;
    return {
        diffKm,
        diffPct,
        summary: `${winner} economiza ${km.format(Math.abs(diffKm))} km${pct} contra ${loser}`,
    };
}
