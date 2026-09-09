# Arquitetura da aplicação

A aplicação adota uma organização modular orientada por funcionalidades. A interface visual foi preservada, enquanto responsabilidades antes concentradas no componente principal passaram a ter fronteiras explícitas.

## Camadas

- `src/aplicacao`: composição da aplicação, estado compartilhado entre telas e coordenação dos fluxos.
- `src/funcionalidades`: telas e comportamentos próprios de cada área (`inicio`, `insights`, `vida`, `perfil` e `notas`).
- `src/dominio`: modelos, constantes e regras de negócio puras.
- `src/dados`: contrato do `db.json`, leitura, persistência e isolamento dos registros por usuário.
- `src/servicos`: serviços de aplicação, como autenticação e controle de sessão.
- `src/componentes`: elementos visuais reutilizáveis, sem conhecimento dos fluxos da aplicação.
- `src/compartilhado/ganchos`: mecanismos React genéricos reutilizados pela aplicação.

## Decisões de engenharia

- As regras de datas e finanças não dependem de React, o que facilita testes unitários futuros.
- Tipos do domínio são centralizados e importados apenas como tipos quando apropriado.
- Estados estritamente locais, como a edição do perfil e a expansão do painel de tarefas, pertencem aos componentes que os utilizam.
- As telas recebem dependências e ações por propriedades explícitas, evitando acoplamento implícito.
- Identificadores locais e atualizações periódicas ficam encapsulados em ganchos com responsabilidade única.
- O JSON Server expõe o `db.json` como API REST e grava nele todas as alterações.
- Cada conta possui um registro agregado em `dadosUsuarios`, identificado pelo mesmo `usuarioId`, evitando mistura de dados entre contas.
- As gravações de cada usuário são enfileiradas para preservar a ordem das alterações feitas pela interface.
- A autenticação compara hashes de senha e expõe à interface apenas os dados seguros da sessão.
- O TypeScript permanece em modo estrito e também verifica símbolos e parâmetros não utilizados.

## Verificação

Execute `npm run check` para realizar a análise estática de tipos e gerar a compilação de produção.
