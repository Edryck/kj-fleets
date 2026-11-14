import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { NavLink } from "react-router-dom";
import { useSession } from "../auth/session";
import Wordmark from "../components/Wordmark";
import { APP_ROUTES, GROUP_ORDER } from "../routes";

export default function Sidebar({
    collapsed,
    onToggle,
    mobileOpen = false,
    onNavigate,
}: {
    collapsed: boolean;
    onToggle: () => void;
    mobileOpen?: boolean;
    onNavigate?: () => void;
}) {
    const session = useSession();
    if (!session) return null;

    const groups = GROUP_ORDER.map((group) => ({
        group,
        items: APP_ROUTES.filter((r) => r.nav?.group === group && r.roles.includes(session.role)),
    })).filter((g) => g.items.length > 0);

    return (
        <aside
            className={`sidebar${collapsed ? " is-collapsed" : ""}${mobileOpen ? " is-open" : ""}`}
            aria-label="Navegação principal"
        >
            <div className="sidebar-head">
                <Wordmark compact={collapsed} />
            </div>
            <nav className="sidebar-nav">
                {groups.map(({ group, items }) => (
                    <div key={group} className="nav-group">
                        <p className="nav-group-title">{group}</p>
                        {items.map(({ path, nav }) => {
                            if (!nav) return null;
                            const Icon = nav.icon;
                            return (
                                <NavLink
                                    key={path}
                                    to={path}
                                    className="nav-item"
                                    title={collapsed ? nav.label : undefined}
                                    onClick={onNavigate}
                                    end={path === "/orders"}
                                >
                                    <Icon size={20} aria-hidden="true" />
                                    <span className="nav-label">{nav.label}</span>
                                </NavLink>
                            );
                        })}
                    </div>
                ))}
            </nav>
            <button
                type="button"
                className="btn btn-ghost sidebar-toggle"
                onClick={onToggle}
                aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
            >
                {collapsed ? (
                    <PanelLeftOpen size={20} aria-hidden="true" />
                ) : (
                    <PanelLeftClose size={20} aria-hidden="true" />
                )}
                <span className="nav-label">Recolher</span>
            </button>
        </aside>
    );
}
