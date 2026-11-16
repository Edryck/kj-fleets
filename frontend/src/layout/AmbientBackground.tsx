import { contourPaths } from "./contours";

const PATHS = contourPaths();

export default function AmbientBackground({ visible }: { visible: boolean }) {
    return (
        <div className={`ambient${visible ? " is-on" : ""}`} aria-hidden="true">
            <svg viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice">
                {PATHS.map((d, index) => (
                    <path key={index} d={d} />
                ))}
            </svg>
        </div>
    );
}
