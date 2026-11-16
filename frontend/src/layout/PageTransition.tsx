import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { useLocation, useOutlet } from "react-router-dom";
import { prefersReducedMotion } from "../motion/reducedMotion";

export const LEAVE_MS = 220;

type Phase = "entering" | "leaving";

export default function PageTransition() {
    const { pathname } = useLocation();
    const outlet = useOutlet();
    const [shown, setShown] = useState(pathname);
    const [phase, setPhase] = useState<Phase>("entering");
    const lastOutlet = useRef<ReactNode>(outlet);
    const main = useRef<HTMLElement>(null);
    const current = shown === pathname;

    if (current) lastOutlet.current = outlet;

    useEffect(() => {
        if (shown === pathname) return;
        if (prefersReducedMotion()) {
            setShown(pathname);
            setPhase("entering");
            return;
        }
        setPhase("leaving");
        const timer = window.setTimeout(() => {
            setShown(pathname);
            setPhase("entering");
        }, LEAVE_MS);
        return () => window.clearTimeout(timer);
    }, [pathname, shown]);

    useLayoutEffect(() => {
        if (phase !== "entering" || !main.current) return;
        main.current.querySelectorAll<HTMLElement>(".glass").forEach((el, index) => {
            el.style.setProperty("--i", String(index));
        });
    }, [phase, shown]);

    return (
        <main ref={main} className="stage-content" data-phase={current ? phase : "leaving"}>
            {current ? outlet : lastOutlet.current}
        </main>
    );
}
