export type VehicleView = "34" | "side";

interface VehicleRender {
    src: string;
    width: number;
    height: number;
}

type VehicleKind = "truck" | "van";

const RENDERS: Record<VehicleKind, Record<VehicleView, VehicleRender>> = {
    truck: {
        "34": { src: "/renders/truck-34.webp", width: 960, height: 569 },
        side: { src: "/renders/truck-side.webp", width: 900, height: 410 },
    },
    van: {
        "34": { src: "/renders/van-34.webp", width: 960, height: 541 },
        side: { src: "/renders/van-side.webp", width: 874, height: 360 },
    },
};

function kindOf(type: string): VehicleKind | null {
    if (/caminh|truck/i.test(type)) return "truck";
    if (/van|furg|utilit/i.test(type)) return "van";
    return null;
}

export function vehicleRender(
    type: string | null | undefined,
    view: VehicleView,
): VehicleRender | null {
    const trimmed = type?.trim();
    if (!trimmed) return null;
    const kind = kindOf(trimmed);
    return kind ? RENDERS[kind][view] : null;
}
