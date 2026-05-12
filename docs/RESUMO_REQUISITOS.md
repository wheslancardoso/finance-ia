# 📋 Resumo de Requisitos — Vesper Finance

Este documento consolida as funcionalidades e objetivos centrais do sistema, baseando-se na documentação detalhada em `/docs`.

### 🎯 Visão Geral
- **Experiência Premium**: Sistema completo, prático e de baixíssima fricção, focado em evitar o abandono do usuário através de design comportamental e automação inteligente.

### ⏳ Navegação e Projeções (Viagem no Tempo)
- **Navegação Temporal**: Capacidade de visualizar gastos e saldo projetado nos próximos dias, meses e até anos através de uma interface de "viagem no tempo".
- **Resposta Rápida**: O dashboard deve permitir entender o estado financeiro atual em menos de 3 segundos.

### 💳 Gestão de Cartões e Parcelamentos
- **Controle de Cartões**: Cadastro de cartões de crédito com visualização clara do limite disponível e do total já gasto na fatura.
- **Parcelamentos Inteligentes**: Fluxo intuitivo para adicionar, editar, antecipar ou excluir compras parceladas, com impacto automático nas faturas futuras.

### 📅 Assinaturas e Gastos Fixos (/subscriptions)
- **Recorrências**: Registro e gestão centralizada de receitas e gastos recorrentes (assinaturas, aluguel, salários).
- **Previsibilidade**: Integração automática desses valores nas projeções de fluxo de caixa futuro.

### 📊 Orçamentos e Controle de Gastos
- **Definição de Tetos**: Criar orçamentos por categorias para limitar gastos.
- **Capacidade de Gasto**: Mostrar claramente o "Quanto ainda posso gastar hoje/esta semana" para não estourar o orçamento.
- **Alertas Positivos**: Sistema de avisos que utiliza reforço positivo em vez de punição para manter o usuário engajado.

### 🤖 Automação e Inteligência (n8n + WhatsApp)
- **Entrada Multimodal**: Registro de transações via WhatsApp através de texto, áudio (transcrito via IA) e fotos de recibos/comprovantes.
- **Processamento via IA**: Uso de GPT-4o para extração precisa de dados de recibos e áudios.
- **Consultas Conversacionais**: Poder perguntar ao assistente no WhatsApp sobre o estado dos orçamentos ou gastos recentes.

### 🏦 Contas e Integridade
- **Gestão de Contas**: Poder cadastrar, editar e excluir contas bancárias e carteiras.
- **Suporte Multimoedas**: Gestão de contas em diferentes moedas com conversão automática.
- **Precisão Centesimal**: Todos os cálculos são feitos em centavos (inteiros) para evitar erros de arredondamento.

### 👥 Gestão Compartilhada
- [/] **Modo Família/Casal**: Infraestrutura iniciada (pendente finalização de UI e convites).

### 🎯 Objetivos e Simulador de Compras (/goals)
- [x] **Alocação Inteligente**: Sugestão de aportes baseada em liquidez.
- [x] **Simulador de Gastos**: Funcionalidade central estabilizada.
- [x] **Validação de Teto**: Sistema de recomendação (Comprar vs. Aguardar) funcional.

### 📱 Experiência e Tecnologia
- [x] **Local-First (Offline)**: Implementado via Dexie.js.
- [x] **Modo Escuro**: Nativo na interface.
- [/] **Exportação de Dados**: No roadmap de próximos passos.
