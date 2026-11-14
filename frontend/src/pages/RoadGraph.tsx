import { Network } from "lucide-react";
import { EmptyState } from "../components/blocks";

// sem controles: a tela só explica o que falta, porque o endpoint ainda não existe
export default function RoadGraph() {
    return (
        <div className="stack">
            <header className="dash-head">
                <div className="dash-title">
                    <h1>Mapa viário</h1>
                    <p className="page-sub">Rotas por ruas, em uma região do Sul do país.</p>
                </div>
            </header>
            <section className="card">
                <EmptyState
                    icon={Network}
                    title="Mapa viário — em breve"
                    description="Hoje as rotas ligam as paradas em linha reta. O próximo passo do backend é a roteirização por ruas, com GraphHopper, para a região Sul. Esta tela vai mostrar o trajeto real quando ela estiver pronta."
                />
            </section>
        </div>
    );
}
