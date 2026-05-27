# ADR-008: Motor de Recorrência Multi-Frequência de Precisão Calendária

**Status:** Aceito  
**Contexto:**  
A gestão financeira preditiva do Vesper Finance apoia-se fortemente na projeção precisa de fluxos de caixa futuros através da Time Machine. Contudo, despesas e receitas recorrentes com prazos inferiores a um mês (como despesas semanais de lazer e corte de cabelo quinzenal) eram forçadas pelo sistema a serem projetadas e criadas sob uma frequência puramente "mensal" aproximada. 

Essa aproximação estática de "R$ 100/mês" para um gasto quinzenal falha nos meses de 5 semanas (onde ocorrem 3 despesas/cortes em vez de 2), abrindo rombos silenciosos no fluxo de caixa real projetado na Time Machine. Havia a necessidade de suportar recorrências semanais, quinzenais (biweekly) e anuais com cálculo de calendário real na projeção acumulada e permitir sua configuração na interface do usuário (UI).

---

## Decisão

Ficou decidido estender o motor de recorrências e a interface do usuário do Vesper Finance para dar suporte nativo e preciso a múltiplas frequências no calendário:

1.  **Extensão do Modelo de Dados:**
    *   Atualizar a tipagem de `RecurringTransaction` no Dexie (`src/lib/db.ts`) e o mapeamento de tipos no motor de projeção (`src/utils/finance-projections.ts`) para incluir a frequência `"biweekly"` (quinzenal).
2.  **Lógica do Calendário Real na Time Machine:**
    *   Atualizar a função de projeção `advanceDate` em `src/utils/finance-projections.ts` para computar saltos quinzenais precisos de 14 dias:
        `case "biweekly": return addDays(date, 14);`
    *   Desta forma, a Time Machine calculará em tempo real os dias exatos de cada recorrência ao longo dos meses futuros, provisionando de forma 100% fiel se um mês terá 2 ou 3 ocorrências de gastos quinzenais, e 4 ou 5 ocorrências de gastos semanais.
3.  **Upgrade da Interface do Usuário (UI):**
    *   Integrar um seletor de frequência elegante (dropdown/seleção customizada de vidro fosco) no modal de criação e edição de fluxos recorrentes [AddSubscriptionModal.tsx](file:///home/lan/finance-ia/src/components/AddSubscriptionModal.tsx).
    *   Exibir a etiqueta com a frequência ativa (ex: *Mensal*, *Quinzenal*, *Semanal*, *Anual*) em cada card do gerenciador de assinaturas [SubscriptionManager.tsx](file:///home/lan/finance-ia/src/components/SubscriptionManager.tsx).

---

## Consequências

### Prós:
*   **Precisão Centesimal Previsiva:** A Time Machine e as projeções acumuladas do Dashboard ganham exatidão matemática irrefutável frente ao calendário real de dias, zerando gargalos surpresa em meses mais longos.
*   **Melhoria de UX/UI Significativa:** O usuário ganha a agência completa para modelar despesas fragmentadas do seu dia a dia (cabelo, lazer de fim de semana, diaristas quinzenais) exatamente como ocorrem no mundo real.
*   **Sem Alterações Destrutivas:** O uso de strings flexíveis no Supabase e a extensão de tipos no Dexie garantem 100% de retrocompatibilidade com o banco de dados atual, dispensando migrações críticas locais de IndexedDB.

### Contras:
*   Pequeno acréscimo de complexidade no cálculo preditivo da Time Machine, que agora itera por intervalos dinâmicos de 7 e 14 dias além do salto mensal padrão (computado eficientemente em TypeScript puro na memória com latência zero).
