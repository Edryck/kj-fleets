import { RefreshCw, TriangleAlert } from "lucide-react";
import { formatTime } from "./format";

const STALE_MS = 5 * 60_000;

export default function GeneratedAt({
    generatedAt,
    timezone = "America/Sao_Paulo",
    onRefresh,
}: {
    generatedAt: string;
    timezone?: string;
    onRefresh: () => void;
}) {
    const stale = Date.now() - Date.parse(generatedAt) > STALE_MS;
    return (
        <div className="generated-at caption">
            {stale && <TriangleAlert size={14} aria-label="Dados com mais de 5 minutos" />}
            Atualizado às {formatTime(generatedAt, timezone)}
            <button
                type="button"
                className="btn btn-ghost btn-icon"
                onClick={onRefresh}
                aria-label="Atualizar"
            >
                <RefreshCw size={16} aria-hidden="true" />
            </button>
        </div>
    );
}
