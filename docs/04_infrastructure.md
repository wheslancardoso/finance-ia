# 🌐 Infraestrutura e Persistência

O Vesper Finance utiliza uma estratégia **Cloud-Sync + Local-First**. Isso significa que seus dados estão salvos na nuvem (segurança), mas são lidos e processados localmente (velocidade).

---

## ☁️ Supabase: O Backend na Nuvem

O Supabase é a nossa espinha dorsal de infraestrutura, fornecendo:
*   **PostgreSQL**: Banco de dados relacional robusto.
*   **Auth**: Gerenciamento de usuários e sessões via JWT.
*   **RLS (Row Level Security)**: Garante que um usuário **nunca** consiga ler ou escrever dados de outro usuário, mesmo que conheça o ID.

### Modelo de Dados Principal
As tabelas principais no Supabase seguem uma estrutura relacional clara:
*   `profiles`: Preferências globais e metadados.
*   `accounts`: Contas bancárias e cartões.
*   `transactions`: O registro de todos os movimentos financeiros.
*   `goals`: Objetivos e aportes.
*   `recurring_transactions`: O motor de assinaturas e rendas fixas.

---

## 💾 Dexie.js: Persistência Local (Offline-first)

Para garantir que o app funcione instantaneamente (sem loadings infinitos), utilizamos o **Dexie.js** (um wrapper para o IndexedDB do navegador).

*   **Fluxo de Dados**: Ao carregar o app, buscamos o estado consolidado no Supabase e "espelhamos" tudo no Dexie.
*   **Vantagem**: Todas as navegações entre páginas e cálculos de projeção consultam o Dexie local. Isso elimina a latência de rede e permite o uso offline.

---

## 🔄 Sincronização e Fluxo de Estado

O gerenciamento de dados é orquestrado pelo `FinancialDataContext.tsx`. O ciclo de vida dos dados é:

1.  **Fetch**: O `refreshData` chama a API do Supabase.
2.  **Apply State**: Os dados populam o estado do React (useState).
3.  **Local Sync**: Os dados são salvos em lote no Dexie.js para uso futuro e persistência entre recarregamentos de página.
4.  **Optimistic Updates**: Quando o usuário cria uma transação, tentamos atualizar a UI imediatamente enquanto o Supabase confirma o salvamento.

---

## 🔐 Segurança e RLS

Toda a segurança do banco de dados é baseada no `auth.uid()`.
```sql
-- Exemplo de Política RLS nas transações
CREATE POLICY "Users can only see their own transactions" 
ON transactions FOR SELECT 
USING (auth.uid() = user_id);
```
Isso garante que a segurança esteja na **camada do banco**, e não apenas no código do frontend.

---

## 🏗️ Camada de Serviços (`src/services/`)

A infraestrutura é abstraída pelo `financialService.ts`. Ele atua como um "Gatekeeper", tratando:
*   Chamadas para Edge Functions do Supabase.
*   Tratamento de erros de rede.
*   Formatação de payloads para o banco de dados.

---

> [!NOTE]
> **Performance**: Graças ao Dexie, o Vesper consegue processar milhares de transações e recalcular a Time Machine em menos de 100ms, algo impossível se dependêssemos de chamadas de banco a cada clique.
