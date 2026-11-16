import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import {
    useEffect,
    useRef,
    useState,
    type FocusEvent,
    type MouseEvent as ReactMouseEvent,
} from "react";
import { NavLink } from "react-router-dom";
import { useSession } from "../auth/session";
import Glass from "../glass/Glass";
import { APP_ROUTES, GROUP_ORDER } from "../routes";

export default function Rail({
    open,
    onOpenChange,
    mobileOpen,
    onMobileClose,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    mobileOpen: boolean;
    onMobileClose: () => void;
}) {
    const session = useSession();
    const ref = useRef<HTMLDivElement>(null);
    const expanded = open || mobileOpen;
    const [tip, setTip] = useState<{ label: string; top: number } | null>(null);
    const latest = useRef({ onOpenChange, onMobileClose });
    latest.current = { onOpenChange, onMobileClose };

    useEffect(() => {
        if (!expanded) return;
        const close = () => {
            latest.current.onOpenChange(false);
            latest.current.onMobileClose();
        };
        const onKey = (event: KeyboardEvent) => {
            if (event.key === "Escape") close();
        };
        const onPointer = (event: MouseEvent) => {
            if (!ref.current?.contains(event.target as Node)) close();
        };
        document.addEventListener("keydown", onKey);
        document.addEventListener("mousedown", onPointer);
        return () => {
            document.removeEventListener("keydown", onKey);
            document.removeEventListener("mousedown", onPointer);
        };
    }, [expanded]);

    if (!session) return null;

    const groups = GROUP_ORDER.map((group) => ({
        group,
        items: APP_ROUTES.filter((r) => r.nav?.group === group && r.roles.includes(session.role)),
    })).filter((g) => g.items.length > 0);

    const navigate = () => {
        onOpenChange(false);
        onMobileClose();
    };

    const showTip = (event: ReactMouseEvent<HTMLElement> | FocusEvent<HTMLElement>) => {
        if (expanded) return;
        const target = event.currentTarget;
        const rect = target.getBoundingClientRect();
        setTip({ label: target.dataset.label ?? "", top: rect.top + rect.height / 2 });
    };
    const hideTip = () => setTip(null);
    const tipHandlers = {
        onMouseEnter: showTip,
        onFocus: showTip,
        onMouseLeave: hideTip,
        onBlur: hideTip,
    };

    return (
        <>
            {mobileOpen && <div className="app-rail-scrim" aria-hidden="true" onClick={navigate} />}
            <div ref={ref} className="app-rail-host">
                <Glass
                    as="nav"
                    className={`app-rail${open ? " is-open" : ""}${mobileOpen ? " is-mobile-open" : ""}`}
                    aria-label="Navegação principal"
                >
                    <div className="app-rail-brand">
                        <span className="app-rail-seal" aria-hidden="true">
                            KJ
                        </span>
                        <span className="app-rail-brand-name">KJ Fleets</span>
                    </div>
                    <button
                        type="button"
                        className="app-rail-item app-rail-toggle"
                        onClick={() => {
                            hideTip();
                            onOpenChange(!open);
                        }}
                        {...tipHandlers}
                        aria-expanded={open}
                        aria-label={open ? "Recolher menu" : "Expandir menu"}
                        data-label={open ? "Recolher menu" : "Expandir menu"}
                    >
                        {open ? (
                            <PanelLeftClose size={20} aria-hidden="true" />
                        ) : (
                            <PanelLeftOpen size={20} aria-hidden="true" />
                        )}
                    </button>
                    <div className="app-rail-nav">
                        {groups.map(({ group, items }) => (
                            <div key={group} className="app-rail-group">
                                <p className="app-rail-group-title">
                                    <span>{group}</span>
                                </p>
                                {items.map(({ path, nav }) => {
                                    if (!nav) return null;
                                    const Icon = nav.icon;
                                    return (
                                        <NavLink
                                            key={path}
                                            to={path}
                                            end={path === "/orders"}
                                            className={({ isActive }) =>
                                                `app-rail-item${isActive ? " is-active" : ""}`
                                            }
                                            data-label={nav.label}
                                            onClick={navigate}
                                            {...tipHandlers}
                                        >
                                            <Icon size={20} aria-hidden="true" />
                                            <span className="app-rail-label">{nav.label}</span>
                                        </NavLink>
                                    );
                                })}
                            </div>
                        ))}
                    </div>
                </Glass>
                {tip && !expanded && (
                    <div className="app-rail-tooltip" aria-hidden="true" style={{ top: tip.top }}>
                        {tip.label}
                    </div>
                )}
            </div>
        </>
    );
}
