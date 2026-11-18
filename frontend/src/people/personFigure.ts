export type FigureVariant = "bust" | "full";

const FIGURES: Record<string, string> = {
    ADMIN: "admin",
    DISPATCHER: "dispatcher",
    FLEET_MANAGER: "fleet-manager",
    DRIVER: "driver",
    CUSTOMER: "customer",
};

export function personFigure(
    role: string | null | undefined,
    variant: FigureVariant = "bust",
): string | null {
    const file = role ? FIGURES[role] : undefined;
    if (!file) return null;
    return `/people/${file}${variant === "bust" ? "-bust" : ""}.webp`;
}
