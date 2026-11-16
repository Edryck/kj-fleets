import type { Theme } from "../theme";

export interface MapPalette {
    background: string;
    earth: Record<string, number>;
    park: string;
    residential: string;
    wood: string;
    grass: string;
    landuse: string;
    sand: string;
    water: string;
    waterway: string;
    aeroway: string;
    building: string;
    casing: string;
    roadMajor: string;
    roadMid: string;
    roadMinor: string;
    roadService: string;
    rail: string;
    boundary: string;
    label: string;
    labelStrong: string;
    labelWater: string;
    halo: string;
    buildings: [string, string, string];
    buildingOpacity: number;
    hillshade: Record<string, string | number>;
    sky: Record<string, string | number>;
}

export const PALETTES: Record<Theme, MapPalette> = {
    dark: {
        background: "#13231a",
        earth: { "raster-opacity": 0.18, "raster-saturation": -0.5, "raster-brightness-max": 0.35 },
        park: "#183020",
        residential: "#1a2a20",
        wood: "#1b3d26",
        grass: "#18311f",
        landuse: "#1a2b21",
        sand: "#262e22",
        water: "#0a1a1f",
        waterway: "#1b4047",
        aeroway: "#1b2a22",
        building: "#1d2d23",
        casing: "#0e1913",
        roadMajor: "#5d7564",
        roadMid: "#3e5244",
        roadMinor: "#2c3b32",
        roadService: "#24322a",
        rail: "#2b3a31",
        boundary: "#3c5043",
        label: "#8ea394",
        labelStrong: "#c3d2c6",
        labelWater: "#4f7e85",
        halo: "#0d1712",
        buildings: ["#1f3027", "#2c4235", "#3d5848"],
        buildingOpacity: 0.94,
        hillshade: {
            "hillshade-shadow-color": "#040a07",
            "hillshade-highlight-color": "#3f6249",
            "hillshade-accent-color": "#0a150f",
            "hillshade-exaggeration": 0.6,
        },
        sky: {
            "sky-color": "#08130d",
            "horizon-color": "#22402e",
            "fog-color": "#13231a",
            "sky-horizon-blend": 0.7,
            "horizon-fog-blend": 0.75,
            "fog-ground-blend": 0.25,
            "atmosphere-blend": 0,
        },
    },
    light: {
        background: "#e4eadf",
        earth: { "raster-opacity": 0.25, "raster-saturation": -0.4, "raster-brightness-max": 1 },
        park: "#d0e1c4",
        residential: "#dce3d5",
        wood: "#c2d8b3",
        grass: "#d3e3c8",
        landuse: "#d8e1d0",
        sand: "#e7e3cf",
        water: "#b3d1d6",
        waterway: "#a6c8cd",
        aeroway: "#dde3d8",
        building: "#d3dccd",
        casing: "#c9d3c3",
        roadMajor: "#ffffff",
        roadMid: "#fbfcf9",
        roadMinor: "#f3f6f0",
        roadService: "#eef2ea",
        rail: "#c2cbbd",
        boundary: "#98a79b",
        label: "#526156",
        labelStrong: "#223027",
        labelWater: "#4d7d86",
        halo: "#eef3ea",
        buildings: ["#e9ede5", "#f6f8f3", "#ffffff"],
        buildingOpacity: 0.96,
        hillshade: {
            "hillshade-shadow-color": "#8b9e8f",
            "hillshade-highlight-color": "#ffffff",
            "hillshade-accent-color": "#b5c4b8",
            "hillshade-exaggeration": 0.5,
        },
        sky: {
            "sky-color": "#bcd3df",
            "horizon-color": "#eef3ea",
            "fog-color": "#e4eadf",
            "sky-horizon-blend": 0.7,
            "horizon-fog-blend": 0.75,
            "fog-ground-blend": 0.25,
            "atmosphere-blend": 0,
        },
    },
};
