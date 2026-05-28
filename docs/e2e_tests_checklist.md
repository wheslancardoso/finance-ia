# Plano e Checklist de Testes E2E (Vesper Time Machine & Copilot)

Este documento centraliza o plano de testes ponta a ponta (E2E) para o Vesper, com foco no motor de projeção (Time Machine), nos cenários de sobrevivência, cartões de crédito, regras de crise e inteligência do Copiloto. Use este arquivo para acompanhar a cobertura e marcar os testes à medida que forem implementados.

---

## 🧭 1. Motor de Projeção & Time Machine

### [x] 1.1 Simulação de Empréstimo com Fallback Price
- **Objetivo:** Garantir que simulações de empréstimo (loan) sem taxa de juros preenchida utilizem a taxa Price padrão de 9.53% a.m. e atualizem o dashboard físico.
- **Arquivo:** `tests/e2e/specs/copilot-survival-scenarios.spec.ts`
- **Passos:** Moca empréstimo de R$ 1.400 em 6x, clica em "Simular Caixa" e valida se o valor simulado no card de Compromissos passa a ser R$ 230,00 e o total do caixa atualiza.

### [ ] 1.2 Transbordo de Projeção na Virada de Ano e Meses Bissextos
- **Objetivo:** Validar que as projeções da Time Machine lidam corretamente com a transição de meses no final do ano (Dezembro para Janeiro) e anos bissextos (28/29 de Fevereiro) sem quebras visuais ou desalinhamento de parcelas.
- **Fixture:** Transação recorrente agendada para o dia 29 de cada mês, iniciando em 2028 (ano bissexto).
- **Passos:** Navegar mês a mês pela Time Machine até ultrapassar Fevereiro/2028 e virada de ano 2028/2029. Validar que as transações recorrentes caem nos dias correspondentes sem transbordar para o dia 1 do mês seguinte de forma indevida.

### [ ] 1.3 Coexistência de Múltiplas Simulações Ativas de Naturezas Distintas
- **Objetivo:** Testar se o motor financeiro consolida de forma matematicamente precisa mais de uma simulação rodando ao mesmo tempo (ex. um empréstimo [INCOME] e uma compra parcelada [EXPENSE]).
- **Fixture:** Conta com saldo inicial de R$ 1.000,00.
- **Passos:** Ativar uma simulação de receita (empréstimo de R$ 5.000) e uma de gasto (compra de R$ 2.000). Validar que a linha "Simulado" no card de Compromissos e o "Saldo Projetado" somam/subtraem ambos os valores proporcionalmente na Time Machine.

---

## 💳 2. Cartões de Crédito & Faturas

### [x] 2.1 Cenário de Financiamento por Rotativo de Cartão
- **Objetivo:** Simular o impacto no fluxo de caixa ao optar por pagar apenas o mínimo da fatura de cartão de crédito, empurrando a dívida para o mês seguinte sob taxa de rotativo mockada.
- **Arquivo:** `tests/e2e/specs/copilot-survival-scenarios.spec.ts`
- **Passos:** Moca fatura de R$ 1.500 no cartão Nubank, simula no Copilot o pagamento mínimo gerando R$ 178,50 de encargos rotativos no mês seguinte e valida o impacto nos compromissos totais.

### [ ] 2.2 Reatividade de Limite de Crédito sob Pagamento Parcial/Antecipado
- **Objetivo:** Validar que a UI atualiza dinamicamente o limite de crédito disponível de um cartão quando o usuário registra o pagamento (parcial ou total) de uma fatura antes do fechamento.
- **Fixture:** Cartão com limite de R$ 3.000,00 e fatura em aberto de R$ 1.200,00 (limite disponível de R$ 1.800,00).
- **Passos:** Clicar em "Pagar Fatura" e registrar pagamento parcial de R$ 500,00. Validar que o limite disponível exibido no dashboard sobe para R$ 2.300,00 imediatamente.

### [ ] 2.3 Estorno de Transação e Recálculo Automático da Projeção de Fatura
- **Objetivo:** Garantir que o cancelamento ou estorno de uma compra em cartão recalcula de imediato a fatura futura projetada e o saldo da conta associada.
- **Fixture:** Transação de gasto no cartão mockada no mês corrente.
- **Passos:** Excluir ou marcar como estornada a transação. Acessar a Time Machine e certificar que o total da fatura projetada daquele cartão decresceu pelo valor exato da transação estornada.

---

## ⚠️ 3. Teto Semanal & Regras de Crise

### [x] 3.1 Suspensão Inteligente de Metas sob Crise de Caixa
- **Objetivo:** Garantir que aportes mensais para metas de investimento/poupança sejam zerados automaticamente (suspensos) quando a liquidez líquida real estiver negativa e reativados quando o caixa for reabastecido.
- **Arquivo:** `tests/e2e/specs/copilot-survival-scenarios.spec.ts`
- **Passos:** Iniciar com saldo em conta menor que as saídas previstas, validar que Reservas no card de compromissos fica em R$ 0,00. Adicionar saldo saudável, recarregar e atestar que a meta volta a cobrar o aporte planejado.

### [ ] 3.2 Teto Emergencial sob Despesas Inesperadas
- **Objetivo:** Validar que a barra de "Oxigênio Semanal" (teto de gastos) recalcula e cai para o piso de segurança (R$ 225,00) de forma reativa após a inserção de uma despesa não planejada severa.
- **Fixture:** Estado saudável inicial com saldo de R$ 5.000,00.
- **Passos:** Inserir despesa manual de R$ 4.800,00. Verificar se o indicador "Oxigênio Semanal" atualiza instantaneamente para o valor limite emergencial mínimo.

### [ ] 3.3 Priorização Inteligente de Suspensão de Metas
- **Objetivo:** Testar se o sistema consegue manter ativos os aportes de metas de alta prioridade (Priority #1) enquanto suspende apenas as metas menos prioritárias (Priority #2 e #3) em cenários de aperto de caixa parcial (onde a liquidez não está totalmente no vermelho, mas há déficit parcial).
- **Fixture:** Três metas ativas com contribuições de R$ 100,00 cada (Prioridades #1, #2 e #3). Sobra de caixa projetada de apenas R$ 150,00.
- **Passos:** Acessar o dashboard e verificar que Reservas de metas computa apenas a meta de prioridade #1 (R$ 100,00), suspendendo as demais.

---

## 🤖 4. Vesper Copilot & Integração de IA

### [ ] 4.1 Resiliência com Serviço de IA Indisponível (API Offline)
- **Objetivo:** Blindar a interface de chat do Copiloto contra quedas de conexão ou indisponibilidade da API do Gemini, assegurando que uma mensagem de erro amigável seja exibida sem travar o painel.
- **Fixture:** Rota `/api/chat` configurada para falhar com status 503 (Service Unavailable).
- **Passos:** Enviar mensagem no chat e validar que o painel exibe uma resposta informando sobre a indisponibilidade sem interromper a navegação da UI.

### [ ] 4.2 Injeção Reativa de Fatos da Memória Jarvis no Dashboard
- **Objetivo:** Certificar que os fatos extraídos de conversações passadas com o Copiloto (persistidos no Dexie/Postgres como "fears" ou "preferences") influenciam a renderização de avisos e badges informativos no painel.
- **Fixture:** Fato de medo cadastrado: "Usuário teme estourar cartão Nubank".
- **Passos:** Abrir o Dashboard físico e certificar se um badge discreto de atenção ou teto rigoroso é renderizado sobre a seção da conta do cartão Nubank baseado nas memórias extraídas.

### [ ] 4.3 Agendamento Automatizado de Parcelamento a partir do Chat do Copiloto
- **Objetivo:** Validar que clicar no botão "Confirmar" em um card de simulação interativo no chat insere e agenda de forma efetiva uma série de transações parceladas no banco local do usuário.
- **Fixture:** Chat com uma simulação de compra interativa proposta pelo Copiloto.
- **Passos:** Clicar em "Confirmar" no card interativo. Navegar para a página de Transações e verificar se as parcelas correspondentes foram agendadas perfeitamente para os meses futuros.

---

## 🔒 5. Casos de Borda, UX & Offline

### [ ] 5.1 Sincronização offline-first via Dexie e Supabase
- **Objetivo:** Garantir a consistência de dados offline. Transações cadastradas offline devem persistir localmente no Dexie e serem enviadas para o Supabase assim que a rede retornar.
- **Passos:** Simular perda de rede (page.route interceptando e falhando todas as conexões de API). Inserir transação e validar presença na tela local. Restaurar rede e certificar que a transação foi disparada com sucesso para o banco de dados remoto.

### [ ] 5.2 Validação de Inputs Extremos e Sanitização de Formulários
- **Objetivo:** Evitar que o motor de cálculo quebre ao tentar lidar com valores fora da realidade (ex. inputs com letras, caracteres especiais, valores exorbitantes de bilhões ou parcelamentos negativos).
- **Passos:** Preencher o simulador ou formulário de transações com "-100", "abc" ou "9999999999999999". Garantir que os validadores bloqueiem a submissão e tratem o valor com segurança (mantendo os campos íntegros ou exibindo avisos de validação legíveis).
