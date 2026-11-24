import type { LayerSpecification, SkySpecification, StyleSpecification } from "maplibre-gl";
import type { Theme } from "../theme";
import { PALETTES, type MapPalette } from "./palettes";
import southStates from "./southStates.json";

export { PALETTES, type MapPalette };

export const DEM_URL = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png";
export const LIBERTY_URL = "https://tiles.openfreemap.org/styles/liberty";

type Paint = Record<string, unknown>;
type MutableLayer = LayerSpecification & {
    paint?: Paint;
    layout?: Record<string, unknown>;
    "source-layer"?: string;
};

function hidden(id: string): boolean {
    return (
        id === "park_outline" ||
        id === "landcover_wetland" ||
        id === "road_area_pattern" ||
        id === "airport" ||
        id.includes("hatching") ||
        id.startsWith("road_one_way") ||
        id.startsWith("poi") ||
        id.includes("shield") ||
        id.includes("path_pedestrian") ||
        id.startsWith("highway-name-path")
    );
}

function roadColor(id: string, p: MapPalette): string {
    if (id.includes("casing")) return p.casing;
    if (/rail/.test(id)) return p.rail;
    if (/motorway|trunk_primary/.test(id)) return p.roadMajor;
    if (/secondary_tertiary|link/.test(id)) return p.roadMid;
    if (/service_track/.test(id)) return p.roadService;
    return p.roadMinor;
}

function paintLayer(layer: MutableLayer, p: MapPalette): void {
    const { id, type } = layer;
    const sourceLayer = layer["source-layer"];
    const paint: Paint = { ...(layer.paint ?? {}) };
    const set = (key: string, value: unknown) => {
        paint[key] = value;
    };
    if (type === "background") set("background-color", p.background);
    else if (type === "raster") Object.entries(p.earth).forEach(([k, v]) => set(k, v));
    else if (id === "park") {
        set("fill-color", p.park);
        set("fill-outline-color", p.park);
        set("fill-opacity", 0.9);
    } else if (id === "landuse_residential") {
        set("fill-color", p.residential);
        set("fill-opacity", 0.8);
    } else if (id === "landcover_wood") {
        set("fill-color", p.wood);
        set("fill-opacity", 0.95);
    } else if (id === "landcover_grass") {
        set("fill-color", p.grass);
        set("fill-opacity", 0.8);
    } else if (id === "landcover_sand" || id === "landcover_ice") set("fill-color", p.sand);
    else if (id.startsWith("landuse_")) set("fill-color", p.landuse);
    else if (id === "water") set("fill-color", p.water);
    else if (sourceLayer === "waterway" && type === "line") set("line-color", p.waterway);
    else if (sourceLayer === "aeroway")
        set(
            type === "fill" ? "fill-color" : "line-color",
            type === "fill" ? p.aeroway : p.roadMinor,
        );
    else if (id === "building") {
        set("fill-color", p.building);
        set("fill-outline-color", p.building);
    } else if (id === "building-3d") {
        set("fill-extrusion-color", [
            "interpolate",
            ["linear"],
            ["coalesce", ["get", "render_height"], 0],
            0,
            p.buildings[0],
            25,
            p.buildings[1],
            70,
            p.buildings[2],
        ]);
        set("fill-extrusion-opacity", p.buildingOpacity);
        set("fill-extrusion-vertical-gradient", true);
        layer.layout = { ...(layer.layout ?? {}), visibility: "visible" };
    } else if (sourceLayer === "transportation" && type === "line")
        set("line-color", roadColor(id, p));
    else if (sourceLayer === "boundary") set("line-color", p.boundary);
    else if (type === "symbol") {
        const strong = /city|state|country/.test(id);
        set("text-color", /water/.test(id) ? p.labelWater : strong ? p.labelStrong : p.label);
        set("text-halo-color", p.halo);
        set("text-halo-width", 1.4);
        set("text-halo-blur", 0.5);
    }
    layer.paint = paint;
}

export function transformStyle(base: StyleSpecification, theme: Theme): StyleSpecification {
    const p = PALETTES[theme];
    const style = structuredClone(base);
    for (const layer of style.layers as MutableLayer[]) {
        if (hidden(layer.id)) {
            layer.layout = { ...(layer.layout ?? {}), visibility: "none" };
            continue;
        }
        paintLayer(layer, p);
    }
    const dem = {
        type: "raster-dem" as const,
        tiles: [DEM_URL],
        tileSize: 256,
        maxzoom: 13,
        encoding: "terrarium" as const,
    };
    style.sources.dem = { ...dem, attribution: "Terrain: Mapzen / AWS Terrain Tiles" };
    style.sources["dem-shade"] = { ...dem };
    const at = style.layers.findIndex((l) => l.id === "water");
    style.layers.splice(at < 0 ? 1 : at, 0, {
        id: "relief",
        type: "hillshade",
        source: "dem-shade",
        paint: { ...p.hillshade, "hillshade-illumination-direction": 315 },
    } as LayerSpecification);
    // fora de PR, SC e RS fica só o fundo liso: a operação e o grafo de vias são só do Sul.
    // A máscara (malha do IBGE com ~6 km de folga na costa) vem por cima de tudo do mapa base;
    // as camadas kj- (rotas, arcos) entram depois e ficam acima dela
    style.sources["south-mask"] = { type: "geojson", data: southStates as never };
    style.layers.push(
        {
            id: "south-mask",
            type: "fill",
            source: "south-mask",
            filter: ["==", ["get", "kind"], "mask"],
            paint: { "fill-color": p.background, "fill-opacity": 1, "fill-antialias": false },
        } as LayerSpecification,
        {
            id: "south-borders",
            type: "line",
            source: "south-mask",
            filter: ["==", ["get", "kind"], "border"],
            paint: { "line-color": p.boundary, "line-width": 1.2, "line-opacity": 0.9 },
        } as LayerSpecification,
    );
    style.sky = p.sky as SkySpecification;
    return style;
}

let basePromise: Promise<StyleSpecification> | null = null;
const themed = new Map<Theme, StyleSpecification>();

export function loadStyle(theme: Theme): Promise<StyleSpecification> {
    const cached = themed.get(theme);
    if (cached) return Promise.resolve(cached);
    basePromise ??= fetch(LIBERTY_URL).then((r) => {
        if (!r.ok) throw new Error(`style ${r.status}`);
        return r.json() as Promise<StyleSpecification>;
    });
    const pending = basePromise;
    return pending.then(
        (base) => {
            const style = transformStyle(base, theme);
            themed.set(theme, style);
            return style;
        },
        (error: unknown) => {
            if (basePromise === pending) basePromise = null;
            throw error;
        },
    );
}
