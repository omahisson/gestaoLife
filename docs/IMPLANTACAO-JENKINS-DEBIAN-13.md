# Implantação do Gestão Life com Jenkins no Debian 13

Este procedimento foi dimensionado especificamente para a VPS **1-1-10**, com 1 vCore, 1 GB de RAM e SSD NVMe de 10 GB. Ele instala o frontend no Nginx, mantém o JSON Server como um serviço do `systemd` e usa o Jenkins para validar e implantar a aplicação. O banco persistente fica em `/var/lib/gestaolife/db.json` e não é sobrescrito nos próximos builds.

Por causa dos recursos limitados, a configuração usa apenas um executor, limita o heap do Jenkins e do Node.js, conserva somente três builds e não utiliza Docker. Durante uma compilação, a aplicação pode responder um pouco mais devagar.

## 1. Acessar e conferir a VPS

Na sua máquina:

```bash
ssh root@74.208.102.177
```

Na VPS, confirme se os recursos correspondem ao plano contratado:

```bash
free -h
swapon --show
nproc
df -h
```

Essa VPS precisa de swap para absorver o pico simultâneo do Jenkins e do Node.js. Se `swapon --show` não apresentar nenhum resultado, crie 1 GB:

```bash
fallocate -l 1G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
grep -q '^/swapfile ' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
echo 'vm.swappiness=20' > /etc/sysctl.d/99-gestaolife.conf
sysctl --system
```

Confirme:

```bash
free -h
swapon --show
```

## 2. Instalar Node.js, Nginx e utilitários

O Node.js do Debian 13 atende ao requisito do Vite 8.

```bash
apt update
apt install -y --no-install-recommends ca-certificates curl gnupg git nginx nodejs npm rsync openssh-client sudo
npm install -g pnpm@10.30.1
npm cache clean --force
node --version
pnpm --version
```

## 3. Instalar o Jenkins LTS

Instale primeiro o Java 21 e depois adicione o repositório oficial do Jenkins:

```bash
apt install -y fontconfig openjdk-21-jre
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://pkg.jenkins.io/debian-stable/jenkins.io-2026.key -o /etc/apt/keyrings/jenkins-keyring.asc
echo 'deb [signed-by=/etc/apt/keyrings/jenkins-keyring.asc] https://pkg.jenkins.io/debian-stable binary/' > /etc/apt/sources.list.d/jenkins.list
apt update
apt install -y jenkins
```

Limite a memória, mantenha o Jenkins somente no endereço local e direcione seus arquivos temporários para o SSD. Isso evita que o monitor desconecte o nó por causa do pequeno `tmpfs` desta VPS:

```bash
install -d -m 0755 /etc/systemd/system/jenkins.service.d
install -d -o jenkins -g jenkins -m 0750 /var/lib/jenkins/tmp
printf '%s\n' '[Service]' 'Environment="JAVA_OPTS=-Djava.awt.headless=true -Djava.io.tmpdir=/var/lib/jenkins/tmp -Xms64m -Xmx256m -XX:+UseSerialGC"' 'Environment="JENKINS_OPTS=--httpListenAddress=127.0.0.1"' 'Nice=5' > /etc/systemd/system/jenkins.service.d/override.conf
```

Depois aplique:

```bash
systemctl daemon-reload
systemctl enable --now jenkins
systemctl status jenkins --no-pager
```

## 4. Fazer a configuração inicial com segurança

Não abra a porta 8080 na internet. Em outro terminal da sua máquina, crie um túnel SSH:

```bash
ssh -N -L 127.0.0.1:8081:127.0.0.1:8080 root@74.208.102.177
```

Acesse `http://localhost:8081`. Para obter a senha inicial, execute na VPS:

```bash
cat /var/lib/jenkins/secrets/initialAdminPassword
```

Na tela de complementos, clique primeiro em **Nenhum** e marque somente **Pipeline** e **Git**. O instalador adicionará automaticamente **Credentials**, **SSH Credentials** e as demais dependências obrigatórias. Não marque **SSH Build Agents**, pois a implantação será executada no próprio servidor. Evite a instalação indiscriminada dos complementos sugeridos, pois eles aumentam o consumo de memória e disco. Em **Manage Jenkins > Nodes > Built-In Node > Configure**, mantenha apenas **1 executor**.

Na página do **Built-In Node**, o campo de espaço temporário deve apresentar o espaço livre do SSD, e não os aproximadamente 428 MB de `/tmp`. Se o nó tiver sido desconectado antes dessa configuração, clique uma última vez em **Esse nó voltou a ficar online**.

## 5. Dar ao Jenkins acesso somente de leitura ao GitHub

Crie uma chave exclusiva para este repositório:

```bash
sudo -u jenkins install -d -m 700 /var/lib/jenkins/.ssh
sudo -u jenkins ssh-keygen -t ed25519 -C jenkins-gestaolife -f /var/lib/jenkins/.ssh/gestaolife -N ''
sudo -u jenkins ssh-keyscan -H github.com >> /var/lib/jenkins/.ssh/known_hosts
chown jenkins:jenkins /var/lib/jenkins/.ssh/known_hosts
chmod 600 /var/lib/jenkins/.ssh/known_hosts
cat /var/lib/jenkins/.ssh/gestaolife.pub
```

No GitHub, abra o repositório `omahisson/gestaoLife`, entre em **Settings > Deploy keys > Add deploy key**, cole a chave pública e não habilite permissão de escrita.

No Jenkins, abra **Manage Jenkins > Credentials > System > Global credentials > Add Credentials** e cadastre:

- Kind: `SSH Username with private key`
- ID: `github-gestaolife`
- Username: `git`
- Private Key: conteúdo de `/var/lib/jenkins/.ssh/gestaolife`

## 6. Publicar estes arquivos no GitHub

Na sua máquina, dentro do projeto:

```bash
git add .
git commit -m "ci: preparar implantação com Jenkins"
git push origin main
```

Confirme no GitHub que `Jenkinsfile` e a pasta `infra` aparecem na branch `main` antes de continuar.

## 7. Instalar a infraestrutura do projeto

Faça um clone temporário para obter os arquivos administrativos:

```bash
sudo -u jenkins env GIT_SSH_COMMAND='ssh -i /var/lib/jenkins/.ssh/gestaolife -o IdentitiesOnly=yes' git clone --depth 1 git@github.com:omahisson/gestaoLife.git /var/lib/jenkins/gestaoLife-bootstrap
useradd --system --home-dir /var/lib/gestaolife --create-home --shell /usr/sbin/nologin gestaolife
install -m 0755 /var/lib/jenkins/gestaoLife-bootstrap/infra/deploy-gestaolife /usr/local/sbin/deploy-gestaolife
install -m 0644 /var/lib/jenkins/gestaoLife-bootstrap/infra/gestaolife-api.service /etc/systemd/system/gestaolife-api.service
install -m 0644 /var/lib/jenkins/gestaoLife-bootstrap/infra/nginx-gestaolife.conf /etc/nginx/sites-available/gestaolife
ln -s /etc/nginx/sites-available/gestaolife /etc/nginx/sites-enabled/gestaolife
rm -f /etc/nginx/sites-enabled/default
rm -rf /var/lib/jenkins/gestaoLife-bootstrap
```

Autorize o Jenkins a executar somente o implantador controlado pelo administrador:

```bash
echo 'jenkins ALL=(root) NOPASSWD: /usr/local/sbin/deploy-gestaolife' > /etc/sudoers.d/jenkins-gestaolife
chmod 0440 /etc/sudoers.d/jenkins-gestaolife
visudo -cf /etc/sudoers.d/jenkins-gestaolife
systemctl daemon-reload
systemctl enable gestaolife-api nginx
nginx -t
```

O serviço da API será iniciado pelo primeiro build. Não altere manualmente `/var/lib/gestaolife/db.json`: ele é o banco compartilhado entre navegadores.

O implantador cria também `/opt/gestaolife/public`, exigido pelo JSON Server, e só conclui depois que a API responde em `127.0.0.1:3001`. Se a API falhar ao iniciar, o build será marcado como falho e apresentará as últimas linhas do serviço.

## 8. Criar o pipeline no Jenkins

1. Clique em **New Item**.
2. Use exatamente o nome `gestao-life` e selecione **Pipeline**.
3. Em **Pipeline**, escolha **Pipeline script from SCM**.
4. Em **SCM**, escolha **Git**.
5. Use a URL `git@github.com:omahisson/gestaoLife.git`.
6. Selecione a credencial `github-gestaolife`.
7. Em branch, use `*/main`.
8. Em Script Path, use `Jenkinsfile`.
9. Em **Build Triggers**, marque **Poll SCM** e informe `H/5 * * * *`.
10. Salve. Se esta for a primeira implantação, clique uma vez em **Build Now**.

O `Jenkinsfile` também registra o mesmo agendamento. Depois do primeiro build, cada `git push` para `main` será detectado em aproximadamente cinco minutos, sem expor o painel do Jenkins à internet e sem exigir outro clique em **Build Now**.

## 9. Verificar a implantação

Na VPS:

```bash
systemctl status jenkins gestaolife-api nginx --no-pager
curl -I http://127.0.0.1:3001/usuarios
curl -I http://74.208.102.177
journalctl -u gestaolife-api -n 50 --no-pager
free -h
df -h
```

A aplicação ficará disponível em `http://74.208.102.177`. No firewall da provedora, deixe abertas somente as portas 22 e 80 neste primeiro momento. Não abra 3001 nem 8080.

## 10. Configurar domínio e HTTPS

Depois de apontar `gestaolife.duckdns.org` para `74.208.102.177`, confirme a resolução e instale a configuração atualizada do Nginx:

```bash
getent ahostsv4 gestaolife.duckdns.org
install -m 0644 /var/lib/jenkins/workspace/gestao-life/infra/nginx-gestaolife.conf /etc/nginx/sites-available/gestaolife
nginx -t
systemctl reload nginx
```

Abra também a porta 443 no firewall da provedora. Instale o Certbot e solicite um certificado ao Let's Encrypt:

```bash
apt update
apt install -y --no-install-recommends certbot python3-certbot-nginx
certbot --nginx -d gestaolife.duckdns.org --redirect
```

Informe um e-mail válido, aceite os termos e não compartilhe esse endereço com terceiros se não desejar receber mensagens da EFF. Depois valide o acesso e a renovação automática:

```bash
curl -I https://gestaolife.duckdns.org
systemctl status certbot.timer --no-pager
certbot renew --dry-run
```

A aplicação passa a ser acessada por `https://gestaolife.duckdns.org`. O Certbot modifica a configuração instalada do Nginx para incluir o certificado; não a substitua posteriormente por uma versão antiga do arquivo do repositório.

## 11. Operação e cópia de segurança

Antes de uma alteração importante, faça uma cópia do banco:

```bash
install -m 0600 /var/lib/gestaolife/db.json "/root/gestaolife-$(date +%F-%H%M).json"
```

Para acompanhar os serviços:

```bash
journalctl -u jenkins -f
journalctl -u gestaolife-api -f
```

Com apenas 10 GB de disco, confira o consumo pelo menos uma vez por mês:

```bash
du -sh /var/lib/jenkins /var/lib/gestaolife /opt/gestaolife /var/cache/apt
sudo -u jenkins sh -c 'cd /var/lib/jenkins && pnpm store prune'
journalctl --vacuum-size=100M
apt clean
df -h
```

Não apague `/var/lib/gestaolife`: esse diretório contém o banco utilizado pela aplicação.

## Por que não usar Docker nesta VPS

Docker ajudaria a padronizar e isolar os serviços, mas não reduziria o consumo do Jenkins ou do processo de compilação. Neste servidor, as imagens, camadas, volumes e cache de build também competiriam pelos 10 GB de disco. Para este plano, Nginx e JSON Server como serviços nativos são mais simples e econômicos. Se futuramente a VPS tiver ao menos 2 vCPUs, 4 GB de RAM e mais espaço em disco, a migração para Docker Compose passa a ser vantajosa.

## Limite de segurança da versão 1.0

O JSON Server permite separar os registros por usuário e compartilhá-los entre navegadores, mas ele não é um backend de autenticação seguro. A API atual ainda pode ser consultada ou alterada diretamente por quem alcançar `/api`, e o hash do usuário pode ser lido. Portanto, esta configuração é apropriada para demonstração ou homologação privada, sem dados reais. Antes do uso público, implemente uma API autenticada, senhas com hash no servidor, autorização por usuário, HTTPS e cópias de segurança automatizadas.
