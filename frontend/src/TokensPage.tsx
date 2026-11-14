import "./TokensPage.css";

const groups: Record<string, string[]> = {
    Marca: ["brand-orange", "brand-graphite", "brand-gray", "brand-white"],
    Superfícies: ["background", "surface", "surface-raised", "surface-muted", "border"],
    Texto: ["text", "text-muted", "text-subtle", "on-primary"],
    Primária: ["primary", "primary-hover", "primary-soft"],
    Semânticas: ["success", "warning", "danger", "info", "offline"],
};

// Página temporária para conferir os tokens nos dois temas (removida na Task 2)
export default function TokensPage() {
    return (
        <div className="tokens-page">
            {(["dark", "light"] as const).map((theme) => (
                <section key={theme} className="tokens-panel" data-theme={theme}>
                    <h2>{theme === "dark" ? "Escuro" : "Claro"}</h2>
                    {Object.entries(groups).map(([title, names]) => (
                        <div key={title}>
                            <h3>{title}</h3>
                            <ul>
                                {names.map((name) => (
                                    <li key={name} className="swatch">
                                        <span
                                            className="swatch-chip"
                                            style={{ background: `var(--color-${name})` }}
                                        />
                                        <code className="data">--color-{name}</code>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </section>
            ))}
        </div>
    );
}
