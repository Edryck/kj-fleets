import { useSyncExternalStore } from "react";
import type { MapLeg } from "../components/RouteLegs";
import type { SceneCamera } from "./camera";
import type { SceneArc } from "./mapLayers";
import type { SceneMarker } from "./markers";

export interface MapScene {
    markers: SceneMarker[];
    legs?: MapLeg[];
    animateLegs?: boolean;
    arcs?: SceneArc[];
    comets?: number;
    camera?: SceneCamera;
    pick?: { hint: string; onPick: (lat: number, lng: number) => void } | null;
    onMarkerClick?: (id: string) => void;
}

export interface SceneEntry {
    owner: symbol;
    scene: MapScene;
}

export type FollowState = "following" | "suspended";

let entry: SceneEntry | null = null;
let follow: FollowState = "following";
const sceneListeners = new Set<() => void>();
const followListeners = new Set<() => void>();

const notify = (listeners: Set<() => void>) => listeners.forEach((listener) => listener());

export function setFollowState(state: FollowState): void {
    if (state === follow) return;
    follow = state;
    notify(followListeners);
}

export function publishScene(owner: symbol, scene: MapScene): void {
    if (entry?.owner !== owner) setFollowState("following");
    entry = { owner, scene };
    notify(sceneListeners);
}

export function clearScene(owner: symbol): void {
    if (entry?.owner !== owner) return;
    entry = null;
    notify(sceneListeners);
}

export function getScene(): SceneEntry | null {
    return entry;
}

export function subscribeScene(listener: () => void): () => void {
    sceneListeners.add(listener);
    return () => sceneListeners.delete(listener);
}

export function getFollowState(): FollowState {
    return follow;
}

export function subscribeFollow(listener: () => void): () => void {
    followListeners.add(listener);
    return () => followListeners.delete(listener);
}

export function useFollowState(): FollowState {
    return useSyncExternalStore(subscribeFollow, getFollowState, getFollowState);
}

export type MapCommand = "zoomIn" | "zoomOut" | "fitAll";

const commandListeners = new Set<(command: MapCommand) => void>();

export function sendMapCommand(command: MapCommand): void {
    commandListeners.forEach((listener) => listener(command));
}

export function subscribeMapCommand(listener: (command: MapCommand) => void): () => void {
    commandListeners.add(listener);
    return () => {
        commandListeners.delete(listener);
    };
}
