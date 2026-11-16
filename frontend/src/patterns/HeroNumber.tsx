import type { ReactNode } from "react";
import { useCountUp } from "../motion/useCountUp";

type HeroSize = "hero" | "large" | "stat";

export default function HeroNumber({
    label,
    value,
    decimals = 0,
    unit,
    caption,
    delta,
    size = "hero",
}: {
    label: string;
    value: number | null;
    decimals?: number;
    unit?: string;
    caption?: ReactNode;
    delta?: ReactNode;
    size?: HeroSize;
}) {
    const text = useCountUp(value, { decimals });
    return (
        <div className={`hero-number is-${size}`}>
            <span className="hero-number-label">{label}</span>
            <div className="hero-number-value">
                <span>{text}</span>
                {unit && value != null && <small>{unit}</small>}
            </div>
            {(caption || delta) && (
                <div className="hero-number-caption">
                    {caption && <span>{caption}</span>}
                    {delta}
                </div>
            )}
        </div>
    );
}
