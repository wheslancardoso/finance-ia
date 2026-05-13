# 🧪 Estratégia de Testes e Qualidade

No Vesper Finance, acreditamos que **código sem teste não está pronto**. Dada a natureza crítica de lidar com dinheiro e projeções futuras, implementamos uma das suítes de testes mais rigorosas para projetos deste porte.

---

## 🏛️ A Pirâmide de Testes

Seguimos uma estrutura de três níveis para garantir cobertura total com eficiência:

1.  **Testes Unitários (Jest/Vitest)**: Focam na lógica pura do `src/domain/financial/financial-logic.ts`. Eles garantem que as fórmulas matemáticas de liquidez e projeção estejam corretas isoladamente.
2.  **Testes de Integração**: Validam a comunicação entre o `FinancialDataContext` e o cache local `Dexie.js`.
3.  **Testes E2E (Playwright)**: O nível mais alto. Simulamos o usuário real navegando no Chrome, Safari e Mobile para garantir que todos os fluxos (Login, Time Machine, Cadastro de Contas) funcionem em harmonia.

---

## 🎭 Playwright e Padrão POM

Utilizamos o **Page Object Model (POM)** para manter os testes limpos e fáceis de manter.
*   **Separação de Conceitos**: Os seletores de CSS/TestID ficam em classes de "Page" (ex: `DashboardPage.ts`), enquanto o arquivo de teste (`.spec.ts`) foca apenas no comportamento do usuário.
*   **Vantagem**: Se mudarmos a cor de um botão ou um ID no HTML, atualizamos em apenas um lugar.

---

## 🃏 Mocking de Dados Financeiros

Para que os testes sejam determinísticos e rápidos, não dependemos do banco de dados real durante a execução da suíte de testes.
*   **`setupFinancialMocks`**: Uma ferramenta customizada que intercepta as chamadas de API e injeta estados financeiros pré-definidos (ex: "Usuário em Crise", "Usuário com Metas Concluídas").
*   **Isolamento**: Isso permite testar cenários de "daqui a 6 meses" instantaneamente, sem precisar esperar o tempo passar de verdade.

---

## 🏗️ Suítes de Teste Principais

Atualmente, o projeto conta com **66 testes automatizados** divididos em:
*   **Dashboard & Time Machine**: Valida se a liquidez muda corretamente ao trocar de mês.
*   **Gestão de Metas**: Garante que aportes reduzam a liquidez e atualizem a data de conclusão.
*   **Fluxo de Migração**: Testa o parcelamento de dívidas e ajuste de faturas.
*   **Cenários de Borda (Edge Cases)**: Como o app reage a erros 500 da API ou falta de internet.

---

## 🚦 Quality Gates (Husky & Hooks)

A qualidade é imposta por automação:
*   **Pre-commit**: Antes de cada commit, o Husky roda o Linter para garantir padrões de código.
*   **Pre-push**: Antes de enviar o código para o repositório, a suíte completa de testes Playwright é executada. Se um único teste falhar, o push é bloqueado.

---

## 📈 Comandos Úteis

```bash
npx playwright test           # Roda todos os testes (headless)
npx playwright test --ui      # Abre a interface visual do Playwright (debug)
npx playwright show-report    # Mostra o relatório detalhado da última execução
```

---

> [!IMPORTANT]
> **Regra de Ouro**: Um bug encontrado em produção deve resultar em: 1) Um novo teste que reproduza o bug, 2) A correção do bug, 3) A validação de que o novo teste agora passa.
