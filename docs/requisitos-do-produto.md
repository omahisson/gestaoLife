# GestaoLife

Visão Geral do Projeto

### Por que estamos construindo?

O projeto **GestaoLife** está sendo desenvolvido com o objetivo de ajudar usuários a gerenciar aspectos importantes da rotina em um único ambiente. A aplicação permitirá acompanhar despesas financeiras diárias, estabelecer metas(Ex: Parei de perdir ifood, tempo 3dias 5horas...) por meio de um calendário.

Além do registro das atividades realizadas, a proposta é permitir que o usuário visualize o impacto financeiro dos pequenos gastos realizados durante o mês.

### Para quem estamos construindo?

O GestaoLife é direcionado principalmente para **pessoas que possuem dificuldade de organização financeira**, especialmente aquelas que têm dificuldade em perceber como pequenos gastos frequentes afetam seu orçamento ao longo do mês.

A aplicação também busca atender pessoas que desejam se organizar de maneira simples e visual.

### Para que serve o que estamos construindo?

A aplicação serve para facilitar o acompanhamento da rotina e das finanças pessoais.

No aspecto financeiro, o usuário poderá registrar suas despesas e visualizar projeções de quanto poderá gastar até o fechamento do seu ciclo financeiro mensal.

Dessa forma, o GestaoLife busca reunir **organização financeira em uma única interface**.

---

#  Definição do Produto

## Categoria

Aplicação web voltada para **educação financeira e organização pessoal**.

## Produto

**GestaoLife**

## Proposta do produto

O GestaoLife é uma aplicação que auxilia pessoas a terem um gerenciamento mais simples da vida financeira.

A proposta é permitir que o usuário consiga visualizar, em um mesmo ambiente, seus gastos, previsões financeiras.

## Desafio do projeto

O principal desafio será desenvolver uma aplicação que concentre diferentes informações sem tornar a interface complexa.

Por esse motivo, o GestaoLife deverá possuir um **design clean, intuitivo e de fácil utilização**, permitindo que o usuário compreenda rapidamente sua situação financeira e sua rotina.

---

# Visão Geral do Projeto

O GestaoLife será uma aplicação web de organização financeira baseada principalmente em um calendário.

Por meio dele, o usuário poderá visualizar sua rotina nas perspectivas **diária, semanal e mensal**, acompanhando as despesas registradas.

Um dos principais diferenciais da aplicação será a possibilidade de criar **projeções de gastos**. Em vez de apresentar somente quanto já foi gasto, o sistema utilizará as informações fornecidas pelo usuário para estimar quanto determinada despesa poderá representar até o fechamento do ciclo financeiro.

Por exemplo, se uma pessoa costuma gastar determinado valor diariamente, o sistema poderá projetar quanto esse comportamento representará até o final daquele período.

---

# Descrição do Projeto

O GestaoLife combina funcionalidades de **controle financeiro pessoal

O usuário definirá inicialmente o dia que considera como fechamento do seu mês financeiro, normalmente relacionado ao dia em que recebe seu salário ou realiza o fechamento das contas.

A partir dessa informação, o sistema poderá calcular projeções de gastos considerando o período restante.

As despesas serão registradas diretamente no calendário e poderão possuir diferentes tipos de recorrência, como diária, semanal, mensal, personalizada ou avulsa.

Além disso, despesas recorrentes anteriormente cadastradas poderão ser reutilizadas, permitindo que o sistema acompanhe quantas ocorrências daquela despesa ainda são esperadas durante o período.

---

# Público-alvo

O público-alvo do GestaoLife é composto principalmente por:

- Pessoas com dificuldade de organização pessoal;
    
- Pessoas que possuem pouco controle sobre pequenas despesas cotidianas;
    
- Pessoas que desejam compreender melhor para onde seu dinheiro está sendo destinado;

---

# Escopo

Será desenvolvida uma **aplicação web de gerenciamento financeiro baseada em calendário**.

O usuário poderá registrar seus gastos diariamente, identificar onde seu dinheiro está sendo utilizado e visualizar uma previsão de gastos até o fechamento do seu mês financeiro.

---

# Principais atributos e emoções desejados

A identidade e a experiência da aplicação deverão transmitir principalmente:

- **Educacional:** ajudar o usuário a compreender seus hábitos;
    
- **Profissional:** possuir uma interface organizada e consistente;
    
- **Financeiro:** apresentar claramente informações relacionadas a gastos e projeções;
    
- **Confiável:** transmitir segurança e clareza nas informações apresentadas.
    

---

# SiteMap

## 1. Login / Primeiro acesso

No primeiro acesso, o usuário deverá informar sua **data de fechamento financeiro**.

Essa data representa o dia utilizado como referência para calcular suas projeções mensais.

Por exemplo:

> Recebimento ou fechamento das contas: dia 30.

Essa configuração poderá posteriormente ser alterada pelo usuário.

---

## 2. Calendário

O calendário será a principal interface da aplicação.

Ele possuirá três formas de visualização:

- diária;
    
- semanal;
    
- mensal.
    

O sistema deverá salvar a última visualização utilizada pelo usuário para que, ao retornar à aplicação, ela seja aberta novamente.

---

## 3. Visualização diária

Na visualização diária serão apresentadas as informações detalhadas daquele dia.

Entre elas estarão:

- despesas realizadas;

Também haverá a opção:

**Cadastrar despesa**

---

## 4. Cadastro de despesa

Para registrar uma nova despesa, o usuário deverá informar:

**Nome da despesa**

Exemplo:

> Almoço

**Valor**

Exemplo:

> R$ 25,00

**Meio de pagamento**

Opções:

- Pix;
    
- Dinheiro;
    
- Cartão.
    

Caso utilize cartão, será possível cadastrar cartões utilizando apenas uma identificação textual definida pelo próprio usuário.

Exemplo:

> Cartão Amex do Julio

Não será necessário cadastrar informações bancárias ou números do cartão.

---

## 5. Projeção da despesa

Durante o cadastro da despesa, o usuário poderá informar como acredita que aquele gasto irá se repetir durante seu ciclo financeiro.

### Despesa diária

O sistema considera que aquela despesa poderá ocorrer todos os dias restantes até o fechamento.

Exemplo:

Dia atual: 20  
Fechamento: 30  
Despesa: R$ 20

Projeção:

10 × R$ 20 = **R$ 200**

### Despesa semanal

O sistema considera que aquela despesa ocorrerá aproximadamente uma vez por semana até o fechamento do período.

### Despesa mensal

O sistema considera uma ocorrência mensal daquela despesa.

### Projeção personalizada

O usuário poderá informar manualmente quantas vezes acredita que aquela despesa ainda ocorrerá.

Exemplo:

> Essa despesa deverá acontecer mais 4 vezes.

### Despesa avulsa

A despesa não terá previsão de repetição.

Será contabilizado somente o gasto realizado naquele momento.

---

# Controle de repetição das despesas

Quando uma despesa possuir previsão de repetição, essa informação será armazenada no banco de dados.

Por exemplo:

> Restaurante X  
> Previsao de quantidade de repeticao: diaria/semanal/avulsa/personalizada
> Previsão restante para este mes: 3 vezes.

Quando o usuário cadastrar uma nova despesa em outro dia e começar a digitar o nome, o sistema apresentará sugestões de despesas anteriormente cadastradas.

Exemplo:

O usuário começa a digitar:

> Res...

O sistema poderá apresentar:

> Restaurante X  
> Previsão restante: 3 vezes

As opções serão filtradas conforme o usuário continuar digitando.

Caso ele selecione essa despesa novamente, o sistema atualizará automaticamente a quantidade prevista.

Antes:

> Restaurante X  
> Restam 3 ocorrências previstas.

Depois do novo registro:

> Restaurante X  
> Restam 2 ocorrências previstas.

Esse mecanismo permitirá comparar gradualmente a **previsão feita pelo usuário com seus gastos reais**.

---

# Visualização semanal

Na visualização semanal, o usuário visualizará os dias da semana e o total financeiro registrado em cada dia.

Exemplo:

|Dia|Total gasto|
|---|--:|
|Segunda|R$ 45|
|Terça|R$ 82|
|Quarta|R$ 20|
|Quinta|R$ 65|
|Sexta|R$ 110|

A visualização permitirá identificar rapidamente os dias com maior volume de gastos.

---

# Visualização mensal

Na visualização mensal será apresentado o calendário completo do mês.

Cada dia apresentará de maneira resumida o valor total gasto.

Por exemplo:

> 12  
> R$ 47,00

> 13  
> R$ 82,00

> 14  
> R$ 21,00

Ao selecionar um dia, o usuário poderá acessar sua visualização diária e consultar os detalhes das despesas e tarefas.