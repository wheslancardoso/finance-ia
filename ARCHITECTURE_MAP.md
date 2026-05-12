# 🗺️ Mapa Arquitetural: Finance-IA

Este diagrama ilustra como as diferentes camadas e componentes do sistema interagem entre si.

```mermaid
graph TD
    subgraph "Camada de Apresentação (UI)"
        Dashboard[Realtime Dashboard]
        HUD[Survival HUD]
        Goals[Goals Manager]
        Modals[Transaction Modals]
    end

    subgraph "Camada de Aplicação (Contextos/Hooks)"
        FinData[FinancialDataContext]
        AuthCtx[AuthContext]
        Analysis[useFinancialAnalysis]
    end

    subgraph "Camada de Domínio (Business Logic)"
        Logic[financial-logic.ts]
        Entities[Types & Interfaces]
    end

    subgraph "Camada de Infraestrutura"
        Supa[Supabase Client]
        Mocks[Mock Identity System]
    end

    %% Fluxo de Dados
    Dashboard --> FinData
    HUD --> Analysis
    Analysis --> Logic
    FinData --> Supa
    AuthCtx --> Supa
    Supa --> Mocks
    
    %% Relacionamentos
    Logic --> Entities
    FinData --> Logic
```

### Fluxo de Inteligência Financeira:
1. **Dados Brutos:** O `FinancialDataContext` busca dados das tabelas `accounts`, `transactions` e `goals` no Supabase.
2. **Processamento:** O hook `useFinancialAnalysis` envia esses dados para o `financial-logic.ts` (Domínio).
3. **Cálculo:** O motor calcula a liquidez líquida e decide se o usuário está em "Survival Mode".
4. **Visualização:** O `SurvivalHUD` recebe o status e muda a cor de toda a interface para alertar o usuário.
