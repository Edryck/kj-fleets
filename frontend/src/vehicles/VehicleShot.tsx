import type { CSSProperties, ReactNode } from "react";
import { colorHex, type VehicleLike } from "./catalog";
import { vehicleRender, type VehicleView } from "./vehicleRender";

export default function VehicleShot({
    vehicle,
    view,
    className,
    alt = "",
    eager = false,
    fallback = null,
}: {
    vehicle: VehicleLike | null | undefined;
    view: VehicleView;
    className?: string;
    alt?: string;
    eager?: boolean;
    fallback?: ReactNode;
}) {
    const render = vehicleRender(vehicle, view);
    if (!render) return <>{fallback}</>;
    const paint = colorHex(vehicle?.color);
    const style = paint ? ({ "--paint": paint } as CSSProperties) : undefined;
    const mask = `url("${render.paint}")`;
    return (
        <span className={`vehicle-shot${className ? ` ${className}` : ""}`} style={style}>
            <img
                src={render.src}
                width={render.width}
                height={render.height}
                alt={alt}
                loading={eager ? "eager" : "lazy"}
                decoding="async"
            />
            {paint && (
                <span
                    className="vehicle-shot-paint"
                    aria-hidden="true"
                    style={{ maskImage: mask, WebkitMaskImage: mask }}
                />
            )}
        </span>
    );
}
