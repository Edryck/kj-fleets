import { Menu } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { useSession } from "../auth/session";
import Wordmark from "../components/Wordmark";
import Glass from "../glass/Glass";
import { isImmersive } from "../map/immersive";
import MapStage from "../map/MapStage";
import { connect, disconnect } from "../realtime/stomp";
import { useOrderEventsInvalidation, useReloadOnReconnect } from "../realtime/useTopic";
import AmbientBackground from "./AmbientBackground";
import PageTransition from "./PageTransition";
import Rail from "./Rail";
import ShellControls from "./ShellControls";
import TitleBlock from "./TitleBlock";
import { createTitleBlockStore, TitleBlockContext } from "./titleBlockContext";

export default function Shell() {
    const [railOpen, setRailOpen] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);
    const [titles] = useState(createTitleBlockStore);
    const { pathname } = useLocation();
    const session = useSession();
    const token = session?.token;
    const role = session?.role;
    const isStaff = role !== undefined && role !== "CUSTOMER";
    const immersive = role ? isImmersive(pathname, role) : false;

    useEffect(() => {
        if (!token) return;
        connect(token);
        return disconnect;
    }, [token]);
    useReloadOnReconnect();
    useOrderEventsInvalidation(isStaff);

    return (
        <TitleBlockContext.Provider value={titles}>
            <div className={`shell${immersive ? " is-immersive" : ""}`}>
                <AmbientBackground visible={!immersive} />
                {isStaff && <MapStage visible={immersive} />}
                <Rail
                    open={railOpen}
                    onOpenChange={setRailOpen}
                    mobileOpen={mobileOpen}
                    onMobileClose={() => setMobileOpen(false)}
                />
                <div className="shell-mobile-bar">
                    <Glass
                        as="button"
                        variant="clear"
                        press
                        type="button"
                        className="round"
                        onClick={() => setMobileOpen(true)}
                        aria-label="Abrir menu"
                    >
                        <Menu size={20} aria-hidden="true" />
                    </Glass>
                    <Wordmark />
                </div>
                <ShellControls />
                <div className="stage">
                    <TitleBlock />
                    <PageTransition />
                </div>
            </div>
        </TitleBlockContext.Provider>
    );
}
