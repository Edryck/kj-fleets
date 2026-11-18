import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { Skeleton } from "../components/blocks";
import Glass from "../glass/Glass";
import { useTitleBlock } from "../layout/titleBlockContext";

function OffPath({
    code,
    pageTitle,
    title,
    sentence,
}: {
    code: string;
    pageTitle: string;
    title: string;
    sentence: string;
}) {
    useTitleBlock({ title: pageTitle });
    return (
        <section className="system" aria-labelledby={`system-${code}`}>
            <span className="system-code motion-rise" aria-hidden="true">
                {code}
            </span>
            <h2 id={`system-${code}`} className="system-title">
                {title}
            </h2>
            <p className="system-sentence">{sentence}</p>
            <Link className="btn btn-primary" to="/dashboard">
                <ArrowLeft size={16} aria-hidden="true" />
                Voltar ao painel
            </Link>
        </section>
    );
}

export function Forbidden() {
    return (
        <OffPath
            code="403"
            pageTitle="Sem permissão"
            title="Você não tem acesso a esta página"
            sentence="Seu perfil não inclui esta área. Se precisa dela, fale com um administrador."
        />
    );
}

export function NotFound() {
    return (
        <OffPath
            code="404"
            pageTitle="Página não encontrada"
            title="Não encontramos este item"
            sentence="O endereço pode estar errado, ou o item foi removido."
        />
    );
}

export function PendingScreen({ title }: { title: string }) {
    return (
        <Glass as="section" className="system-pending" aria-label={title}>
            <div className="system-pending-lines" aria-hidden="true">
                <Skeleton height={28} width="42%" />
                <Skeleton height={14} width="78%" />
                <Skeleton height={14} width="64%" />
                <Skeleton height={140} />
            </div>
            <p className="system-sentence">Esta tela ainda não foi construída.</p>
        </Glass>
    );
}
