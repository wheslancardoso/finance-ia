# ADR-004: Ajuste Inteligente de Faturas e Fluxo de Migração

**Status:** Aceito
**Data:** 13/05/2026

## Contexto
O usuário está migrando de outro aplicativo e possui faturas em diferentes estados (algumas fechadas em Maio, outras abertas para Junho). O sistema atual automatiza o ciclo de faturas, mas carece de uma forma simples de:
1. Conciliar o valor da fatura atual com o extrato bancário sem registrar todas as transações passadas.
2. Marcar faturas do mês de migração como já liquidadas para não impactar a liquidez futura.

## Decisão
Implementaremos o conceito de **"Transação de Ajuste de Fatura"** e melhoraremos o **"Fluxo de Inicialização de Cartão"**.

- Será um tipo especial de transação vinculada obrigatoriamente a uma `invoice_id`.
- Permitirá valores positivos ou negativos para "zerar" ou "corrigir" o saldo da fatura.
- **Regra de Ouro**: O ajuste pertence exclusivamente à fatura vinculada. Mesmo que a transação seja criada hoje, se ela for vinculada a uma fatura de Maio (fechada), ela não afetará o saldo de Junho.
- **Impacto**: O `amount_cents` da fatura será a soma de todas as transações vinculadas + o ajuste.

### 2. Fluxo de Migração de Cartões
Ao cadastrar um novo cartão:
- O sistema gerará automaticamente a fatura do mês atual baseada no `closing_day`.
- O usuário terá a opção de marcar a fatura do mês de migração como **"Já Paga"** (is_paid: true), mesmo sem transações vinculadas. Isso evita que o saldo de R$ 695 seja "comido" por uma dívida que já saiu do banco antes da migração.

### 3. Parcelamentos Futuros
- Ao registrar uma despesa parcelada, o usuário poderá definir a **"Parcela de Início"**.
- Ex: Se ele já pagou 5 de 10 parcelas, ele registra a transação com 10 parcelas, mas marca que a próxima a ser cobrada é a 6ª, vinculando-a à primeira fatura aberta (Junho).

## Consequências
- **Prós**: Maior flexibilidade na migração, facilidade de manter o app sincronizado com o banco (ajuste manual).
- **Contras**: Adiciona uma pequena complexidade na lógica de cálculo de faturas (precisa somar os ajustes).

## Implementação Técnica
- Adicionar campo `is_adjustment` na tabela `transactions`.
- Criar interface na UI de "Cartões" para realizar esse ajuste.
