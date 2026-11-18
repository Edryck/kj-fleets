import { useEffect, useRef, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import Glass from "../glass/Glass";

export type SheetSnap = "collapsed" | "half" | "full";

const ORDER: SheetSnap[] = ["collapsed", "half", "full"];
const DRAG_THRESHOLD = 40;

const step = (snap: SheetSnap, delta: number): SheetSnap =>
    ORDER[Math.min(ORDER.length - 1, Math.max(0, ORDER.indexOf(snap) + delta))];

export function SheetHandle({
    snap,
    onSnapChange,
}: {
    snap: SheetSnap;
    onSnapChange: (snap: SheetSnap) => void;
}) {
    const drag = useRef<{ y: number; moved: boolean } | null>(null);
    const skipClick = useRef(false);

    const onPointerDown = (event: PointerEvent<HTMLButtonElement>) => {
        drag.current = { y: event.clientY, moved: false };
        event.currentTarget.setPointerCapture?.(event.pointerId);
    };

    const onPointerUp = (event: PointerEvent<HTMLButtonElement>) => {
        const start = drag.current;
        drag.current = null;
        if (!start) return;
        const delta = start.y - event.clientY;
        if (Math.abs(delta) < DRAG_THRESHOLD) return;
        skipClick.current = true;
        onSnapChange(step(snap, delta > 0 ? 1 : -1));
    };

    const onClick = () => {
        if (skipClick.current) {
            skipClick.current = false;
            return;
        }
        onSnapChange(snap === "full" ? "collapsed" : step(snap, 1));
    };

    const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
        if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
        event.preventDefault();
        onSnapChange(step(snap, event.key === "ArrowUp" ? 1 : -1));
    };

    return (
        <button
            type="button"
            className="sheet-handle"
            aria-label={snap === "full" ? "Recolher painel" : "Expandir painel"}
            aria-expanded={snap !== "collapsed"}
            onPointerDown={onPointerDown}
            onPointerUp={onPointerUp}
            onPointerCancel={() => (drag.current = null)}
            onClick={onClick}
            onKeyDown={onKeyDown}
        >
            <span aria-hidden="true" />
        </button>
    );
}

export default function BottomSheet({
    snap,
    onSnapChange,
    tabs,
    tab,
    onTabChange,
    className,
    label,
    children,
}: {
    snap: SheetSnap;
    onSnapChange: (snap: SheetSnap) => void;
    tabs?: { id: string; label: string; disabled?: boolean }[];
    tab?: string;
    onTabChange?: (id: string) => void;
    className?: string;
    label?: string;
    children: ReactNode;
}) {
    const body = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (body.current) body.current.scrollTop = 0;
    }, [tab]);

    return (
        <Glass
            as="section"
            className={`bottom-sheet${className ? ` ${className}` : ""}`}
            data-snap={snap}
            aria-label={label}
        >
            <SheetHandle snap={snap} onSnapChange={onSnapChange} />
            {tabs && tabs.length > 0 && (
                <div className="sheet-tabs" role="tablist">
                    {tabs.map((t) => (
                        <button
                            key={t.id}
                            type="button"
                            role="tab"
                            aria-selected={t.id === tab}
                            disabled={t.disabled}
                            onClick={() => onTabChange?.(t.id)}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>
            )}
            <div ref={body} className="sheet-body">
                {children}
            </div>
        </Glass>
    );
}
