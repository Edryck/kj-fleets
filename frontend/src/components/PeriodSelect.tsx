import { useSearchParams } from "react-router-dom";

export const PERIODS = [
    { value: "today", label: "Hoje" },
    { value: "7d", label: "7 dias" },
    { value: "15d", label: "15 dias" },
    { value: "1m", label: "1 mês" },
] as const;

export type Period = (typeof PERIODS)[number]["value"];

export function usePeriod(): [Period, (period: Period) => void] {
    const [params, setParams] = useSearchParams();
    const raw = params.get("period");
    const period = PERIODS.some((p) => p.value === raw) ? (raw as Period) : "today";
    const setPeriod = (next: Period) =>
        setParams(
            (prev) => {
                const copy = new URLSearchParams(prev);
                copy.set("period", next);
                return copy;
            },
            { replace: true },
        );
    return [period, setPeriod];
}

export default function PeriodSelect() {
    const [period, setPeriod] = usePeriod();
    return (
        <div className="segmented" role="group" aria-label="Período">
            {PERIODS.map((p) => (
                <button
                    key={p.value}
                    type="button"
                    aria-pressed={period === p.value}
                    onClick={() => setPeriod(p.value)}
                >
                    {p.label}
                </button>
            ))}
        </div>
    );
}
