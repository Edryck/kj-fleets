import { useId } from "react";

export const HELD_KARP_MAX = 15;

export const ALGORITHM_LABEL: Record<string, string> = {
    NEAREST_NEIGHBOR: "Mais perto primeiro (vizinho mais próximo)",
    TWO_OPT: "Desfaz cruzamentos (2-opt)",
    HELD_KARP: "Exato, mais lento (Held-Karp)",
    SIMULATED_ANNEALING: "Busca aleatória (têmpera simulada)",
};

interface Props {
    algorithm: string;
    onAlgorithm: (value: string) => void;
    seed: string;
    onSeed: (value: string) => void;
    waypointCount: number;
    compact?: boolean;
}

export default function AlgorithmFields({
    algorithm,
    onAlgorithm,
    seed,
    onSeed,
    waypointCount,
    compact = false,
}: Props) {
    const algorithmId = useId();
    const seedId = useId();
    const tooLarge = waypointCount > HELD_KARP_MAX;
    return (
        <div className={`field-row${compact ? " is-compact" : ""}`}>
            <div className="field">
                <label htmlFor={algorithmId}>Algoritmo</label>
                <select
                    id={algorithmId}
                    value={algorithm}
                    onChange={(e) => onAlgorithm(e.target.value)}
                >
                    <option value="">Automático</option>
                    {Object.entries(ALGORITHM_LABEL).map(([value, label]) => (
                        <option
                            key={value}
                            value={value}
                            disabled={value === "HELD_KARP" && tooLarge}
                            title={
                                value === "HELD_KARP" && tooLarge
                                    ? `O método exato vai até ${HELD_KARP_MAX} paradas`
                                    : undefined
                            }
                        >
                            {label}
                        </option>
                    ))}
                </select>
                {tooLarge && !compact && (
                    <p className="field-help">
                        O método exato vai até {HELD_KARP_MAX} paradas; este pedido tem{" "}
                        {waypointCount}.
                    </p>
                )}
            </div>
            {algorithm === "SIMULATED_ANNEALING" && (
                <div className="field">
                    <label htmlFor={seedId}>Seed</label>
                    <input
                        id={seedId}
                        inputMode="numeric"
                        value={seed}
                        onChange={(e) => onSeed(e.target.value.replace(/[^0-9]/g, ""))}
                        placeholder="Opcional"
                        title={compact ? "Mesma seed, mesmo resultado." : undefined}
                    />
                    {!compact && <p className="field-help">Mesma seed, mesmo resultado.</p>}
                </div>
            )}
        </div>
    );
}
