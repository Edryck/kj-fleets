import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "@fontsource/montserrat/600.css";
import "@fontsource/montserrat/700.css";
import "@fontsource/montserrat/800.css";
import "./styles/tokens.css";
import "./styles/base.css";
import App from "./App";
import TokensPage from "./TokensPage";
import { applyTheme, readTheme } from "./theme";

applyTheme(readTheme());

const container = document.getElementById("root");
if (!container) throw new Error("elemento #root não encontrado");

createRoot(container).render(
    <StrictMode>{window.location.pathname === "/__tokens" ? <TokensPage /> : <App />}</StrictMode>,
);
