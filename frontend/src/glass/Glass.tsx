import {
    createContext,
    useContext,
    useEffect,
    useRef,
    type ComponentPropsWithoutRef,
    type ElementType,
    type ReactNode,
} from "react";
import { glassFilter, refracts } from "./glassRegistry";
import type { GlassVariant } from "./liquidGlass";

export const GlassContext = createContext(false);

type GlassProps<T extends ElementType> = {
    as?: T;
    variant?: GlassVariant;
    press?: boolean;
    className?: string;
    children?: ReactNode;
} & Omit<ComponentPropsWithoutRef<T>, "as" | "className" | "children">;

const NESTED_WARNING = "Glass dentro de Glass renderiza chapado";
const SETTLE_MS = 160;

function useRefraction(
    ref: React.RefObject<HTMLElement | null>,
    variant: GlassVariant,
    enabled: boolean,
) {
    useEffect(() => {
        const el = ref.current;
        if (!el || !enabled || !refracts || typeof ResizeObserver === "undefined") return;
        let frame = 0;
        let settle = 0;
        let measured = false;
        const apply = () => {
            frame = 0;
            measured = true;
            const width = Math.round(el.offsetWidth);
            const height = Math.round(el.offsetHeight);
            if (width < 4 || height < 4) return;
            const corner = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0;
            const value = glassFilter(
                variant,
                width,
                height,
                Math.min(corner, width / 2, height / 2),
            );
            if (value) el.style.setProperty("--glass-filter", value);
            else el.style.removeProperty("--glass-filter");
        };
        const observer = new ResizeObserver(() => {
            if (!measured) {
                if (!frame) frame = requestAnimationFrame(apply);
                return;
            }
            window.clearTimeout(settle);
            settle = window.setTimeout(apply, SETTLE_MS);
        });
        observer.observe(el);
        return () => {
            observer.disconnect();
            if (frame) cancelAnimationFrame(frame);
            window.clearTimeout(settle);
        };
    }, [ref, variant, enabled]);
}

function usePointerLight(ref: React.RefObject<HTMLElement | null>, enabled: boolean) {
    useEffect(() => {
        const el = ref.current;
        if (!el || !enabled) return;
        const move = (event: PointerEvent) => {
            const box = el.getBoundingClientRect();
            el.style.setProperty("--mx", `${event.clientX - box.left}px`);
            el.style.setProperty("--my", `${event.clientY - box.top}px`);
        };
        const leave = () => {
            el.style.removeProperty("--mx");
            el.style.removeProperty("--my");
        };
        el.addEventListener("pointermove", move);
        el.addEventListener("pointerleave", leave);
        return () => {
            el.removeEventListener("pointermove", move);
            el.removeEventListener("pointerleave", leave);
        };
    }, [ref, enabled]);
}

export default function Glass<T extends ElementType = "div">({
    as,
    variant = "regular",
    press = false,
    className,
    children,
    ...rest
}: GlassProps<T>) {
    const nested = useContext(GlassContext);
    const ref = useRef<HTMLElement>(null);
    const Tag: ElementType = as ?? "div";

    useEffect(() => {
        if (nested && import.meta.env.DEV) console.warn(NESTED_WARNING);
    }, [nested]);
    useRefraction(ref, variant, !nested);
    usePointerLight(ref, !nested);

    const classes = [
        nested ? "glass-flat" : `glass glass-${variant}`,
        press ? "glass-press" : "",
        className ?? "",
    ]
        .filter(Boolean)
        .join(" ");

    return (
        <Tag ref={ref} data-glass={nested ? "flat" : variant} className={classes} {...rest}>
            <GlassContext.Provider value={true}>{children}</GlassContext.Provider>
        </Tag>
    );
}
