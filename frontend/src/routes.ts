import {
    ChartNoAxesCombined,
    Boxes,
    LayoutDashboard,
    Map as MapIcon,
    MapPin,
    Network,
    Package,
    PackagePlus,
    PiggyBank,
    Route as RouteIcon,
    Send,
    Truck,
    TriangleAlert,
    UserRound,
    Users,
    type LucideIcon,
} from "lucide-react";
import type { Role } from "./api/types";

export type NavGroup = "Operação" | "Cadastros" | "Análise" | "Administração";

export interface AppRoute {
    path: string;
    title: string;
    roles: Role[];
    nav?: { group: NavGroup; label: string; icon: LucideIcon };
}

const ALL: Role[] = ["ADMIN", "DISPATCHER", "FLEET_MANAGER", "CUSTOMER"];
const STAFF: Role[] = ["ADMIN", "DISPATCHER", "FLEET_MANAGER"];

// fonte única das rotas protegidas (inventário §1.1 e §1.3, mais S27 e S28); a sidebar sai daqui
export const APP_ROUTES: AppRoute[] = [
    {
        path: "/dashboard",
        title: "Dashboard",
        roles: ALL,
        nav: { group: "Operação", label: "Dashboard", icon: LayoutDashboard },
    },
    { path: "/dashboard/dispatch", title: "Central de despacho", roles: ["ADMIN"] },
    { path: "/dashboard/fleet", title: "Gestão de frota", roles: ["ADMIN"] },
    {
        path: "/map",
        title: "Mapa ao vivo",
        roles: STAFF,
        nav: { group: "Operação", label: "Mapa ao vivo", icon: MapIcon },
    },
    {
        path: "/orders",
        title: "Pedidos",
        roles: ALL,
        nav: { group: "Operação", label: "Pedidos", icon: Package },
    },
    {
        path: "/orders/new",
        title: "Novo pedido",
        roles: ["ADMIN", "DISPATCHER", "CUSTOMER"],
        nav: { group: "Operação", label: "Novo pedido", icon: PackagePlus },
    },
    { path: "/orders/:id", title: "Pedido", roles: ALL },
    {
        path: "/dispatch",
        title: "Despacho",
        roles: ["ADMIN", "DISPATCHER"],
        nav: { group: "Operação", label: "Despacho", icon: Send },
    },
    {
        path: "/drivers",
        title: "Motoristas",
        roles: STAFF,
        nav: { group: "Cadastros", label: "Motoristas", icon: Users },
    },
    { path: "/drivers/:id", title: "Motorista", roles: STAFF },
    {
        path: "/vehicles",
        title: "Veículos",
        roles: STAFF,
        nav: { group: "Cadastros", label: "Veículos", icon: Truck },
    },
    {
        path: "/fleets",
        title: "Frotas",
        roles: STAFF,
        nav: { group: "Cadastros", label: "Frotas", icon: Boxes },
    },
    { path: "/fleets/:id", title: "Frota", roles: STAFF },
    {
        path: "/places",
        title: "Lugares",
        roles: STAFF,
        nav: { group: "Cadastros", label: "Lugares", icon: MapPin },
    },
    {
        path: "/my/places",
        title: "Meus endereços",
        roles: ["CUSTOMER"],
        nav: { group: "Cadastros", label: "Meus endereços", icon: MapPin },
    },
    {
        path: "/customers",
        title: "Clientes",
        roles: STAFF,
        nav: { group: "Cadastros", label: "Clientes", icon: UserRound },
    },
    {
        path: "/alerts",
        title: "Alertas",
        roles: STAFF,
        nav: { group: "Análise", label: "Alertas", icon: TriangleAlert },
    },
    {
        path: "/analytics/trends",
        title: "Tendência anual",
        roles: ["ADMIN", "FLEET_MANAGER", "CUSTOMER"],
        nav: { group: "Análise", label: "Tendência anual", icon: ChartNoAxesCombined },
    },
    {
        path: "/analytics/routing",
        title: "Economia de rotas",
        roles: ["ADMIN", "DISPATCHER"],
        nav: { group: "Análise", label: "Economia de rotas", icon: PiggyBank },
    },
    {
        path: "/routes/optimize",
        title: "Simulador de rota",
        roles: ["ADMIN", "DISPATCHER"],
        nav: { group: "Análise", label: "Simulador de rota", icon: RouteIcon },
    },
    {
        path: "/users",
        title: "Usuários",
        roles: ["ADMIN"],
        nav: { group: "Administração", label: "Usuários", icon: Users },
    },
    {
        path: "/graph",
        title: "Mapa viário",
        roles: STAFF,
        nav: { group: "Administração", label: "Mapa viário", icon: Network },
    },
    { path: "/account", title: "Minha conta", roles: ALL },
];

export const GROUP_ORDER: NavGroup[] = ["Operação", "Cadastros", "Análise", "Administração"];

export const ROLE_LABEL: Record<Role, string> = {
    ADMIN: "Administrador",
    DISPATCHER: "Despachante",
    FLEET_MANAGER: "Gestor de frota",
    CUSTOMER: "Cliente",
};

export function titleFor(pathname: string): string {
    const match = APP_ROUTES.filter((route) => {
        const pattern = new RegExp(`^${route.path.replace(/:[^/]+/g, "[^/]+")}$`);
        return pattern.test(pathname);
    });
    // /orders/new casa com /orders/:id também; o mais específico (sem parâmetro) vem primeiro
    match.sort((a, b) => a.path.split(":").length - b.path.split(":").length);
    return match[0]?.title ?? "KJ Fleets";
}
