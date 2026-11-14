import { useId } from "react";

export const HELD_KARP_MAX = 15;

export const ALGORITHM_LABEL: Record<string, string> = {
    NEAREST_NEIGHBOR: "Vizinho mais próximo",
    TWO_OPT: "2-opt",
    HELD_KARP: "Exato (Held-Karp)",
    SIMULATED_ANNEALING: "Têmpera simulada",
};

interface Props {
    // "" = deixa a API escolher
    algorithm: string;
    onAlgorithm: (value: string) => void;
    seed: string;
    onSeed: (value: string) => void;
    waypointCount: number;
}

export default function AlgorithmFields({
    algorithm,
    onAlgorithm,
    seed,
    onSeed,
    waypointCount,
}: Props) {
    const algorithmId = useId();
    const seedId = useId();
    const tooLarge = waypointCount > HELD_KARP_MAX;
    return (
        <div className="field-row">
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
                {tooLarge && (
                    <p className="field-help">
                        Held-Karp vai até {HELD_KARP_MAX} paradas; este pedido tem {waypointCount}.
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
                    />
                    <p className="field-help">Mesma seed, mesmo resultado.</p>
                </div>
            )}
        </div>
    );
}
