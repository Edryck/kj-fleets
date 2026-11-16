import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "@fontsource/inter/200.css";
import "@fontsource/inter/300.css";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/glass.css";
import "./styles/ambient.css";
import "./styles/motion.css";
import "./styles/patterns.css";
import "./styles/components.css";
import "./styles/layout.css";
import "./styles/orders.css";
import "./styles/map.css";
import "./styles/live-map.css";
import "./styles/dashboard.css";
import "./styles/customer.css";
import "./styles/catalogs.css";
import App from "./App";
import { getSession, subscribeSession } from "./auth/session";
import { applyTheme, readTheme } from "./theme";

applyTheme(readTheme());

const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
});

// logout/expiração não pode deixar dado do usuário anterior no cache
subscribeSession(() => {
    if (!getSession()) queryClient.clear();
});

const container = document.getElementById("root");
if (!container) throw new Error("elemento #root não encontrado");

createRoot(container).render(
    <StrictMode>
        <QueryClientProvider client={queryClient}>
            <BrowserRouter>
                <App />
            </BrowserRouter>
        </QueryClientProvider>
    </StrictMode>,
);
