import { useEffect, useRef, useState } from "react";
import { prefersReducedMotion } from "./reducedMotion";

const FIRST_DURATION = 1400;
const CHANGE_DURATION = 600;
const EMPTY = "—";

interface CountUpOptions {
    duration?: number;
    delay?: number;
    decimals?: number;
}

const settleExpo = (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));
const settleCubic = (t: number) => 1 - Math.pow(1 - t, 3);

function format(value: number, decimals: number): string {
    return value.toLocaleString("pt-BR", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    });
}

export function useCountUp(
    target: number | null | undefined,
    options: CountUpOptions = {},
): string {
    const { duration = FIRST_DURATION, delay = 0, decimals = 0 } = options;
    const [shown, setShown] = useState<number>(() =>
        target != null && prefersReducedMotion() ? target : 0,
    );
    const shownRef = useRef(shown);
    const settled = useRef<number | null>(null);

    useEffect(() => {
        if (target == null) {
            settled.current = null;
            return;
        }
        const show = (value: number) => {
            shownRef.current = value;
            setShown(value);
        };
        if (prefersReducedMotion()) {
            settled.current = target;
            show(target);
            return;
        }
        const first = settled.current === null;
        const from = first ? 0 : shownRef.current;
        const span = first ? duration : CHANGE_DURATION;
        const ease = first ? settleExpo : settleCubic;
        const start = performance.now() + (first ? delay : 0);
        settled.current = target;
        let frame = requestAnimationFrame(function tick() {
            const t = Math.min(1, Math.max(0, (performance.now() - start) / span));
            show(from + (target - from) * ease(t));
            if (t < 1) frame = requestAnimationFrame(tick);
        });
        return () => cancelAnimationFrame(frame);
    }, [target, duration, delay]);

    if (target == null) return EMPTY;
    return format(shown, decimals);
}
