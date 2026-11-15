# language: pt
Funcionalidade: Ciclo de vida da ordem de serviço
  Como oficina mecânica
  Quero que a ordem de serviço avance conforme as etapas dos microsserviços
  Para que o cliente acompanhe o andamento e nenhuma etapa fique inconsistente

  Contexto:
    Dado um serviço "Troca de óleo" no catálogo por 120.00
    E uma peça "Filtro de óleo" com 10 unidades em estoque por 45.50

  Cenário: Ordem de serviço concluída com sucesso
    Quando o atendente abre uma ordem de serviço com 2 unidades da peça
    Então a ordem de serviço fica com status "RECEIVED"
    E o orçamento da ordem de serviço é 211.00
    E o estoque da peça passa a ser 8
    Quando o mecânico inicia e conclui o diagnóstico
    E o orçamento é gerado
    Então a ordem de serviço fica com status "AWAITING_APPROVAL"
    Quando o cliente aprova o orçamento e o pagamento é confirmado
    E o mecânico inicia e conclui o reparo
    Então a ordem de serviço fica com status "FINISHED"
    E a saga termina como "COMPLETED"
    Quando o atendente entrega o veículo
    Então a ordem de serviço fica com status "DELIVERED"

  Cenário: Orçamento recusado desfaz a ordem de serviço
    Quando o atendente abre uma ordem de serviço com 2 unidades da peça
    E o mecânico inicia e conclui o diagnóstico
    E o orçamento é gerado
    E o cliente recusa o orçamento
    Então a ordem de serviço fica com status "CANCELLED"
    E o estoque da peça passa a ser 10
    E a execução recebe o comando de cancelamento
    E a saga termina como "COMPENSATED"

  Cenário: Falha no reparo estorna o pagamento
    Quando o atendente abre uma ordem de serviço com 2 unidades da peça
    E o mecânico inicia e conclui o diagnóstico
    E o orçamento é gerado
    E o cliente aprova o orçamento e o pagamento é confirmado
    E o reparo falha
    Então a ordem de serviço fica com status "CANCELLED"
    E o estoque da peça passa a ser 10
    E o faturamento recebe o comando de estorno
    Quando o estorno é confirmado
    Então a saga termina como "COMPENSATED"
