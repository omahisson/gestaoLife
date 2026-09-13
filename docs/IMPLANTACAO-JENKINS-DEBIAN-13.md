# Ativação da V1 na VPS

Esta versão troca o banco JSON por uma API autenticada e um banco SQLite novo. Os dados anteriores não são migrados: a V1 começa vazia, conforme decidido para esta instalação.

## Único acesso manual

Faça este procedimento depois de enviar o commit da V1. A primeira execução automática do Jenkins pode falhar na etapa de implantação porque o instalador antigo ainda espera o arquivo removido. Mesmo assim, o workspace do Jenkins já terá os arquivos novos.

Entre uma única vez na VPS e execute:

```sh
sudo sh /var/lib/jenkins/workspace/gestao-life/infra/preparar-v1 admin "Seu nome"
```

O domínio `gestaolife.duckdns.org` precisa estar apontando para a VPS e o certificado Let's Encrypt precisa existir. O script interrompe a preparação se não encontrar o certificado, pois a sessão da V1 só funciona por HTTPS.

O comando:

1. valida Node.js 22 ou superior;
2. instala o implantador estável, o serviço da API e a configuração do Nginx;
3. implanta a compilação que já está no workspace;
4. cria a conta administrativa pendente e imprime um código de ativação válido por 24 horas;
5. remove `/var/lib/gestaolife/db.json` sem migrar seu conteúdo, somente depois que a nova API está pronta.

Guarde o código exibido. No navegador, escolha **Ativar uma conta**, informe `admin`, o código, uma senha de acesso e uma frase de proteção diferente. A frase não é enviada ao servidor e não há recuperação caso seja perdida.

## Implantações seguintes

Depois da preparação única, cada commit recebido pelo Jenkins executa:

1. `npm ci` com o lock versionado;
2. checagem de tipos e testes;
3. compilação do aplicativo público, da administração privada e da API;
4. criação de uma versão em `/opt/gestaolife/releases`;
5. troca atômica da API ativa, reinício e verificação de saúde;
6. restauração automática da versão anterior do código se a nova API não iniciar.

O banco permanece em `/var/lib/gestaolife/gestao-life.sqlite`. O processo não exige acesso manual à VPS e não cria cópias de segurança.

## Novas pessoas

Na conta administrativa, abra o perfil e mantenha pressionado por três segundos o círculo decorativo do lado direito do cartão azul. Cadastre nome e usuário, copie o código mostrado uma vez e entregue-o à pessoa. Cada conta cria a própria chave e recebe blocos separados no banco.

## Diagnóstico pelo Jenkins

O implantador testa `http://127.0.0.1:3001/api/saude`. Se a API falhar, as últimas linhas do serviço aparecem no console do build e a versão anterior do código é restaurada automaticamente.
