# Arquitetura e Engenharia do "Minhas Finanças"

Este documento descreve as descobertas obtidas através da engenharia reversa do APK `Minhas Finanças.apk` (descompilado via `jadx` e explorando o banco de dados SQLite base extraído de seus assets).

A genialidade do app reside na **baixa complexidade de processamento em tempo real** e no uso de padrões de persistência de dados extremamente eficientes. Em vez de calcular projeções usando loops complexos no lado do cliente, o aplicativo delega o peso da lógica para o banco de dados usando **Tabelas de Exceção (Overrides)**.

---

## 1. Stack Tecnológico e Sincronização

- **Offline-First:** O aplicativo é primeiramente offline. Todo o trabalho pesado é feito no SQLite local (`minhasfinancas.db`).
- **Sincronização:** Quando online, ele sincroniza com o Firebase (Firestore) usando um banco local de fila de ações (`firestore_actions.db`). As requisições de salvar/deletar são encapsuladas na classe `FirestoreActionRegistration` e ficam pendentes até o dispositivo ter internet.
- **Desenvolvimento:** Java para Android. Arquitetura em camadas (UI, BLL - Business Logic Layer, DAL - Data Access Layer, Entity).

---

## 2. Padrão de Recorrência ("Tabelas de Exceção")

O maior calcanhar de aquiles de apps financeiros é como projetar contas fixas mensais para o futuro sem causar problemas de performance ou cálculos recursivos errados. O Minhas Finanças resolve isso dividindo a regra em dois casos:

### A. Parceladas (Tipo 'P' / *Installments*)
Transações que têm início e fim definidos (ex: TV em 12x).
- **Abordagem Física:** Quando o usuário cria um parcelamento, o aplicativo **gera N linhas físicas independentes** na tabela principal (`despesas` ou `receitas`).
- **Relacionamento:** Elas são amarradas pelo campo `id_origem` (todas as 12 parcelas compartilham o mesmo `id_origem`), além das colunas `num_parcela` (1, 2, 3...) e `num_parcelas` (total).
- **Vantagem:** Facilita muito. Se você quiser editar apenas a parcela 4, basta dar um `UPDATE despesas WHERE id = ...`. Se você apagar "esta e as próximas", o sistema só roda `DELETE FROM despesas WHERE id_origem = X AND num_parcela >= Y`.

### B. Fixas Mensais (Tipo 'F' / *Fixed*)
Transações que se repetem infinitamente (ex: Conta de Luz, Netflix).
- **A Tabela Base:** Cria-se apenas **UMA única linha** na tabela `despesas`.
- **A Tabela de Exceção:** Para rastrear em quais meses a conta foi paga ou se teve o valor alterado naquele mês, existe uma tabela secundária chamada `despesas_fixas`.
- **Como Funciona:** 
  - Para o sistema saber se a conta de Junho/2026 foi paga, ele busca na tabela `despesas_fixas` para aquele `id_despesa` no mês de Junho.
  - Se você alterou o valor da conta de Julho, o app faz um `INSERT INTO despesas_fixas` com a data de `2026-07-01` e o `valor` atualizado.
  - Nas queries da UI, o app faz algo equivalente a um `COALESCE(despesas_fixas.valor, despesas.valor)`.
- **Vantagem Absoluta:** O cálculo da "Time Machine" e projeções de saldo fica incrivelmente fácil e exato, porque não há motor matemático gerando instâncias fantasmas. Se existe no banco base, ela é cobrada. Se foi paga/alterada, existe uma linha na tabela de exceção correspondente àquele mês. Exatamente o padrão do **Google Calendar**.

---

## 3. Gestão de Cartões de Crédito (Fatura Stateless)

Sistemas modernos frequentemente enfrentam bugs tentando sincronizar tabelas de *Transações* com uma tabela de *Faturas* (`Invoices`).

- **Não existe tabela de Faturas:** O Minhas Finanças **não tem** uma tabela de faturas no banco de dados. 
- **Como a Fatura é Gerada:** As despesas do cartão de crédito são apenas `despesas` comuns onde o `id_cartao_credito` não é vazio, e o status é marcado como `'pd'` (pendente). O app lê a `dia_fecha` e `dia_venc` do cartão e agrupa os valores na memória.
- **O Pagamento da Fatura:** Quando o usuário clica em "Pagar Fatura", o sistema simplesmente:
  1. Cria uma nova **Despesa Comum** na Conta Corrente selecionada com a descrição "Pagamento de Fatura" e status `'pg'` (paga).
  2. Altera o status das transações atreladas àquele mês no cartão de `'pd'` para `'pg'`.
- **Vantagem:** Isso elimina a "camada de sincronia". Cartões e Contas Correntes falam a mesma língua por baixo dos panos e não existe dessincronização de saldo.

---

## 4. Orçamentos e Objetivos

O padrão "Base + Exceção" se estende ao restante do sistema:

### Orçamentos (Budgets)
- **Tabela Base (`orcamentos`):** Onde o limite global do mês é definido.
- **Tabela de Exceção Mensal (`orcamentos_mensal`):** Se em um mês específico o usuário resolve baixar o limite do orçamento de Lazer, uma linha de exceção é gravada para aquele mês no `orcamentos_mensal`.

### Objetivos (Goals)
- **Tabela Base (`objetivos`):** Onde o objetivo está descrito (Ex: Comprar Carro).
- **Aportes (`objetivos_dep`):** As movimentações de depósito ou retirada do objetivo ficam separadas, permitindo histórico de poupança (e até contabilizando juros).

---

## 5. Por que adotar essa arquitetura no Vesper?

Se espelharmos essa abordagem no Vesper (Supabase + Next.js), atingiremos o objetivo de **"zero fricção"**:

1. Deletamos tabelas de estado pesado (como `invoices`).
2. Trocamos funções Javascript puras de simulação no frontend/backend por simples *Left Joins* via Postgres.
3. Facilitaremos absurdamente o estorno de fatura, estorno de mensalidade e o cálculo histórico da *Time Machine* que enfrentou inconsistências nos métodos de array virtuais.
