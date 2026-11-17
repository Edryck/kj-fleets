import { Check } from "lucide-react";
import type { ReactNode } from "react";
import type { OrderDetail, OrderRoute, RouteStop } from "../api/types";

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
    km == null || km <= 0
        ? undefined
        : `${km.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} km`;

const timeText = (iso: string) => {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return undefined;
    return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
};

const radiusText = (meters: number | null | undefined) =>
    meters == null ? "" : ` · a ${Math.round(meters)} m do ponto`;

function noteFor(
    stop: RouteStop,
    state: TimelineStop["state"],
    estimated: boolean,
): string | undefined {
    if (state === "done" && stop.visitedAt) {
        const time = timeText(stop.visitedAt);
        return `${time ? `Concluída às ${time}` : "Concluída"}${radiusText(stop.distanceM)}`;
    }
    const km = kmText(stop.legKm);
    const parts = [state === "next" ? "Próxima" : null, km, estimated ? "trecho estimado" : null];
    const text = parts.filter(Boolean).join(" · ");
    return text || undefined;
}

export function timelineFromRoute(stops: RouteStop[], mode?: OrderRoute["mode"]): TimelineStop[] {
    const ordered = [...stops].sort((a, b) => a.seq - b.seq);
    const nextIndex = ordered.findIndex((stop) => !stop.visitedAt && stop.type !== "START");
    const departed = ordered.some((stop) => stop.visitedAt);
    let waypoint = 0;
    return ordered.map((stop, index) => {
        const kind = KIND[stop.type] ?? "waypoint";
        const state: TimelineStop["state"] =
            stop.visitedAt || (kind === "start" && departed)
                ? "done"
                : index === nextIndex
                  ? "next"
                  : "todo";
        const label = FIXED_LABEL[kind] ?? String(++waypoint);
        return {
            id: String(stop.seq),
            kind,
            label,
            name: kind === "start" ? stop.name || "Partida" : stop.name,
            note: noteFor(
                stop,
                state,
                mode === "ROAD" && index > 0 && !(stop.path && stop.path.length > 1),
            ),
            state,
        };
    });
}

export function timelineFromOrder(
    order: Pick<OrderDetail, "status" | "pickup" | "waypoints" | "dropoff">,
): TimelineStop[] {
    const state: TimelineStop["state"] = order.status === "COMPLETED" ? "done" : "todo";
    return [
        { id: "pickup", kind: "pickup", label: "R", name: order.pickup.name, state },
        ...order.waypoints.map((w, i) => ({
            id: `w${i + 1}`,
            kind: "waypoint" as const,
            label: String(i + 1),
            name: w.name,
            state,
        })),
        { id: "dropoff", kind: "dropoff", label: "E", name: order.dropoff.name, state },
    ];
}

export default function StopTimeline({
    stops,
    label,
    action,
}: {
    stops: TimelineStop[];
    label?: string;
    action?: (stop: TimelineStop) => ReactNode;
}) {
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
                        {action?.(stop)}
                    </div>
                </li>
            ))}
        </ol>
    );
}
