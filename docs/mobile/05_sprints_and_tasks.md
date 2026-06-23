# 05. Mapeamento Exhaustivo de Sprints e Tasks (Mobile Migration)

Este documento destrincha de forma cirúrgica e exaustiva **todos os componentes, lógicas financeiras e fluxos de UX** existentes no atual projeto Vesper Web (Next.js) para a sua transição exata ao Mobile (React Native / Expo). O objetivo é paridade de 100%, sem deixar nenhuma feature para trás.

---

## 🏃 Sprint 1: Infraestrutura Core, Database Local e Sync Assíncrono
**Foco:** Garantir que o aplicativo ligue, faça login, crie o banco de dados local com espelhamento perfeito das tabelas, e sincronize com a nuvem sem travar a interface.

### Tasks:
- `[ ]` **1.1. Setup do Projeto e Arquitetura Base**
  - Inicializar projeto com `expo-template-blank-typescript` e `expo-router`.
  - Configurar NativeWind v4 e replicar o Design System (cores `zinc`, `violet`, `emerald`, fontes `Inter` e `Space Grotesk`).
  - Configurar estrutura de pastas: `src/app`, `src/components`, `src/domain`, `src/store`.
- `[ ]` **1.2. Módulo de Autenticação (Supabase Mobile)**
  - Configurar cliente Supabase utilizando `AsyncStorage` (ou `SecureStore`) para persistência de tokens JWT.
  - Migrar telas de SignIn/SignUp.
  - Implementar tranca biométrica (`expo-local-authentication`) acionada via AppState (ao colocar o app em background e voltar).
- `[ ]` **1.3. Banco de Dados Local-First (Substituto do Dexie)**
  - Implementar `expo-sqlite/next` com tipagem estrita de tabelas.
  - Criar o `schema.sql` local replicando: `users`, `accounts`, `categories`, `transactions`, `goals`, `recurring_transactions`.
  - Criar classe `LocalDBAdapter` com métodos assíncronos de CRUD e queries otimizadas.
- `[ ]` **1.4. Engine de Sincronização (Fila / Queue)**
  - Criar tabela `sync_queue` no SQLite para armazenar operações feitas offline.
  - Construir serviço em background (Background Fetch) para consumir a `sync_queue` enviando mutações ao Supabase de 15 em 15 minutos (ou ao reconectar).
  - Algoritmo de resolução de conflitos baseado no `updated_at` (Last-Write-Wins).

---

## 🏃 Sprint 2: Motor Financeiro $O(1)$ e Gerenciamento Global de Estado
**Foco:** Migrar a matemática pesada (fluxo de caixa, O(1) snapshots, Time Machine) do Web para o celular e distribuir via Zustand.

### Tasks:
- `[ ]` **2.1. Store Global (Zustand)**
  - Criar Store `useFinancialStore` substituindo o `FinancialDataContext.tsx`.
  - Distribuir em slices: `createTransactionSlice`, `createAccountSlice`, `createGoalSlice`.
- `[ ]` **2.2. Portabilidade dos Motores (src/domain/financial/)**
  - Replicar código-fonte idêntico para as lógicas fundamentais: `financial-logic.ts`, `buildHorizonSnapshot.ts`.
  - Assegurar que cálculos de saldo projetado, limite de crédito e "Cartões Usados" (`projectedTotalDebt`) permaneçam 100% acurados e executem isolados da UI Thread.
- `[ ]` **2.3. Gestor de Categorias e Contas**
  - Migrar componente `AddAccountModal` para `AddAccountSheet` (Bottom Sheet).
  - Migrar `CategoryManagerSettings` para uma Native Screen (`CategoriesScreen`).
  - Lógica de "Categorias Fantasmas": Respeitar propriedades `ignore_dashboard`, `ignore_reports`, `ignore_balance` nas queries do SQLite.
- `[ ]` **2.4. Navegação do Tempo (MonthNavigator)**
  - Criar componente `MonthSwiper` no topo da tela inicial.
  - Detectar gestos laterais (Swipe) usando `react-native-gesture-handler` para avançar/retroceder meses (Time Machine) ativando o recalculo do `buildHorizonSnapshot`.

---

## 🏃 Sprint 3: Home Dashboard, Sobrevivência e Extrato
**Foco:** Construir a tela principal (Dashboard) e a aba de transações com alta performance. Replicar todos os componentes visuais principais da tela inicial.

### Tasks:
- `[ ]` **3.1. Tela Inicial (HomeScreen - RealtimeDashboard)**
  - Migrar `UnifiedSurvivalHeader` e `FinanceBridgeHUD`.
  - Recriar o **SurvivalHUD (Crisis Mode)**: Utilizar `react-native-reanimated` para animar a borda da tela/header (verde para vermelho em caso de crise) e chamar Haptic Feedback (`expo-haptics`).
  - Migrar cartões informativos: `WeeklySurvivalCard`, `BillCommitmentCard`, `DashboardStatsGrid`.
- `[ ]` **3.2. Visão Excel Mensal**
  - Converter `MonthlyConsolidatedExcel.tsx` em uma Tabela visual (View nativa com scroll horizontal) para exibir Receitas, Despesas e Sobra projetada mensal com exatidão.
- `[ ]` **3.3. Aba de Transações (TransactionsScreen)**
  - Migrar `TransactionsContent.tsx` e `TransactionTimeline.tsx`.
  - Usar `@shopify/flash-list` para garantir 60fps no scroll de listas grandes.
  - Implementar o `TransactionItem` com gestos de deslizar:
    - Swipe para a Direita: Marcar como Pago (`StatusModal.tsx` virando um Action Nativo).
    - Swipe para a Esquerda: Apagar (`TransactionDeleteModal` vira `Alert.alert` de dupla confirmação).

---

## 🏃 Sprint 4: The Money Input (Modais de Adição e Paridade de Epics)
**Foco:** Converter os formulários complexos da Web em Bottom Sheets mobile otimizados, incluindo recursos dos Epics 1, 3 e 4 (Splits, Reembolsos, Juros).

### Tasks:
- `[ ]` **4.1. Sheet de Transações (AddTransactionSheet)**
  - Substituir o gigante `AddTransactionModal.tsx`.
  - Layout dividido com teclado numérico embutido e inputs customizados (sem quebrar ao abrir o teclado virtual nativo).
  - Switchs para tipos de transação (Entrada/Saída).
- `[ ]` **4.2. O Epic 3 & 4: Reembolsos, Juros e Descontos**
  - Implementar Switch nativo: "Isto é um Reembolso?". Se true, abrir modal secundário com lista de despesas recentes, gravando `linked_transaction_id`.
  - Inputs dropdowns extras (Accordion nativo) para `interest_cents` (Multas) e `discount_cents` (Descontos).
- `[ ]` **4.3. Split de Transações**
  - Migrar a lógica de `AddTransactionModal.tsx` que divide 1 valor em N sub-transações.
  - UX mobile: Botão "+ Dividir", que divide o campo de Valor de forma dinâmica no Sheet.
- `[ ]` **4.4. Transações Recorrentes e Assinaturas**
  - Migrar `AddSubscriptionModal.tsx` para `SubscriptionSheet`.
  - Migrar `SubscriptionManager.tsx` para uma aba ou Native Screen nas configurações.
- `[ ]` **4.5. Sheet de Transferências**
  - Migrar `TransferModal.tsx` garantindo a criação simultânea de Saída(Conta A) e Entrada(Conta B).

---

## 🏃 Sprint 5: Cartões de Crédito e Metas Gamificadas
**Foco:** Refinar o modelo Stateless de faturas, e portar o gestor de cofres (Goals) do Vesper.

### Tasks:
- `[ ]` **5.1. Parcelamentos e Amortização (Epic 4)**
  - Migrar `InstallmentTimelineModal.tsx` para `InstallmentTimelineSheet`.
  - UX do botão "Antecipar p/ Hoje" em faturas futuras (Amortização). Ao clicar, processa a mutação na `date` e `is_amortized = true`.
- `[ ]` **5.2. Quitação de Faturas**
  - Migrar `PayInvoiceModal.tsx` para `PayInvoiceSheet`. Tela rápida para transferir dinheiro da Conta Corrente liquidando uma fatura de crédito específica.
- `[ ]` **5.3. Dashboard e Gerenciador de Metas (Goals)**
  - Migrar `GoalsManager.tsx` para a Aba *Metas*.
  - Migrar `GoalRecommendations.tsx` e `GoalDetailModal.tsx` para Native Screens.
  - Animar a barra de progresso das Metas ao aplicar um aporte (migrar lógica do `ContributionModal.tsx` para um Sheet de contribuição em 1 clique).
- `[ ]` **5.4. Gráficos de Análise (Charts)**
  - Portar `IncomeMixChart.tsx`, `SpendingChart.tsx` e `NetWorthEvolutionChart.tsx` utilizando bibliotecas gráficas compatíveis (`react-native-svg` ou `@shopify/react-native-skia`).

---

## 🏃 Sprint 6: Vesper Copilot e The Mobile End-Game (Epic 5)
**Objetivo Final:** Transpor a IA do Next.js para o Mobile e implementar os diferenciais exclusivos dos sistemas operacionais móveis.

### Tasks:
- `[ ]` **6.1. Interface Copilot (AICopilotChat & CopilotChatPanel)**
  - Criar Tela dedicada (Aba Central) para a IA.
  - Implementar UI de Chat com FlashList invertida.
  - Migrar lógica de Parser de Tags XML (`<vesper-simulation>`) transformando em Cards Nativos interativos (com os botões "Simular Caixa" e "Criar Meta" funcionais no mobile).
- `[ ]` **6.2. Jarvis Long-Term Memory**
  - Migrar o painel expansível de memória ("Jarvis Lembra de 12 fatos").
  - Ler e exibir as categorias de medos, perfil, e metas diretamente da API de chat do Supabase.
- `[ ]` **6.3. Leitura Passiva de Extrato (Notification Eavesdropping)** *(Funcionalidade Nova Padrão Minhas Finanças)*
  - Construir/Integrar módulo Expo Native para leitura de Background Notifications (`android.permission.BIND_NOTIFICATION_LISTENER_SERVICE`).
  - Lógica: Interceptar push das palavras "aprovada", "Pix recebido", "Transferência".
  - Enviar string ao backend/IA de categorização offline. Inserir silenciosamente no banco SQLite como "pending_review".
- `[ ]` **6.4. Fechamento de Mês e Smart Match**
  - Criar tela de "Auditoria Mensal".
  - Feature onde usuário cola o Extrato do Banco, e a tela realiza o *Diff Checker* com as transações do Vesper.
  - Exibir botão verde escuro "Lacrar Mês" (gerando uma transação de reconciliação para igualar o saldo à força, protegendo a SST).
- `[ ]` **6.5. Configurações de Perfil e Perfumaria Final**
  - Migrar `UserProfileSettings.tsx` e `WhatsAppSettings.tsx`.
  - Revisão visual final em devices variados (Safe Area Views, entalhes de iPhone, Teclados).
  - Publicação nas lojas virtuais via `eas submit`.
