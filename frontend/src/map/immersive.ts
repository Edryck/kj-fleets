import type { Role } from "../api/types";

const STAFF_IMMERSIVE = [
    /^\/dashboard(\/(dispatch|fleet))?\/?$/,
    /^\/map\/?$/,
    /^\/dispatch\/?$/,
    /^\/routes\/optimize\/?$/,
    /^\/orders\/(?!new\/?$)[^/]+\/?$/,
];

export function isImmersive(pathname: string, role: Role): boolean {
    if (role === "CUSTOMER" || role === "DRIVER") return false;
    return STAFF_IMMERSIVE.some((pattern) => pattern.test(pathname));
}
