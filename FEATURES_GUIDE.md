# 🚀 Guia Detalhado de Funcionalidades

Este guia explica o funcionamento "sob o capô" de cada módulo do Finance-IA.

---

## 💎 1. Dashboard & Survival HUD
O Dashboard não apenas mostra números, ele interpreta a sua realidade.
- **O HUD:** Se o seu saldo projetado para o fim do mês for menor que suas dívidas acumuladas, o HUD entra em **Modo Crítico (Vermelho)**.
- **Sincronização Live:** Utiliza `Supabase Realtime` para atualizar saldos instantaneamente quando uma transação é inserida via celular ou outro dispositivo.

## 🎯 2. Gestão de Metas (Goals)
As metas possuem inteligência de priorização:
- **Aporte Automático:** O sistema sugere quanto você deve guardar por mês para atingir o prazo.
- **Segurança de Compra:** Uma meta só é marcada como "Segura para Compra" se o valor estiver completo **e** o seu fluxo de caixa mensal estiver positivo.
- **Status de Risco:** Se você entrar em modo de sobrevivência, o sistema recomenda a "Pausa de Aporte" para preservar o caixa.

## 🔄 3. Assinaturas e Fluxos Fixos (Subscriptions)
Diferente de transações comuns, as assinaturas são **projetadas**:
- **Impacto no Futuro:** O sistema olha para o dia de vencimento e reserva esse dinheiro no seu "Saldo Disponível" mesmo antes de você pagar.
- **Agrupamento por Categoria:** Permite ver quanto do seu salário está "preso" em serviços recorrentes.

## 💳 4. Contas e Cartões (Accounts)
- **Contas Correntes:** Saldo direto que compõe a liquidez imediata.
- **Cartões de Crédito:** O sistema trata o limite utilizado como uma "Dívida Futura" que abate diretamente da sua liquidez projetada, evitando a surpresa da fatura no fim do mês.

## 📝 5. Transações e Parcelamentos
- **Parcelamento Inteligente:** Ao inserir uma compra parcelada, o sistema gera automaticamente a projeção das parcelas nos meses futuros para o cálculo de saúde financeira.
- **Categorização Automática:** Facilita a visualização de onde o dinheiro está saindo através de gráficos de pizza e barras.

---

## 🛠️ 6. Configurações e Perfil
- **Meta de Reserva:** Definição de quanto o usuário deseja ter de "fundo de emergência".
- **Integração WhatsApp:** (Em desenvolvimento) Notificações de gastos e alertas de modo de sobrevivência via bot.
