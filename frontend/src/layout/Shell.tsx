import { useState } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";

const COLLAPSE_KEY = "kjfleets.sidebarCollapsed";

function readCollapsed(): boolean {
    try {
        return localStorage.getItem(COLLAPSE_KEY) === "1";
    } catch {
        return false;
    }
}

export default function Shell() {
    const [collapsed, setCollapsed] = useState(readCollapsed);
    const [mobileOpen, setMobileOpen] = useState(false);

    const toggle = () => {
        setCollapsed((c) => {
            try {
                localStorage.setItem(COLLAPSE_KEY, c ? "0" : "1");
            } catch {
                // sem storage a preferência vale só nesta carga
            }
            return !c;
        });
    };

    return (
        <div className={`shell${collapsed ? " is-collapsed" : ""}`}>
            <Sidebar
                collapsed={collapsed}
                onToggle={toggle}
                mobileOpen={mobileOpen}
                onNavigate={() => setMobileOpen(false)}
            />
            {mobileOpen && <div className="shell-scrim" onClick={() => setMobileOpen(false)} />}
            <div className="shell-main">
                <TopBar onMenu={() => setMobileOpen(true)} />
                <main className="content">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}
