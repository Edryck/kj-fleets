import { ChevronDown, LogOut, Menu, Moon, Sun, UserCog } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { logout, useMe, useSession } from "../auth/session";
import { ROLE_LABEL, titleFor } from "../routes";
import { readTheme, toggleTheme, type Theme } from "../theme";

// Slots de período, conexão STOMP e sino entram nas tarefas seguintes; só aparecem quando existirem de verdade
export default function TopBar({ onMenu }: { onMenu: () => void }) {
    const { pathname } = useLocation();
    const session = useSession();
    const me = useMe();
    const [theme, setTheme] = useState<Theme>(readTheme);
    const [menuOpen, setMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!menuOpen) return;
        const close = (e: MouseEvent | KeyboardEvent) => {
            if (
                e instanceof KeyboardEvent
                    ? e.key === "Escape"
                    : !menuRef.current?.contains(e.target as Node)
            )
                setMenuOpen(false);
        };
        document.addEventListener("mousedown", close);
        document.addEventListener("keydown", close);
        return () => {
            document.removeEventListener("mousedown", close);
            document.removeEventListener("keydown", close);
        };
    }, [menuOpen]);

    return (
        <header className="topbar">
            <button
                type="button"
                className="btn btn-ghost btn-icon topbar-menu"
                onClick={onMenu}
                aria-label="Abrir menu"
            >
                <Menu size={20} aria-hidden="true" />
            </button>
            <h1 className="topbar-title">{titleFor(pathname)}</h1>
            <div className="topbar-actions">
                <button
                    type="button"
                    className="btn btn-ghost btn-icon"
                    onClick={() => setTheme(toggleTheme())}
                    aria-label={
                        theme === "dark" ? "Mudar para tema claro" : "Mudar para tema escuro"
                    }
                >
                    {theme === "dark" ? (
                        <Sun size={20} aria-hidden="true" />
                    ) : (
                        <Moon size={20} aria-hidden="true" />
                    )}
                </button>
                <div className="user-menu" ref={menuRef}>
                    <button
                        type="button"
                        className="user-trigger"
                        aria-haspopup="menu"
                        aria-expanded={menuOpen}
                        onClick={() => setMenuOpen((o) => !o)}
                    >
                        <span className="user-lines">
                            <span className="user-name">{me.data?.username ?? "…"}</span>
                            <span className="caption">
                                {session ? ROLE_LABEL[session.role] : ""}
                            </span>
                        </span>
                        <ChevronDown size={16} aria-hidden="true" />
                    </button>
                    {menuOpen && (
                        <div className="popover" role="menu">
                            <Link role="menuitem" to="/account" onClick={() => setMenuOpen(false)}>
                                <UserCog size={18} aria-hidden="true" /> Minha conta
                            </Link>
                            <button role="menuitem" type="button" onClick={logout}>
                                <LogOut size={18} aria-hidden="true" /> Sair
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
}
