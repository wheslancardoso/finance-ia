# Mapa de Portabilidade: Web para Mobile (Expo)

Este documento serve como um guia para portar as funcionalidades e o design da versão Web (Next.js) para a versão Mobile (Expo/React Native) do projeto **Vesper (finance-ia)**.

## 1. Arquitetura de Rotas (Páginas)

| Rota Web (Next.js) | Rota Mobile (Expo Router) | Descrição | Status |
| :--- | :--- | :--- | :--- |
| `/login` | `/login` | Autenticação (Login/Cadastro) | [x] |
| `/` | `/(app)/index` | Dashboard Principal (Visão Geral) | [/] |
| `/accounts` | `/(app)/accounts` | Gestão de Contas e Cartões | [ ] |
| `/transactions` | `/(app)/transactions` | Extrato e Linha do Tempo | [ ] |
| `/goals` | `/(app)/goals` | Objetivos e Recomendações | [ ] |
| `/subscriptions` | `/(app)/subscriptions` | Assinaturas e Parcelamentos | [ ] |
| `/reports` | `/(app)/reports` | Relatórios e Gráficos | [ ] |
| `/settings` | `/(app)/settings` | Configurações e Perfil | [ ] |

## 2. Mapa de Componentes (UI/UX)

Para manter a paridade visual, os componentes mobile devem seguir a estética "Glassmorphism" da web usando `NativeWind` (Tailwind).

### A. Layout e Navegação
| Componente Web | Equivalente Mobile | Notas de Portabilidade |
| :--- | :--- | :--- |
| `AppShell.tsx` | `app/(app)/_layout.tsx` | Container principal com AuthGate. |
| `Sidebar.tsx` | `components/Navigation/Drawer` | No mobile, usar Drawer ou Tab Bar. |
| `MobileNav.tsx` | `components/Navigation/TabBar` | Barra inferior para navegação rápida. |
| `MobileHeader.tsx` | `components/UI/Header` | Título da página e perfil. |
| `GlassCard.tsx` | `components/UI/GlassCard` | View com `BlurView` (Expo) e bordas finas. |

### B. Core e Dashboard
| Componente Web | Componente Mobile Sugerido | Lógica |
| :--- | :--- | :--- |
| `RealtimeDashboard.tsx` | `screens/DashboardScreen` | Orquestrador principal de dados. |
| `AccountCard.tsx` | `components/Accounts/AccountCard` | Visual de cartão de crédito/bancário. |
| `SurvivalHUD.tsx` | `components/Dashboard/SurvivalHUD` | Indicadores de "Teto de Sobrevivência". |
| `FinanceBridgeHUD.tsx` | `components/Dashboard/BridgeHUD` | Status de conexão e sincronização. |

### C. Transações e Finanças
| Componente Web | Componente Mobile Sugerido | Notas |
| :--- | :--- | :--- |
| `TransactionItem.tsx` | `components/Transactions/TransactionItem` | Lista otimizada (FlashList). |
| `TransactionTimeline.tsx` | `components/Transactions/Timeline` | Scroll vertical com indicadores de data. |
| `AddTransactionModal.tsx` | `components/Modals/TransactionForm` | Formulário com DatePicker nativo. |
| `PayInvoiceModal.tsx` | `components/Modals/InvoicePayment` | Fluxo de pagamento de fatura. |

### D. Planejamento e IA
| Componente Web | Componente Mobile Sugerido | Notas |
| :--- | :--- | :--- |
| `SpendingSimulator.tsx` | `components/AI/SpendingSimulator` | Simulador de impacto financeiro. |
| `GoalsManager.tsx` | `components/Goals/GoalsManager` | Barra de progresso e metas. |
| `SpendingCapacity.tsx` | `components/Dashboard/Capacity` | Gráfico de "Poder de Gasto". |

## 3. Lógica Compartilhada (Core)

Estes arquivos podem ser portados quase integralmente, removendo apenas dependências específicas de Node.js se houver.

*   **Services:** `src/services/financialService.ts` (Lógica de cálculo de saldos, faturas e projeções).
*   **Hooks:** `src/hooks/useFinancialAnalysis.ts` (Agrega dados para os gráficos).
*   **Utils:** `src/utils/supabase/client.ts` (Configurar para usar `@supabase/supabase-js` com persistência local no mobile).

## 4. Desafios de Design (Web vs Mobile)

1.  **Glassmorphism:** No mobile, use o componente `BlurView` do `expo-blur`. O `backdrop-filter: blur` do CSS não funciona nativamente no Android sem bibliotecas extras.
2.  **Gráficos:** Substituir as bibliotecas web por `react-native-wagmi-charts` ou `react-native-gifted-charts` para melhor performance.
3.  **Modais:** No web usamos diálogos Radix. No mobile, prefira `gorhom/bottom-sheet` para uma experiência mais nativa.
4.  **Toque vs Clique:** Aumentar áreas de clique (mínimo 44x44px) e adicionar feedback tátil (Haptics).

## 5. Próximos Passos Sugeridos

1.  **Configurar Supabase Mobile:** Garantir que o `AsyncStorage` está configurado no cliente Supabase.
2.  **Portar `financialService`:** Mover a lógica de cálculo para uma pasta compartilhada ou replicar em `mobile/src/services`.
3.  **Criar o `SurvivalHUD` Mobile:** É o componente visual mais crítico para a identidade do app.
