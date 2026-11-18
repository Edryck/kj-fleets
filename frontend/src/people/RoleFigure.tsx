import { useState } from "react";
import { initials } from "../patterns/initials";
import { personFigure, type FigureVariant } from "./personFigure";

export default function RoleFigure({
    role,
    name,
    size = "md",
    variant = "bust",
    className,
}: {
    role: string | null | undefined;
    name: string;
    size?: "sm" | "md" | "lg";
    variant?: FigureVariant;
    className?: string;
}) {
    const [failed, setFailed] = useState(false);
    const src = failed ? null : personFigure(role, variant);
    const extra = className ? ` ${className}` : "";
    if (variant === "full") {
        if (!src) return null;
        return (
            <span className={`person-figure${extra}`} aria-hidden="true">
                <img src={src} alt="" decoding="async" onError={() => setFailed(true)} />
            </span>
        );
    }
    return (
        <span className={`avatar is-${size}${src ? " has-figure" : ""}${extra}`} aria-hidden="true">
            {initials(name)}
            {src && (
                <img
                    src={src}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    onError={() => setFailed(true)}
                />
            )}
        </span>
    );
}
