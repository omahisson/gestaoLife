# Arquitetura da aplicação

O Gestão Life é composto por duas aplicações web e uma API. A aplicação principal contém as funcionalidades pessoais; a aplicação administrativa é compilada separadamente e seus arquivos só são entregues pela API depois da confirmação de uma sessão administrativa.

## Fronteiras

- `src/`: aplicação pessoal React e criptografia executada no navegador.
- `administracao/`: aplicação administrativa independente, ausente do pacote público principal.
- `servidor/`: API Fastify, autenticação, autorização e persistência SQLite.
- `infra/`: serviço, proxy e implantação automatizada.

## Identidade e isolamento

A senha de acesso é processada no servidor com Argon2id. Uma sessão usa um token opaco aleatório em cookie `HttpOnly`, `SameSite=Strict` e `Secure` em produção. O servidor resolve o proprietário pelo token; nenhum endpoint aceita um identificador de usuário para decidir o dono dos dados.

Cada tabela persistente possui uma relação com a conta. Operações administrativas exigem perfil `administrador`, enquanto a aplicação administrativa e seus arquivos retornam acesso negado às demais contas.

## Cofre criptografado

A frase de proteção nunca é enviada à API. No navegador, Argon2id deriva uma chave protetora dessa frase. Ela abre uma chave aleatória de 256 bits usada pelo AES-GCM para criptografar os blocos pessoais.

O banco armazena apenas o envelope da chave e blocos opacos. A autenticação do AES-GCM vincula cada conteúdo ao usuário, tipo do bloco e revisão. Isso impede trocar silenciosamente um bloco de dono ou versão.

Os dados são agrupados para reduzir metadados:

- configurações do usuário;
- base financeira (cartões e padrões);
- despesas separadas por mês;
- metas;
- notas em grupos de até 50.

Cada bloco guarda somente proprietário e tipo como chave composta, revisão, nonce e conteúdo criptografado. A etiqueta de autenticação já faz parte do conteúdo AES-GCM. A revisão evita que uma tela antiga sobrescreva alterações novas.

## Administração

Na tela de perfil da conta administrativa, manter pressionado por três segundos o círculo decorativo azul já existente abre o gerenciamento. A aplicação principal contém apenas esse acionador e um contêiner protegido; formulário, lista e regras administrativas pertencem ao pacote separado.

Novas contas começam pendentes. O administrador recebe um código de ativação mostrado uma vez e válido por 24 horas. Na ativação, a pessoa cria a senha de acesso e a frase do cofre. Não existe cadastro público.

## Verificação

`npm run check` executa tipos, testes, compilação das duas aplicações e compilação da API. Os testes cobrem separação entre contas, CSRF, concorrência por revisão e autenticação criptográfica dos blocos.
