import { Marker, type Map as MapLibreMap } from "maplibre-gl";
import { prefersReducedMotion } from "../motion/reducedMotion";

export interface SceneMarker {
    id: string;
    lat: number;
    lng: number;
    kind:
        | "start"
        | "pickup"
        | "waypoint"
        | "dropoff"
        | "driver"
        | "order"
        | "hud"
        | "pill"
        | "vehicle";
    label?: string;
    title?: string;
    dimmed?: boolean;
    selected?: boolean;
    next?: boolean;
    stale?: boolean;
    status?: "AVAILABLE" | "BUSY" | "OFFLINE";
    hud?: { label: string; value: string; warn?: boolean };
    pill?: { text: string; estimated?: boolean };
}

export interface MarkerLayer {
    apply(list: SceneMarker[], clickable?: boolean): void;
    glideTo(id: string, lat: number, lng: number, ms?: number): void;
    clear(): void;
}

export function diffMarkers(
    current: ReadonlyMap<string, SceneMarker>,
    next: SceneMarker[],
): { add: SceneMarker[]; update: SceneMarker[]; remove: string[] } {
    const ids = new Set(next.map((m) => m.id));
    const add: SceneMarker[] = [];
    const update: SceneMarker[] = [];
    for (const marker of next) {
        const before = current.get(marker.id);
        if (!before) add.push(marker);
        else if (JSON.stringify(before) !== JSON.stringify(marker)) update.push(marker);
    }
    const remove = [...current.keys()].filter((id) => !ids.has(id));
    return { add, update, remove };
}

export function markerClassName(marker: SceneMarker, clickable: boolean): string {
    return [
        "maplibregl-marker",
        "map-marker",
        `map-marker-${marker.kind}`,
        marker.dimmed && "is-dimmed",
        marker.selected && "is-selected",
        marker.next && "is-next",
        marker.stale && "is-stale",
        clickable && "is-clickable",
    ]
        .filter(Boolean)
        .join(" ");
}

const SVG = "http://www.w3.org/2000/svg";
const TRUCK_PATHS = [
    "M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2",
    "M15 18H9",
    "M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14",
];

function truckIcon(): SVGSVGElement {
    const svg = document.createElementNS(SVG, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "2");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    svg.setAttribute("aria-hidden", "true");
    for (const d of TRUCK_PATHS) {
        const path = document.createElementNS(SVG, "path");
        path.setAttribute("d", d);
        svg.appendChild(path);
    }
    for (const cx of ["17", "7"]) {
        const circle = document.createElementNS(SVG, "circle");
        circle.setAttribute("cx", cx);
        circle.setAttribute("cy", "18");
        circle.setAttribute("r", "2");
        svg.appendChild(circle);
    }
    return svg;
}

function child(el: HTMLElement, tag: string, className: string): HTMLElement {
    const node = document.createElement(tag);
    node.className = className;
    el.appendChild(node);
    return node;
}

function build(el: HTMLElement, kind: SceneMarker["kind"]): void {
    el.replaceChildren();
    el.dataset.kind = kind;
    if (kind === "hud") {
        const box = child(el, "div", "hud-box");
        child(box, "span", "hud-k");
        child(box, "span", "hud-v");
        child(el, "div", "hud-stem");
    } else if (kind === "vehicle") {
        el.appendChild(truckIcon());
    } else if (kind !== "pill") {
        child(el, "span", "map-marker-label");
    }
}

export function renderMarker(el: HTMLElement, marker: SceneMarker): void {
    if (el.dataset.kind !== marker.kind) build(el, marker.kind);
    if (marker.kind === "hud") {
        el.querySelector(".hud-k")!.textContent = marker.hud?.label ?? "";
        el.querySelector(".hud-v")!.textContent = marker.hud?.value ?? "";
        el.classList.toggle("is-warn", Boolean(marker.hud?.warn));
    } else if (marker.kind === "pill") {
        el.textContent = marker.pill?.text ?? "";
        el.classList.toggle("is-estimated", Boolean(marker.pill?.estimated));
    } else if (marker.kind !== "vehicle") {
        el.querySelector(".map-marker-label")!.textContent = marker.label ?? "";
    }
    if (marker.status) el.dataset.status = marker.status;
    else delete el.dataset.status;
    if (marker.title) el.title = marker.title;
    else el.removeAttribute("title");
}

export function glidePosition(
    from: [number, number],
    to: [number, number],
    t: number,
): [number, number] {
    const e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
    return [from[0] + (to[0] - from[0]) * e, from[1] + (to[1] - from[1]) * e];
}

interface Item {
    marker: Marker;
    el: HTMLElement;
    data: SceneMarker;
    glide: number;
}

export function createMarkerLayer(map: MapLibreMap, onClick: (id: string) => void): MarkerLayer {
    const items = new Map<string, Item>();
    const data = new Map<string, SceneMarker>();
    let clickable = false;

    const stopGlide = (item: Item) => {
        if (item.glide) cancelAnimationFrame(item.glide);
        item.glide = 0;
    };

    const paint = (item: Item, marker: SceneMarker) => {
        item.el.className = markerClassName(marker, clickable && marker.kind !== "hud");
        renderMarker(item.el, marker);
    };

    const create = (marker: SceneMarker) => {
        const el = document.createElement("div");
        const id = marker.id;
        el.addEventListener("click", (event) => {
            if (!clickable) return;
            event.stopPropagation();
            onClick(id);
        });
        const item: Item = {
            el,
            data: marker,
            glide: 0,
            marker: new Marker({ element: el, anchor: marker.kind === "hud" ? "bottom" : "center" })
                .setLngLat([marker.lng, marker.lat])
                .addTo(map),
        };
        items.set(id, item);
        paint(item, marker);
        el.classList.add("is-entering");
        requestAnimationFrame(() =>
            requestAnimationFrame(() => el.classList.remove("is-entering")),
        );
    };

    return {
        apply(list, nextClickable = false) {
            const clickChanged = nextClickable !== clickable;
            clickable = nextClickable;
            const { add, update, remove } = diffMarkers(data, list);
            for (const id of remove) {
                const item = items.get(id);
                if (item) {
                    stopGlide(item);
                    item.marker.remove();
                }
                items.delete(id);
                data.delete(id);
            }
            for (const marker of update) {
                const item = items.get(marker.id)!;
                if (item.data.lat !== marker.lat || item.data.lng !== marker.lng) {
                    stopGlide(item);
                    item.marker.setLngLat([marker.lng, marker.lat]);
                }
                item.data = marker;
                data.set(marker.id, marker);
                paint(item, marker);
            }
            for (const marker of add) {
                create(marker);
                data.set(marker.id, marker);
            }
            if (clickChanged) items.forEach((item) => paint(item, item.data));
        },
        glideTo(id, lat, lng, ms = 600) {
            const item = items.get(id);
            if (!item) return;
            stopGlide(item);
            item.data = { ...item.data, lat, lng };
            data.set(id, item.data);
            if (prefersReducedMotion() || ms <= 0) {
                item.marker.setLngLat([lng, lat]);
                return;
            }
            const start = item.marker.getLngLat();
            const from: [number, number] = [start.lat, start.lng];
            const to: [number, number] = [lat, lng];
            const t0 = performance.now();
            const tick = (now: number) => {
                const t = Math.min(1, (now - t0) / ms);
                const [la, ln] = glidePosition(from, to, t);
                item.marker.setLngLat([ln, la]);
                item.glide = t < 1 ? requestAnimationFrame(tick) : 0;
            };
            item.glide = requestAnimationFrame(tick);
        },
        clear() {
            items.forEach((item) => {
                stopGlide(item);
                item.marker.remove();
            });
            items.clear();
            data.clear();
        },
    };
}
