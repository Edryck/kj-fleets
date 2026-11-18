import { useSyncExternalStore } from "react";
import { viewportFor, type Viewport } from "./responsive";

const subscribe = (onChange: () => void) => {
    window.addEventListener("resize", onChange);
    return () => window.removeEventListener("resize", onChange);
};

const read = (): Viewport => viewportFor(window.innerWidth);

export function useViewport(): Viewport {
    return useSyncExternalStore(subscribe, read, () => "full");
}
