import { Navigate, Route, Routes } from "react-router-dom";
import { RequireAuth, RequireRole } from "./auth/guards";
import Toasts from "./components/Toasts";
import Shell from "./layout/Shell";
import Alerts from "./pages/Alerts";
import Dashboard from "./pages/Dashboard";
import DispatchDashboard from "./pages/DispatchDashboard";
import FleetDashboard from "./pages/FleetDashboard";
import Dispatch from "./pages/Dispatch";
import DriverDetail from "./pages/DriverDetail";
import Drivers from "./pages/Drivers";
import MyPlaces from "./pages/MyPlaces";
import Track from "./pages/Track";
import Vehicles from "./pages/Vehicles";
import Account from "./pages/Account";
import LiveMap from "./pages/LiveMap";
import RouteLab from "./pages/RouteLab";
import NewOrder from "./pages/NewOrder";
import OrderDetail from "./pages/OrderDetail";
import OrdersList from "./pages/OrdersList";
import Login from "./pages/Login";
import Register from "./pages/Register";
import { Forbidden, NotFound, PendingScreen } from "./pages/SystemPages";
import { APP_ROUTES } from "./routes";

const PAGES: Record<string, JSX.Element> = {
    "/dashboard": <Dashboard />,
    "/dashboard/dispatch": <DispatchDashboard />,
    "/dashboard/fleet": <FleetDashboard />,
    "/alerts": <Alerts />,
    "/account": <Account />,
    "/map": <LiveMap />,
    "/orders": <OrdersList />,
    "/orders/new": <NewOrder />,
    "/orders/:id": <OrderDetail />,
    "/dispatch": <Dispatch />,
    "/my/places": <MyPlaces />,
    "/drivers": <Drivers />,
    "/drivers/:id": <DriverDetail />,
    "/vehicles": <Vehicles />,
    "/routes/optimize": <RouteLab />,
};
const pageFor = (path: string, title: string) => PAGES[path] ?? <PendingScreen title={title} />;

export default function App() {
    return (
        <>
            <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/track" element={<Track />} />
                <Route path="/track/:trackingNumber" element={<Track />} />
                <Route element={<RequireAuth />}>
                    <Route element={<Shell />}>
                        <Route path="/" element={<Navigate to="/dashboard" replace />} />
                        {APP_ROUTES.map((route) => (
                            <Route key={route.path} element={<RequireRole roles={route.roles} />}>
                                <Route
                                    path={route.path}
                                    element={pageFor(route.path, route.title)}
                                />
                            </Route>
                        ))}
                        <Route path="/403" element={<Forbidden />} />
                        <Route path="*" element={<NotFound />} />
                    </Route>
                </Route>
            </Routes>
            <Toasts />
        </>
    );
}
