import type { ReactNode } from "react";
import Avatar from "../../patterns/Avatar";

export default function PersonHead({
    name,
    mono,
    meta,
    note,
}: {
    name: string;
    mono?: boolean;
    meta?: ReactNode;
    note?: ReactNode;
}) {
    return (
        <div className="dp-head">
            <Avatar name={name} size="lg" />
            <div className="dp-who">
                <span className={`dp-name${mono ? " data" : ""}`}>{name}</span>
                {meta && <span className="dp-meta">{meta}</span>}
                {note && <small>{note}</small>}
            </div>
        </div>
    );
}
