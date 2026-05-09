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
- **Modo Família/Casal**: Suporte nativo para convidar parceiros e visualizar painéis conjuntos de despesas sem comprometer a individualidade das contas.

### 🎯 Objetivos e Simulador de Compras (/goals)
- **Alocação Inteligente**: O sistema deve sugerir quanto aportar mensalmente em cada objetivo com base na saúde financeira real, priorizando metas de forma dinâmica.
- **Simulador de Gastos (Anti-Emoção)**: Funcionalidade inovadora para simular uma compra ou gasto planejado.
- **Validação de Teto**: O sistema avisa se a compra pretendida ultrapassa o teto de gastos ou se prejudica a economia para outros objetivos.
- **Conselheiro Financeiro**: Se não for recomendado comprar agora, o sistema informa **quando** será seguro realizar esse gasto, incentivando a criação de um objetivo específico e a poupança até a data ideal.

### 📱 Experiência e Tecnologia
- **Local-First (Offline)**: Funciona mesmo sem internet, sincronizando os dados em background.
- **Modo Escuro e Biometria**: Interface moderna com suporte a Dark Mode e autenticação por Face ID/Touch ID.
- **Exportação de Dados**: Funcionalidade nativa para exportar todo o histórico em CSV/Excel.
