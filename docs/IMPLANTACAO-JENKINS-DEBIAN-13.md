# Implantação do Gestão Life com Jenkins no Debian 13

Este procedimento instala o frontend no Nginx, mantém o JSON Server como um serviço do `systemd` e usa o Jenkins para validar e implantar a aplicação. O banco persistente fica em `/var/lib/gestaolife/db.json` e não é sobrescrito nos próximos builds.

## 1. Acessar e conferir a VPS

Na sua máquina:

```bash
ssh root@74.208.102.177
```

Na VPS:

```bash
free -h
df -h
```

Se houver menos de 2 GB de memória e a VPS ainda não tiver swap, crie 1 GB:

```bash
fallocate -l 1G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

## 2. Instalar Node.js, Nginx e utilitários

O Node.js do Debian 13 atende ao requisito do Vite 8.

```bash
apt update
apt install -y ca-certificates curl gnupg git nginx nodejs npm rsync openssh-client sudo
npm install -g pnpm@11.19.0
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

Limite a memória e faça o Jenkins escutar somente no endereço local:

```bash
systemctl edit jenkins
```

Insira:

```ini
[Service]
Environment="JAVA_OPTS=-Djava.awt.headless=true -Xms128m -Xmx384m -XX:+UseSerialGC"
Environment="JENKINS_OPTS=--httpListenAddress=127.0.0.1"
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
ssh -L 8080:127.0.0.1:8080 root@74.208.102.177
```

Acesse `http://localhost:8080`. Para obter a senha inicial, execute na VPS:

```bash
cat /var/lib/jenkins/secrets/initialAdminPassword
```

Instale somente os complementos necessários: **Pipeline**, **Git**, **Credentials** e **SSH Credentials**. Em **Manage Jenkins > Nodes > Built-In Node > Configure**, mantenha apenas **1 executor**.

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
sudo -u jenkins env GIT_SSH_COMMAND='ssh -i /var/lib/jenkins/.ssh/gestaolife -o IdentitiesOnly=yes' git clone git@github.com:omahisson/gestaoLife.git /var/lib/jenkins/gestaoLife-bootstrap
useradd --system --home-dir /var/lib/gestaolife --create-home --shell /usr/sbin/nologin gestaolife
install -m 0755 /var/lib/jenkins/gestaoLife-bootstrap/infra/deploy-gestaolife /usr/local/sbin/deploy-gestaolife
install -m 0644 /var/lib/jenkins/gestaoLife-bootstrap/infra/gestaolife-api.service /etc/systemd/system/gestaolife-api.service
install -m 0644 /var/lib/jenkins/gestaoLife-bootstrap/infra/nginx-gestaolife.conf /etc/nginx/sites-available/gestaolife
ln -s /etc/nginx/sites-available/gestaolife /etc/nginx/sites-enabled/gestaolife
rm -f /etc/nginx/sites-enabled/default
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

## 8. Criar o pipeline no Jenkins

1. Clique em **New Item**.
2. Use exatamente o nome `gestao-life` e selecione **Pipeline**.
3. Em **Pipeline**, escolha **Pipeline script from SCM**.
4. Em **SCM**, escolha **Git**.
5. Use a URL `git@github.com:omahisson/gestaoLife.git`.
6. Selecione a credencial `github-gestaolife`.
7. Em branch, use `*/main`.
8. Em Script Path, use `Jenkinsfile`.
9. Salve e clique em **Build Now**.

Se quiser verificação automática sem expor o Jenkins ao GitHub, habilite **Poll SCM** com `H/5 * * * *`. O Jenkins verificará o repositório aproximadamente a cada cinco minutos.

## 9. Verificar a implantação

Na VPS:

```bash
systemctl status jenkins gestaolife-api nginx --no-pager
curl -I http://127.0.0.1:3001/usuarios
curl -I http://74.208.102.177
journalctl -u gestaolife-api -n 50 --no-pager
```

A aplicação ficará disponível em `http://74.208.102.177`. No firewall da provedora, deixe abertas somente as portas 22 e 80 neste primeiro momento. Não abra 3001 nem 8080.

## 10. Operação e cópia de segurança

Antes de uma alteração importante, faça uma cópia do banco:

```bash
install -m 0600 /var/lib/gestaolife/db.json "/root/gestaolife-$(date +%F-%H%M).json"
```

Para acompanhar os serviços:

```bash
journalctl -u jenkins -f
journalctl -u gestaolife-api -f
```

## Limite de segurança da versão 1.0

O JSON Server permite separar os registros por usuário e compartilhá-los entre navegadores, mas ele não é um backend de autenticação seguro. A API atual ainda pode ser consultada ou alterada diretamente por quem alcançar `/api`, e o hash do usuário pode ser lido. Portanto, esta configuração é apropriada para demonstração ou homologação privada, sem dados reais. Antes do uso público, implemente uma API autenticada, senhas com hash no servidor, autorização por usuário, HTTPS e cópias de segurança automatizadas.
