import { Navigate, Outlet, useLocation } from "react-router-dom";
import type { Role } from "../api/types";
import { Forbidden } from "../pages/SystemPages";
import { useSession } from "./session";

export function RequireAuth() {
    const session = useSession();
    const location = useLocation();
    if (!session) {
        const next = encodeURIComponent(location.pathname + location.search);
        return <Navigate to={`/login?next=${next}`} replace />;
    }
    return <Outlet />;
}

export function RequireRole({ roles }: { roles: Role[] }) {
    const session = useSession();
    if (!session) return null;
    return roles.includes(session.role) ? <Outlet /> : <Forbidden />;
}
