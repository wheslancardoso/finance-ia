# 🌟 Sistema Vesper - Resumo de Requisitos

Este documento resume as funcionalidades essenciais do Vesper Finance, focado em praticidade, automação e controle emocional financeiro.

### 🎯 Experiência do Usuário
- **Simplicidade**: O sistema deve ser completo, porém prático e fácil de usar no dia a dia.
- **Dashboard Imediato**: Visibilidade instantânea da saúde financeira.

### ⏳ Projeções e Navegação Temporal
- **Viagem no Tempo**: Interface que permite navegar e ver previsões de gastos para os próximos dias, meses e até anos.
- **Fluxo de Caixa Futuro**: Visualização antecipada de saldos com base em gastos fixos e parcelados.

### 💳 Gestão de Cartões de Crédito
- **Controle Total**: Cadastro de cartões com acompanhamento do limite e do valor total já gasto em cada fatura.
- **Parcelamento Inteligente**: Facilidade extrema para adicionar, editar ou remover compras parceladas, com o sistema distribuindo as parcelas automaticamente pelos meses seguintes.

### 📊 Orçamentos e Teto de Gastos
- **Definição de Orçamento**: Possibilidade de definir limites de gastos por categoria.
- **Indicador de Disponibilidade**: Mostrar claramente o quanto o usuário ainda pode gastar no período para não estourar o orçamento (Capacidade de Gasto).
- **Alertas**: Avisos automáticos quando o usuário se aproxima ou ultrapassa o limite definido.

### 🤖 Automação e Input (n8n)
- **WhatsApp Integrado**: Registro de transações via chat.
- **Multimodalidade**: Suporte para entrada manual, áudios (transcritos e processados por IA) e fotos de comprovantes.

### 🏦 Gestão de Contas
- **Flexibilidade**: Poder cadastrar, editar e excluir diferentes contas bancárias e carteiras de forma simples.

### 📅 Assinaturas e Gastos Fixos ([/subscriptions](http://localhost:3000/subscriptions))
- **Recorrência**: Central para registrar receitas e gastos que se repetem (assinaturas, aluguel, salários).
- **Integração**: Estes valores alimentam automaticamente as projeções de meses futuros.

### 🎯 Objetivos e Simulador "Anti-Emoção" ([/goals](http://localhost:3000/goals))
- **Gestão de Metas**: Definir objetivos (viagens, reserva de emergência, compras) e gerenciar aportes.
- **Simulador de Gastos**: Antes de comprar algo, o usuário simula o gasto no app.
- **Validação de Teto**: O sistema verifica se a compra ultrapassa o teto de gastos ou se vai impedir de atingir os objetivos traçados.
- **Aviso de Recomendação**: O sistema avisa se a compra é recomendada ou não para aquele momento, sugerindo quando seria o momento ideal para comprar se o orçamento estiver apertado.
