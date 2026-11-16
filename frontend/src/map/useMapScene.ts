import { useEffect, useRef } from "react";
import { clearScene, publishScene, type MapScene } from "./sceneStore";

export type { MapScene };

function signatureOf(scene: MapScene | null): string | null {
    if (!scene) return null;
    return JSON.stringify(
        {
            scene,
            clickable: Boolean(scene.onMarkerClick),
        },
        (_key, value: unknown) => (typeof value === "function" ? undefined : value),
    );
}

export function useMapScene(scene: MapScene | null): void {
    const owner = useRef<symbol | null>(null);
    owner.current ??= Symbol("scene");
    const latest = useRef(scene);
    latest.current = scene;
    const signature = signatureOf(scene);

    useEffect(() => {
        const id = owner.current!;
        const s = latest.current;
        if (!s) {
            clearScene(id);
            return;
        }
        publishScene(id, {
            ...s,
            onMarkerClick: s.onMarkerClick
                ? (markerId) => latest.current?.onMarkerClick?.(markerId)
                : undefined,
            pick: s.pick
                ? {
                      hint: s.pick.hint,
                      onPick: (lat, lng) => latest.current?.pick?.onPick(lat, lng),
                  }
                : null,
        });
    }, [signature]);

    useEffect(() => {
        const id = owner.current!;
        return () => clearScene(id);
    }, []);
}
