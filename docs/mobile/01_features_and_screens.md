# 01. Mapeamento de Features e Telas (Web -> Mobile)

Este documento mapeia todas as funcionalidades do Vesper Finance IA Web para sua respectiva estrutura em um aplicativo Mobile (React Native / Expo).

## 🧭 Estrutura de Navegação (React Navigation)

A navegação será dividida em uma arquitetura híbrida de **Bottom Tabs** (para acesso rápido) e **Native Stacks** (para fluxos profundos e modais).

### Bottom Tab Navigator (Navegação Principal)
As abas inferiores do app devem focar nas ações cotidianas de maior relevância:
1. **Home (Dashboard):** Visão geral, HUD de Sobrevivência, Time Machine.
2. **Transactions:** Listagem rápida e Timeline.
3. **Add (+):** Um botão flutuante central nas tabs (Floating Action Button) que sobe um Action Sheet rápido: Nova Transação, Nova Meta, Pagar Fatura.
4. **Goals:** Painel de metas e simulador.
5. **Copilot:** Acesso rápido ao assistente de IA Soberana.

### Stack Navigator (Fluxos Profundos)
Telas que são empilhadas sobre as abas:
- **Profile / Settings:** Configurações do usuário, categorias, WhatsApp Sync.
- **Subscriptions Manager:** Gerenciador de assinaturas.
- **Invoice Detail:** Detalhamento da fatura de cartão de crédito.
- **Simulator Flow:** Tela cheia para o simulador de impacto de compras.

---

## 📱 De-Para: Telas e Componentes

| Web Component / Route | Solução Mobile | UX Pattern |
|---|---|---|
| `RealtimeDashboard.tsx` | `HomeScreen` | ScrollView nativo. Pull-to-refresh para forçar sync. |
| `SurvivalHUD.tsx` | `SurvivalHUDComponent` | View fixa no topo animada via Reanimated ao rolar. |
| `MonthNavigator.tsx` | `MonthSwiper` | Swipe lateral em um pager (react-native-pager-view). |
| `TransactionsContent.tsx` | `TransactionsScreen` | `FlashList` (Shopify) para performance com centenas de itens. |
| `AddTransactionModal.tsx` | `AddTransactionSheet` | **Bottom Sheet** expansível (`@gorhom/bottom-sheet`) com snap points. |
| `GoalsManager.tsx` | `GoalsScreen` | Lista com cards em Grid (2 colunas) ou lista vertical. |
| `GoalDetailModal.tsx` | `GoalDetailScreen` | Native Stack Screen (empilhada, com botão voltar nativo). |
| `PayInvoiceModal.tsx` | `PayInvoiceSheet` | Bottom Sheet rápido com slider de valor. |
| `ThirdParties` | `ThirdPartyScreen` | Native Stack view para listagem de contatos/devedores. |

---

## 🏗️ Adaptação de Modais para Bottom Sheets

No ambiente web, modais centralizados funcionam bem. No mobile, eles prejudicam a ergonomia se contiverem muitos campos.
- Modais rápidos de confirmação (`ConfirmModal.tsx`, `TransactionDeleteModal.tsx`) tornam-se alertas nativos (`Alert.alert()`).
- Formulários complexos (`AddTransactionModal`, `AddSubscriptionModal`) tornam-se **Bottom Sheets**. O teclado abre nativamente, e o layout sobe junto (usando `KeyboardAvoidingView` ou react-native-keyboard-controller).
