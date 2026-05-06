# **Documento de Requisitos e Funcionalidades (PRD)**

**Projeto:** Plataforma de Gestão Financeira Pessoal & Familiar

**Fase Atual:** MVP (Produto Mínimo Viável) com Automação via WhatsApp

## **1\. Visão Geral do Produto**

Um sistema de gestão financeira pessoal completo, prático e de baixíssima fricção. O objetivo principal é erradicar o abandono de uso através de uma interface desenhada para gerar reforço positivo, aliada a um assistente de WhatsApp (via n8n) que automatiza a recolha de despesas através de texto, áudio e imagens, e fornece inteligência financeira de forma conversacional. O sistema contorna as falhas de usabilidade de concorrentes (como "Minhas Finanças") oferecendo automação invisível e design comportamental ativo.

## **2\. Funcionalidades Centrais (Interface do Utilizador)**

### **2.1. Navegação Temporal e Previsibilidade**

* **Visão de Viagem no Tempo:** Interface que permite deslizar e visualizar rapidamente o estado financeiro (saldo projetado, contas a pagar) nos próximos dias, meses ou até mesmo no ano.  
* **A Regra dos 3 Segundos:** O *dashboard* inicial deve responder imediatamente à pergunta: *"Quanto dinheiro real eu tenho hoje e o que mudou desde a última vez?"*, sem exigir interpretação de gráficos complexos.  
* **Busca Inteligente e Filtros:** Motor de busca que aceita termos informais (ex: "restaurante semana passada", "compras acima de 100") para localizar transações instantaneamente.

### **2.2. Gestão de Contas, Cartões e Assinaturas**

* **Contas Diversas e Multimoedas (Novo):** Cadastro, edição e exclusão de contas com suporte a múltiplas moedas e taxas de câmbio personalizáveis (diferencial competitivo extraído da análise de mercado).  
* **Cartões de Crédito Integrados:** Cadastro de cartões com acompanhamento visual do limite disponível e do quanto já foi gasto na fatura atual.  
* **Compras Parceladas Simplificadas:** Fluxo de ecrã altamente intuitivo para adicionar, editar, antecipar ou apagar compras feitas em prestações.  
* **Gestão de Assinaturas e Contas Fixas:** O sistema agrupa pagamentos recorrentes (streaming, ginásio, luz) e notifica o utilizador antes da cobrança ou se detetar aumento anómalo no valor.

### **2.3. Orçamentos e Engenharia Comportamental**

* **Definição de Orçamentos:** Criação de tetos de gastos por categorias imutáveis.  
* **Sinalização de Capacidade de Gasto:** Indicador claro de *"Quanto ainda posso gastar hoje/nesta semana"* dentro do orçamento.  
* **Alertas Positivos (Enquadramento):** Substituição de alertas punitivos por reforços positivos ("Pequenos ajustes agora garantem o sucesso da sua meta") para evitar evasão por vergonha (*Shame Avoidance*).  
* **Viés de Padrão (Default Bias):** Criação automática de metas de proteção e limites dinâmicos com base nos primeiros meses de uso, ativados por predefinição (*opt-in* automático).

### **2.4. Gestão Compartilhada**

* **Perfis de Casais e Família:** Capacidade nativa, estruturada no banco de dados, de convidar parceiros e visualizar painéis conjuntos de despesas e receitas, sem misturar contas de forma irreversível.

### **2.5. Experiência de Uso, Segurança e Retenção**

* **Acessibilidade Universal (Novo):** Otimização rigorosa de contraste de cores, suporte nativo a leitores de tela e formulação empática de mensagens de erro.  
* **Continuidade Multiplataforma (Novo):** Transição fluida (sem disrupção visual) entre a versão mobile e desktop/web para fluxos complexos.  
* **Onboarding de Baixa Fricção:** Acesso imediato à aplicação após o registo inicial (Progressive Profiling).  
* **Modo Escuro Nativo:** Interface com suporte a *Dark Mode* para conforto visual e transmissão de precisão profissional.  
* **Autenticação Biométrica:** Suporte nativo para Face ID/Touch ID (segurança isométrica).  
* **Modo Offline (Local-First):** Registo e leitura de transações mesmo sem internet, sincronizando em background.  
* **Soberania de Dados:** Funcionalidade nativa de exportação do histórico completo (CSV/Excel).

## **3\. Motor de Automação e Inserção (Integração n8n)**

### **3.1. Arquitetura do Assistente de WhatsApp**

* **Entrada Multimodal:** Aceita texto, áudios (transcritos via modelo *Whisper*) e imagens/recibos.  
* **Extração Cirúrgica via IA (Novo):** Utilização de Modelos de Linguagem Extensos (GPT-4o) forçados em formato "JSON Mode" para extrair de recibos rasgados ou prints do Pix estritamente: Nome Comercial Exato (Merchant), Data Limpa e Quantidade Total (expurgando impostos e ruídos visuais).  
* **Processamento Seguro de Mídia (Novo):** Configuração de "Code Nodes" no n8n para traduzir imagens usando buffers nativos (Base64), evitando quebras na infraestrutura ao ler documentos não padronizados.  
* **Interação Reversa / Consultas:** O utilizador pode enviar perguntas no WhatsApp (ex: *"Como está o meu orçamento de lazer?"*) e o sistema devolve uma resposta baseada em banco de dados.

### **3.2. Proteção Operacional e Estabilidade do n8n (Novo)**

* **Prevenção de Loop Infinito:** Algoritmo que rastreia a flag fromMe e o ID global do pacote para garantir que o webhook do n8n não responda às suas próprias mensagens.  
* **Humanização contra Banimento:** Injeção de atrasos lógicos (simulando inércia de digitação) no fluxo de resposta para ocultar o comportamento robótico da "Evolution API" e proteger o número do WhatsApp de bloqueios.  
* **Mecanismo Anticolisão:** Algoritmo que cruza metadados (valor, hash de estabelecimento e intervalo de tempo) para impedir o registo duplicado (ex: áudio seguido de envio de talão).

## **4\. Arquitetura de Dados (Backend e Regras de Negócio)**

### **4.1. Estrutura Contabilística e Integridade**

* **Dupla Entrada para Transferências:** Transações dedicadas a transferências internas para não contaminarem as métricas de receitas/despesas analíticas.  
* **Precisão Matemática Absoluta:** Valores monetários guardados rigorosamente como números inteiros (cêntimos) no banco de dados, eliminando *floating-point errors*.  
* **Banco de Dados Relacional:** PostgreSQL como base sólida, atómica e escalável.

### **4.2. Tecnologia Front-End**

* **Flutter (Single Codebase):** Framework escolhido por possuir tipagem estrita (Dart) para cálculos financeiros precisos e motor de renderização (Impeller) que assegura de 60 a 120 *frames* por segundo, essencial para gráficos e transições responsivas em iOS, Android e Web.

## **5\. Roadmap Estratégico (Evolução da Plataforma)**

### **5.1. Transição de API de Mensageria (Fase 2\)**

* **Migração para Meta Cloud API:** Após a validação comercial do MVP utilizando a Evolution API (custo zero), a infraestrutura do n8n transitará de forma invisível para a API Oficial da Meta ou Provedores Oficiais (BSPs), garantindo estabilidade corporativa a longo prazo.

### **5.2. Integração Open Finance (Fase 2 \- Premium)**

* **Agregadores Bancários (Pluggy/Belvo):** Integração para sincronização automática de saldos e notas de corretagem.  
* **Isolamento de Custos:** Esta funcionalidade será estritamente segregada em um plano "Premium" (assinatura) para cobrir o alto custo unitário (API calls) dos agregadores bancários e o enriquecimento avançado de dados transacionais, mantendo a inserção conversacional básica gratuita ou de baixo custo.