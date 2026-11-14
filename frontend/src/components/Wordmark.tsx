// Sem arquivo de logo no repositório (só o guia de marca em PNG): marca em texto até haver asset oficial
export default function Wordmark({
    compact = false,
    size = "md",
}: {
    compact?: boolean;
    size?: "md" | "lg";
}) {
    return (
        <span className={`wordmark wordmark-${size}`} aria-label="KJ Fleets">
            <span className="wordmark-kj" aria-hidden="true">
                KJ
            </span>
            {!compact && (
                <span className="wordmark-fleets" aria-hidden="true">
                    Fleets
                </span>
            )}
        </span>
    );
}
