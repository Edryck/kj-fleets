import type { OrderStatus } from "../api/types";
import { badgeEntry } from "../components/StatusBadge";
import { formatDateTime } from "../components/format";
import { isActive, TIMELINE_LABEL } from "../pages/orderActions";
import type { TimelineStop } from "./StopTimeline";

export interface TrackEvent {
    code: string;
    status: OrderStatus;
    at: string;
}

export function timelineFromEvents(events: TrackEvent[]): TimelineStop[] {
    const last = events.at(-1);
    const open = last != null && isActive(last.status);
    return events.map((event, index) => {
        const isLast = index === events.length - 1;
        return {
            id: `${event.at}-${index}`,
            kind: index === 0 ? "start" : "waypoint",
            label: "•",
            name: TIMELINE_LABEL[event.code] ?? badgeEntry("order", event.status).label,
            note: formatDateTime(event.at),
            state: isLast && open ? "next" : "done",
        };
    });
}
