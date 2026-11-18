import {
    GLASS,
    bezelFor,
    displacementScale,
    filterKey,
    glassPixels,
    mapScale,
    mapSize,
    refractionProfile,
    type GlassVariant,
} from "./liquidGlass";

const SVG_NS = "http://www.w3.org/2000/svg";
const REFRACT_CLASS = "glass-refract";

type BrandedNavigator = Navigator & { userAgentData?: { brands?: { brand: string }[] } };

function detectRefraction(): boolean {
    if (typeof navigator === "undefined") return false;
    const brands = (navigator as BrandedNavigator).userAgentData?.brands;
    return !!brands?.some((entry) => /Chromium/.test(entry.brand));
}

export const refracts = detectRefraction();

let defs: SVGSVGElement | null = null;
let sequence = 0;
const filters = new Map<string, string>();

export function mountGlassDefs(svg: SVGSVGElement | null): void {
    if (svg === defs) return;
    defs = svg;
    filters.clear();
    if (svg && refracts) document.documentElement.classList.add(REFRACT_CLASS);
    if (!svg) document.documentElement.classList.remove(REFRACT_CLASS);
}

function toDataUrl(pixels: Uint8ClampedArray, width: number, height: number): string {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return "";
    const image = context.createImageData(width, height);
    image.data.set(pixels);
    context.putImageData(image, 0, 0);
    return canvas.toDataURL();
}

function filterChain(
    width: number,
    height: number,
    displacement: string,
    specular: string,
    scale: number,
    saturation: number,
    opacity: number,
): string {
    const frame = `x="0" y="0" width="${width}" height="${height}" preserveAspectRatio="none"`;
    return (
        `<feImage href="${displacement}" ${frame} result="dmap"/>` +
        `<feDisplacementMap in="SourceGraphic" in2="dmap" scale="${scale.toFixed(2)}" xChannelSelector="R" yChannelSelector="G" result="refracted"/>` +
        `<feImage href="${specular}" ${frame} result="smap"/>` +
        `<feColorMatrix in="refracted" type="saturate" values="${saturation}" result="ssat"/>` +
        `<feComposite in="ssat" in2="smap" operator="in" result="scolor"/>` +
        `<feBlend in="scolor" in2="refracted" mode="screen" result="lit"/>` +
        `<feComponentTransfer in="smap" result="swhite"><feFuncA type="linear" slope="${opacity * 0.55}"/></feComponentTransfer>` +
        `<feBlend in="swhite" in2="lit" mode="screen"/>`
    );
}

export function glassFilter(
    variant: GlassVariant,
    width: number,
    height: number,
    radius: number,
): string | null {
    if (!refracts || !defs) return null;
    const key = filterKey(variant, width, height, radius);
    const cached = filters.get(key);
    if (cached) return cached;
    const config = GLASS[variant];
    const bezel = bezelFor(width, height, config);
    const profile = refractionProfile(bezel, config.thickness);
    const pixels = glassPixels(
        width,
        height,
        Math.round(radius),
        bezel,
        profile.magnitudes,
        config.light,
        mapScale(width, height),
    );
    const [mapWidth, mapHeight] = mapSize(width, height);
    const id = `kj-glass-${++sequence}`;
    const filter = document.createElementNS(SVG_NS, "filter");
    filter.id = id;
    filter.setAttribute("filterUnits", "userSpaceOnUse");
    filter.setAttribute("primitiveUnits", "userSpaceOnUse");
    filter.setAttribute("x", "0");
    filter.setAttribute("y", "0");
    filter.setAttribute("width", String(width));
    filter.setAttribute("height", String(height));
    filter.setAttribute("color-interpolation-filters", "sRGB");
    filter.innerHTML = filterChain(
        width,
        height,
        toDataUrl(pixels.displacement, mapWidth, mapHeight),
        toDataUrl(pixels.specular, mapWidth, mapHeight),
        displacementScale(profile.max, config.refraction),
        config.specSaturation,
        config.specOpacity,
    );
    defs.appendChild(filter);
    const value = `blur(${config.blur}px) saturate(1.5) url(#${id})`;
    filters.set(key, value);
    return value;
}
