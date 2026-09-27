# Backlog

## Concluído — requisitos aprovados

### Despesas e projeções

- Fazer a prévia de uma nova despesa sem padrão usar o ciclo financeiro completo ao qual pertence a data escolhida, com a mesma regra usada depois do salvamento. Exibir a quantidade total prevista no ciclo e o saldo após registrar a nova despesa.
- Na recorrência personalizada, oferecer controles de diminuir e aumentar ao redor do valor, mantendo digitação direta, mínimo de uma ocorrência e o mesmo componente na criação e na edição do padrão.
- Manter os estados `Gasto`, `Não gasto` e `Ainda previsto`. Uma nova despesa consome primeiro `Ainda previsto`; somente quando esse estado estiver zerado ela converte uma ocorrência de `Não gasto` em `Gasto`. No encerramento do ciclo, todas as ocorrências ainda previstas e não registradas passam para `Não gasto`.
- Em cada padrão da projeção, mostrar tanto o valor total previsto para o ciclo quanto o gasto restante projetado. No consolidado, mostrar `Total projetado` e `Total de gasto restante projetado`.
- Remover o texto `Edite o padrão aqui`.
- Reordenar o resumo da despesa em duas linhas: `Previsão do ciclo` e `Ainda previsto` acima; `Já gasto` e `Após esta despesa` abaixo.
- Encerrar padrões com despesas vinculadas na data da exclusão, preservando-os no mês atual e no histórico com indicação visual da data de exclusão. Eles não devem gerar ocorrências posteriores nem contribuir para o gasto restante depois da exclusão. Padrões sem nenhuma despesa vinculada podem ser removidos definitivamente.
- Usar 04/01/2026, domingo, como âncora semanal global. As semanas vão de domingo a sábado e pertencem ao mês do domingo, sem dupla contagem nas divisas entre meses.

### Calendário e Insights

- Destacar em azul os botões `Mês atual` e `Semana atual` quando houver retorno disponível. Deixar `Hoje` cinza e desabilitado quando a tela já estiver no estado atual.
- Sincronizar o mês do card de gastos da tela inicial com o mês aberto no calendário e explicitar se a diferença está acima ou abaixo da previsão. Manter inalterada a composição atual das despesas usadas no comparativo.
- Na visão mensal sem seleção explícita, exibir as tarefas do mês inteiro. Uma data mostra apenas o dia; duas datas mostram o intervalo; limpar a seleção volta ao mês inteiro.

### Notas

- Adicionar data e hora gerais ao lado do título da nota. Checkboxes sem agendamento próprio herdam o agendamento da nota; checkboxes novos também herdam; um agendamento individual substitui o geral e, ao ser removido, volta a herdar o da nota.

### Dados da conta

- Disponibilizar no perfil de cada usuário a exportação descriptografada dos próprios dados, com aviso explícito de que o arquivo é legível.
- Permitir importar o arquivo pelo perfil, validá-lo e substituir de forma atômica apenas os dados da conta atual, sem alterar login, senha, frase de proteção, perfil de acesso ou identificador da conta.
- Fazer o navegador descriptografar a exportação e criptografar novamente a importação, mantendo no servidor apenas os blocos criptografados.
