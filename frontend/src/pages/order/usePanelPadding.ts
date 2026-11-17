import { useLayoutEffect, useState, type RefObject } from "react";
import type { Padding } from "../../map/camera";

const STEP = 24;
const PANELS = ".order-side, .order-right, .order-strip";
const GAP = 40;

const snap = (value: number) => Math.max(0, Math.round(value / STEP) * STEP);

export function fallbackPadding(width: number, height: number): Padding {
    if (width < 768) return { top: 120, bottom: Math.round(height * 0.55), left: 24, right: 24 };
    if (width < 1280) return { top: 120, bottom: 216, left: 432, right: 48 };
    return { top: 120, bottom: 192, left: 480, right: 408 };
}

function rectOf(root: HTMLElement, selector: string): DOMRect | null {
    const rect = root.querySelector(selector)?.getBoundingClientRect();
    return rect && rect.width > 0 && rect.height > 0 ? rect : null;
}

export function measurePadding(root: HTMLElement, width: number, height: number): Padding {
    const base = fallbackPadding(width, height);
    if (width < 768) return base;
    const side = rectOf(root, ".order-side");
    const right = rectOf(root, ".order-right");
    const strip = rectOf(root, ".order-strip");
    const detached = right && (!side || right.left > side.right);
    return {
        top: base.top,
        left: side ? snap(side.right + GAP) : base.left,
        right: detached ? snap(width - right.left + GAP) : base.right,
        bottom: strip ? snap(height - strip.top + GAP) : base.bottom,
    };
}

const same = (a: Padding, b: Padding) =>
    a.top === b.top && a.bottom === b.bottom && a.left === b.left && a.right === b.right;

export function usePanelPadding(rootRef: RefObject<HTMLElement | null>): Padding {
    const [padding, setPadding] = useState<Padding>(() =>
        fallbackPadding(window.innerWidth, window.innerHeight),
    );

    useLayoutEffect(() => {
        const root = rootRef.current;
        if (!root) return;
        const title = document.querySelector(".title-block");
        const update = () => {
            const strip = rectOf(root, ".order-strip");
            if (strip) root.style.setProperty("--strip-h", `${Math.round(strip.height)}px`);
            const head = title?.getBoundingClientRect();
            if (head && head.height > 0)
                root.style.setProperty("--order-top", `${Math.round(head.bottom)}px`);
            const next = measurePadding(root, window.innerWidth, window.innerHeight);
            setPadding((current) => (same(current, next) ? current : next));
        };
        update();
        window.addEventListener("resize", update);
        if (typeof ResizeObserver === "undefined")
            return () => window.removeEventListener("resize", update);
        const observer = new ResizeObserver(update);
        const watch = () => {
            observer.disconnect();
            root.querySelectorAll(PANELS).forEach((el) => observer.observe(el));
            if (title) observer.observe(title);
        };
        watch();
        const swaps = new MutationObserver(() => {
            watch();
            update();
        });
        swaps.observe(root, { childList: true });
        return () => {
            swaps.disconnect();
            observer.disconnect();
            window.removeEventListener("resize", update);
        };
    }, [rootRef]);

    return padding;
}
