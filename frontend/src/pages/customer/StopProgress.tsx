import type { CSSProperties } from "react";

export default function StopProgress({ done, total }: { done: number; total: number }) {
    const text = `${done} de ${total} ${total === 1 ? "parada" : "paradas"}`;
    return (
        <div className="stop-progress">
            <div
                className="stop-progress-track"
                role="progressbar"
                aria-label="Paradas concluídas"
                aria-valuemin={0}
                aria-valuemax={total}
                aria-valuenow={done}
                aria-valuetext={text}
            >
                {Array.from({ length: total }, (_, i) => (
                    <i
                        key={i}
                        className={`motion-grow${i < done ? " is-done" : i === done ? " is-next" : ""}`}
                        style={{ "--i": i } as CSSProperties}
                    />
                ))}
            </div>
            <span className="stop-progress-text">{text}</span>
        </div>
    );
}
