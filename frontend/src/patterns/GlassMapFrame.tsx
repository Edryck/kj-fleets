import MapView, { type MapViewProps } from "../components/MapView";
import Glass from "../glass/Glass";

export function GlassMapFrame({ className, ...props }: MapViewProps & { className?: string }) {
    return (
        <Glass className={`glass-map-frame${className ? ` ${className}` : ""}`}>
            <MapView {...props} className="is-framed" />
        </Glass>
    );
}

export default GlassMapFrame;
