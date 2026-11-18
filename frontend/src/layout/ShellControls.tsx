import { ChevronDown, LogOut, Moon, Sun, UserCog } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { logout, useMe, useSession } from "../auth/session";
import Glass from "../glass/Glass";
import RoleFigure from "../people/RoleFigure";
import { ROLE_LABEL } from "../routes";
import { readTheme, toggleTheme, type Theme } from "../theme";
import AlertsBell, { CustomerBell } from "./AlertsBell";

function UserMenu() {
    const session = useSession();
    const me = useMe();
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    const username = me.data?.username;

    useEffect(() => {
        if (!open) return;
        const close = (e: MouseEvent | KeyboardEvent) => {
            if (
                e instanceof KeyboardEvent
                    ? e.key === "Escape"
                    : !ref.current?.contains(e.target as Node)
            )
                setOpen(false);
        };
        document.addEventListener("mousedown", close);
        document.addEventListener("keydown", close);
        return () => {
            document.removeEventListener("mousedown", close);
            document.removeEventListener("keydown", close);
        };
    }, [open]);

    return (
        <div className="user-menu" ref={ref}>
            <Glass
                as="button"
                press
                type="button"
                className="user-chip"
                aria-haspopup="menu"
                aria-expanded={open}
                onClick={() => setOpen((o) => !o)}
            >
                <RoleFigure
                    role={session?.role}
                    name={username ? username.replace(/[._-]+/g, " ") : "…"}
                    className="user-avatar"
                />
                <span className="user-lines">
                    <span className="user-name">{username ?? "…"}</span>
                    <span className="user-role">{session ? ROLE_LABEL[session.role] : ""}</span>
                </span>
                <ChevronDown size={16} aria-hidden="true" />
            </Glass>
            {open && (
                <div className="popover user-popover" role="menu">
                    <Link role="menuitem" to="/account" onClick={() => setOpen(false)}>
                        <UserCog size={18} aria-hidden="true" /> Minha conta
                    </Link>
                    <button role="menuitem" type="button" onClick={logout}>
                        <LogOut size={18} aria-hidden="true" /> Sair
                    </button>
                </div>
            )}
        </div>
    );
}

export default function ShellControls() {
    const session = useSession();
    const [theme, setTheme] = useState<Theme>(readTheme);

    return (
        <div className="shell-controls">
            {session && (session.role === "CUSTOMER" ? <CustomerBell /> : <AlertsBell />)}
            <Glass
                as="button"
                variant="clear"
                press
                type="button"
                className="round"
                onClick={() => setTheme(toggleTheme())}
                aria-label={theme === "dark" ? "Mudar para tema claro" : "Mudar para tema escuro"}
            >
                {theme === "dark" ? (
                    <Sun size={20} aria-hidden="true" />
                ) : (
                    <Moon size={20} aria-hidden="true" />
                )}
            </Glass>
            <UserMenu />
        </div>
    );
}
