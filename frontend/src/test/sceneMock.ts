import type { MapScene } from "../map/sceneStore";

const scenes: MapScene[] = [];

export function useMapScene(scene: MapScene | null): void {
    if (scene) scenes.push(scene);
}

export function lastScene(): MapScene {
    const scene = scenes.at(-1);
    if (!scene) throw new Error("Nenhuma cena foi publicada");
    return scene;
}

export function lastSceneOrNull(): MapScene | null {
    return scenes.at(-1) ?? null;
}

export function resetScenes(): void {
    scenes.length = 0;
}
