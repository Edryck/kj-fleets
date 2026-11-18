import type { SceneCamera } from "./camera";

export type Viewport = "full" | "compact" | "tablet" | "phone";

const MAX_PITCH: Record<Viewport, number> = { full: 90, compact: 90, tablet: 60, phone: 45 };

export function viewportFor(width: number): Viewport {
    if (width >= 1280) return "full";
    if (width >= 1024) return "compact";
    if (width >= 768) return "tablet";
    return "phone";
}

const cap = (pitch: number | undefined, max: number) =>
    pitch === undefined ? undefined : Math.min(pitch, max);

export function adaptCamera(camera: SceneCamera, viewport: Viewport): SceneCamera {
    if (viewport === "full" || viewport === "compact") return camera;
    const max = MAX_PITCH[viewport];
    const next: SceneCamera = { ...camera };
    if (camera.pitch !== undefined) next.pitch = cap(camera.pitch, max);
    if (camera.follow)
        next.follow = { ...camera.follow, pitch: Math.min(camera.follow.pitch, max) };
    if (viewport === "phone") {
        next.terrain = 0;
        next.intro = null;
    }
    return next;
}
