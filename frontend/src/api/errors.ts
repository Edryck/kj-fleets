const MESSAGES: Record<string, string> = {
    UNAUTHORIZED: "Sua sessão expirou. Entre novamente para continuar.",
    FORBIDDEN: "Você não pode fazer isso.",
    NOT_FOUND: "Item não encontrado (ou removido).",
    METHOD_NOT_ALLOWED: "Erro interno do app.",
    UNSUPPORTED_MEDIA_TYPE: "Erro interno do app.",
    USERNAME_TAKEN: "Esse usuário já existe (mesmo desativado).",
    PLATE_TAKEN: "Essa placa já existe (mesmo desativada).",
    ORDER_INVALID_TRANSITION: "Esse pedido não pode ir para esse estado agora.",
    ORDER_PAYLOAD_INCOMPLETE: "Informe retirada e entrega.",
    ORDER_DISPATCH_REQUIRES_DRIVER: "Atribua motorista e veículo antes de despachar.",
    ORDER_DISPATCH_REQUIRES_VEHICLE: "Atribua motorista e veículo antes de despachar.",
    ORDER_POD_REQUIRED: "Registre a prova de entrega antes de concluir.",
    DRIVER_NOT_AVAILABLE: "Motorista indisponível (ativo e Disponível).",
    DRIVER_HAS_ACTIVE_ORDER: "Motorista já tem pedido ativo.",
    VEHICLE_NOT_AVAILABLE: "Veículo em manutenção ou com pedido ativo.",
    ROUTE_TOO_LARGE_FOR_EXACT: "Exato (Held-Karp) aceita até 15 paradas, escolha outro algoritmo.",
    GRAPH_NOT_LOADED: "Mapa viário indisponível.",
    GRAPH_IMPORT_FAILED: "Mapa viário indisponível.",
    NO_PATH_FOUND: "Mapa viário indisponível.",
    INTERNAL_ERROR: "Erro no servidor, tente de novo.",
    NETWORK_ERROR: "Sem conexão com o servidor.",
};

// VALIDATION_ERROR, RESOURCE_IN_USE e códigos desconhecidos usam a mensagem da API
export function messageFor(code: string, fallback: string): string {
    return MESSAGES[code] ?? (fallback || "Algo deu errado. Tente de novo.");
}
