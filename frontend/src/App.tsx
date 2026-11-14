import { Navigate, Route, Routes } from "react-router-dom";
import { RequireAuth, RequireRole } from "./auth/guards";
import Toasts from "./components/Toasts";
import Shell from "./layout/Shell";
import Account from "./pages/Account";
import Login from "./pages/Login";
import Register from "./pages/Register";
import { Forbidden, NotFound, PendingScreen } from "./pages/SystemPages";
import { APP_ROUTES } from "./routes";

export default function App() {
    return (
        <>
            <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/track" element={<PendingScreen title="Rastreio público" />} />
                <Route
                    path="/track/:trackingNumber"
                    element={<PendingScreen title="Rastreio público" />}
                />
                <Route element={<RequireAuth />}>
                    <Route element={<Shell />}>
                        <Route path="/" element={<Navigate to="/dashboard" replace />} />
                        {APP_ROUTES.map((route) => (
                            <Route key={route.path} element={<RequireRole roles={route.roles} />}>
                                <Route
                                    path={route.path}
                                    element={
                                        route.path === "/account" ? (
                                            <Account />
                                        ) : (
                                            <PendingScreen title={route.title} />
                                        )
                                    }
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
