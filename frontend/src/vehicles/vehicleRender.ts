import { findModel, type RenderKey, TYPE_DEFAULT, typeOf, type VehicleLike } from "./catalog";

export type VehicleView = "34" | "side";

export interface VehicleRenderInfo {
    key: RenderKey;
    src: string;
    paint: string;
    width: number;
    height: number;
}

const SIZES: Record<RenderKey, Record<VehicleView, [number, number]>> = {
    sprinter: { "34": [849, 530], side: [971, 439] },
    ducato: { "34": [842, 533], side: [971, 455] },
    fiorino: { "34": [867, 522], side: [971, 425] },
    kangoo: { "34": [878, 515], side: [971, 417] },
    delivery: { "34": [820, 540], side: [955, 490] },
    accelo: { "34": [797, 542], side: [906, 490] },
    constellation: { "34": [911, 542], side: [971, 409] },
    atego: { "34": [882, 542], side: [971, 433] },
    "cg-cargo": { "34": [589, 535], side: [694, 490] },
    biz: { "34": [586, 543], side: [653, 490] },
};

export function renderKey(vehicle: VehicleLike | null | undefined): RenderKey | null {
    if (!vehicle) return null;
    const model = findModel(vehicle.brand, vehicle.model);
    if (model) return model.key;
    const type = typeOf(vehicle.type);
    return type ? TYPE_DEFAULT[type] : null;
}

export function vehicleRender(
    vehicle: VehicleLike | null | undefined,
    view: VehicleView,
): VehicleRenderInfo | null {
    const key = renderKey(vehicle);
    if (!key) return null;
    const [width, height] = SIZES[key][view];
    return {
        key,
        src: `/renders/${key}-${view}.webp`,
        paint: `/renders/${key}-${view}-paint.webp`,
        width,
        height,
    };
}
