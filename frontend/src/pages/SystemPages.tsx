import { FileQuestion, ShieldAlert } from "lucide-react";
import { Link } from "react-router-dom";
import { EmptyState } from "../components/blocks";

export function Forbidden() {
    return (
        <EmptyState
            icon={ShieldAlert}
            title="Você não tem acesso a esta página"
            description="Seu perfil não inclui esta área. Se precisa dela, fale com um administrador."
            action={
                <Link className="btn btn-primary" to="/dashboard">
                    Voltar ao painel
                </Link>
            }
        />
    );
}

export function NotFound() {
    return (
        <EmptyState
            icon={FileQuestion}
            title="Não encontramos este item"
            description="O endereço pode estar errado, ou o item foi removido."
            action={
                <Link className="btn btn-primary" to="/dashboard">
                    Voltar ao painel
                </Link>
            }
        />
    );
}

export function PendingScreen({ title }: { title: string }) {
    return <EmptyState title={title} description="Esta tela ainda não foi construída." />;
}
