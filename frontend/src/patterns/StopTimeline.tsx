import { Check } from "lucide-react";
import type { RouteStop } from "../api/types";

export type TimelineStop = {
    id: string;
    kind: "start" | "pickup" | "waypoint" | "dropoff";
    label: string;
    name: string;
    note?: string;
    state: "done" | "next" | "todo";
};

const KIND: Record<string, TimelineStop["kind"]> = {
    START: "start",
    PICKUP: "pickup",
    WAYPOINT: "waypoint",
    DROPOFF: "dropoff",
};

const FIXED_LABEL: Partial<Record<TimelineStop["kind"], string>> = {
    start: "•",
    pickup: "R",
    dropoff: "E",
};

const STATE_TEXT: Record<TimelineStop["state"], string> = {
    done: "concluída",
    next: "próxima",
    todo: "pendente",
};

const kmText = (km: number | null) =>
    km == null ? undefined : `${km.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} km`;

const timeText = (iso: string) => {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return undefined;
    return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
};

function noteFor(stop: RouteStop, state: TimelineStop["state"]): string | undefined {
    if (state === "done" && stop.visitedAt) {
        const time = timeText(stop.visitedAt);
        return time ? `Concluída às ${time}` : "Concluída";
    }
    const km = kmText(stop.legKm);
    if (state === "next") return km ? `Próxima · ${km}` : "Próxima";
    return km;
}

export function timelineFromRoute(stops: RouteStop[]): TimelineStop[] {
    const ordered = [...stops].sort((a, b) => a.seq - b.seq);
    const nextIndex = ordered.findIndex((stop) => !stop.visitedAt);
    let waypoint = 0;
    return ordered.map((stop, index) => {
        const kind = KIND[stop.type] ?? "waypoint";
        const state: TimelineStop["state"] = stop.visitedAt
            ? "done"
            : index === nextIndex
              ? "next"
              : "todo";
        const label = FIXED_LABEL[kind] ?? String(++waypoint);
        return {
            id: String(stop.seq),
            kind,
            label,
            name: stop.name,
            note: noteFor(stop, state),
            state,
        };
    });
}

export default function StopTimeline({ stops, label }: { stops: TimelineStop[]; label?: string }) {
    return (
        <ol className="stop-timeline" aria-label={label ?? "Paradas"}>
            {stops.map((stop, index) => (
                <li
                    key={stop.id}
                    className={`stop-timeline-item is-${stop.state}${index === stops.length - 1 ? " is-last" : ""} motion-rise`}
                    style={{ "--i": index } as React.CSSProperties}
                >
                    <span className="stop-timeline-node" aria-hidden="true">
                        <span className={`stop-timeline-orb is-${stop.state} is-${stop.kind}`}>
                            {stop.state === "done" ? (
                                <Check size={13} strokeWidth={2.5} />
                            ) : (
                                <span>{stop.label}</span>
                            )}
                        </span>
                    </span>
                    <div className="stop-timeline-body">
                        <b>{stop.name}</b>
                        <span className="sr-only">{STATE_TEXT[stop.state]}</span>
                        {stop.note && <small>{stop.note}</small>}
                    </div>
                </li>
            ))}
        </ol>
    );
}
