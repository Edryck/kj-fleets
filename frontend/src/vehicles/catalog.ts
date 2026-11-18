export const VEHICLE_TYPES = ["Van", "Furgão", "Caminhão leve", "Caminhão", "Moto"] as const;

export type VehicleType = (typeof VEHICLE_TYPES)[number];

export type RenderKey =
    | "sprinter"
    | "ducato"
    | "fiorino"
    | "kangoo"
    | "delivery"
    | "accelo"
    | "constellation"
    | "atego"
    | "cg-cargo"
    | "biz";

export interface VehicleModel {
    key: RenderKey;
    brand: string;
    model: string;
    type: VehicleType;
    match: string;
}

export const VEHICLE_MODELS: VehicleModel[] = [
    { key: "sprinter", brand: "Mercedes-Benz", model: "Sprinter", type: "Van", match: "sprinter" },
    { key: "ducato", brand: "Fiat", model: "Ducato", type: "Van", match: "ducato" },
    { key: "fiorino", brand: "Fiat", model: "Fiorino", type: "Furgão", match: "fiorino" },
    { key: "kangoo", brand: "Renault", model: "Kangoo", type: "Furgão", match: "kangoo" },
    {
        key: "delivery",
        brand: "Volkswagen",
        model: "Delivery",
        type: "Caminhão leve",
        match: "delivery",
    },
    {
        key: "accelo",
        brand: "Mercedes-Benz",
        model: "Accelo",
        type: "Caminhão leve",
        match: "accelo",
    },
    {
        key: "constellation",
        brand: "Volkswagen",
        model: "Constellation",
        type: "Caminhão",
        match: "constellation",
    },
    { key: "atego", brand: "Mercedes-Benz", model: "Atego", type: "Caminhão", match: "atego" },
    { key: "cg-cargo", brand: "Honda", model: "CG 160 Cargo", type: "Moto", match: "cg" },
    { key: "biz", brand: "Honda", model: "Biz 125", type: "Moto", match: "biz" },
];

export const TYPE_DEFAULT: Record<VehicleType, RenderKey> = {
    Van: "sprinter",
    Furgão: "fiorino",
    "Caminhão leve": "delivery",
    Caminhão: "constellation",
    Moto: "cg-cargo",
};

export const VEHICLE_COLORS: { name: string; hex: string | null }[] = [
    { name: "Branco", hex: null },
    { name: "Prata", hex: "#c9cdd0" },
    { name: "Cinza", hex: "#878d93" },
    { name: "Preto", hex: "#3a3d40" },
    { name: "Vermelho", hex: "#c4362f" },
    { name: "Azul", hex: "#2f5fa8" },
    { name: "Amarelo", hex: "#e8c22a" },
    { name: "Verde", hex: "#2f7d4a" },
    { name: "Laranja", hex: "#e2742a" },
];

export const fold = (value: string | null | undefined) =>
    (value ?? "")
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim();

export function findModel(
    brand: string | null | undefined,
    model: string | null | undefined,
): VehicleModel | null {
    const words = ` ${fold(`${brand ?? ""} ${model ?? ""}`)} `;
    if (words.trim() === "") return null;
    return VEHICLE_MODELS.find((entry) => words.includes(` ${entry.match} `)) ?? null;
}

export function typeOf(type: string | null | undefined): VehicleType | null {
    const value = fold(type);
    if (!value) return null;
    if (/\bmoto/.test(value)) return "Moto";
    if (/caminh\w* leve|\bvuc\b|\b3 4\b|light truck/.test(value)) return "Caminhão leve";
    if (/caminh|truck/.test(value)) return "Caminhão";
    if (/furg|utilit/.test(value)) return "Furgão";
    if (/\bvan\b/.test(value)) return "Van";
    return null;
}

const WHITE_SWATCH = "#f2f3ef";

export function colorHex(name: string | null | undefined): string | null {
    const key = fold(name);
    return VEHICLE_COLORS.find((color) => fold(color.name) === key)?.hex ?? null;
}

export function colorSwatch(name: string | null | undefined): string | null {
    const key = fold(name);
    const color = VEHICLE_COLORS.find((entry) => fold(entry.name) === key);
    if (!color) return null;
    return color.hex ?? WHITE_SWATCH;
}

export interface VehicleLike {
    type?: string | null;
    brand?: string | null;
    model?: string | null;
    color?: string | null;
}

export function vehicleName(vehicle: VehicleLike): string {
    const name = [vehicle.brand?.trim(), vehicle.model?.trim()].filter(Boolean).join(" ");
    return name || vehicle.type?.trim() || "Veículo";
}
