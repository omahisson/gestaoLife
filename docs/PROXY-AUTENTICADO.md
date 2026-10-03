# Proxy autenticado para aplicações externas

O proxy é um serviço Squid separado do Gestão Life. Ele não passa pelo Nginx,
não acessa o SQLite e não participa do deploy normal da aplicação. O serviço
aceita somente tráfego HTTP e túneis HTTPS (`CONNECT`) nas portas de destino 80
e 443, sempre com autenticação.

## Dados públicos

- protocolo no cliente: proxy HTTP;
- endereço recomendado: `gestaolife.duckdns.org`;
- porta padrão: `3128`;
- login padrão: `proxyuser`.

Prefira o domínio ao IP, porque o DuckDNS acompanha mudanças no endereço da
VPS. A senha existe somente em `/etc/squid/gestaolife.passwd`, com leitura
restrita ao serviço Squid.

## Preparação única

Após o commit chegar ao workspace do Jenkins, entre na VPS por SSH e execute:

```sh
sudo sh /var/lib/jenkins/workspace/gestao-life/infra/preparar-proxy proxyuser 3128
```

O comando solicitará a senha duas vezes sem exibi-la. Use uma senha longa,
aleatória e exclusiva. O instalador:

1. instala `squid` e `apache2-utils` pelos pacotes oficiais do Debian;
2. cria o hash bcrypt da senha fora do repositório;
3. bloqueia destinos locais e redes privadas;
4. desabilita o cache de conteúdo;
5. valida a configuração antes de reiniciar o serviço.

## Firewall

O instalador não abre o firewall automaticamente. Se a aplicação terceira
possuir IP fixo e a VPS usar UFW, libere somente esse endereço:

```sh
sudo ufw allow from IP_DA_APLICACAO to any port 3128 proto tcp
```

Também faça a mesma liberação no firewall do provedor da VPS, caso exista. Só
use uma regra aberta para toda a internet quando a aplicação não tiver IP fixo
e depois de avaliar o risco de tentativas de senha.

## Teste fora da VPS

Em outra máquina, execute o comando abaixo. O `curl` pedirá a senha sem incluí-la
na linha de comando:

```sh
curl --proxy http://gestaolife.duckdns.org:3128 --proxy-user proxyuser https://api.ipify.org
```

O resultado deve ser o IP público da VPS.

## Operação

Consultar o serviço e os registros:

```sh
sudo systemctl status squid --no-pager
sudo journalctl -u squid -n 50 --no-pager
sudo tail -f /var/log/squid/access.log
```

Trocar a senha sem alterar o Git:

```sh
sudo htpasswd -B -C 12 /etc/squid/gestaolife.passwd proxyuser
sudo systemctl reload squid
```

O proxy usa autenticação Basic na conexão com o Squid. O conteúdo de sites
HTTPS continua protegido pelo túnel TLS até o destino, mas a autenticação entre
a aplicação e o proxy não possui uma camada TLS própria. Sempre que possível,
restrinja a porta ao IP da aplicação cliente ou use uma VPN entre os dois.
