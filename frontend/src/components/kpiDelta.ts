export type DeltaTone = "success" | "danger" | "neutral";

// goodWhen: o que é bom para a métrica; falha subindo nunca vira verde
export function kpiDelta(
    current: number,
    previous: number | null | undefined,
    goodWhen: "up" | "down" | "neutral",
): { diff: number; text: string; tone: DeltaTone } | null {
    if (previous == null) return null;
    const diff = current - previous;
    if (diff === 0) return { diff, text: "igual", tone: "neutral" };
    let tone: DeltaTone = "neutral";
    if (goodWhen !== "neutral") tone = diff > 0 === (goodWhen === "up") ? "success" : "danger";
    return { diff, text: diff > 0 ? `+${diff}` : String(diff), tone };
}
