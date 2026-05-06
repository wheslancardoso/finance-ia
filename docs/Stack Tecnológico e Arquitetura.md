# **Documentação de Stack Tecnológico e Arquitetura**

**Projeto:** Plataforma de Gestão Financeira Pessoal (App Nativo / Uso Pessoal)

**Foco:** Aplicativo Móvel Real, Estética "Liquid Glass", Alta Performance e Automação de Inserção via WhatsApp.

Este documento define as tecnologias que serão utilizadas para construir o sistema. O foco absoluto é a entrega de um **aplicativo móvel verdadeiro** (instalável no telemóvel, com acesso profundo a hardware como Face ID/Touch ID) otimizado para o uso individual do criador.

## **1\. Camada de Apresentação (Front-End Mobile)**

**Stack Escolhida:** React Native (com framework Expo) \+ React Native Reanimated \+ Expo Blur.

### **Por que esta é a melhor tecnologia para um App "Liquid Glass"?**

1. **React Native com Expo (O Padrão da Indústria):** Permite construir um aplicativo móvel verdadeiro (compilado para código nativo) de forma extremamente rápida. O Expo facilita o acesso à biometria, câmara e armazenamento local (essencial para o Modo Offline) sem a complexidade de gerir código nativo em Java ou Swift.  
2. **O Motor do Liquid Glass (expo-blur):** Para atingir a estética de vidro refratado que a Apple utiliza no visionOS e iOS, usaremos a biblioteca nativa expo-blur. Ela invoca os motores de desfoque nativos do próprio telemóvel (usando aceleração de GPU), garantindo que os "cartões de vidro" da interface sejam desenhados com perfeição e sem esgotar a bateria.  
3. **Física e Fluidez (react-native-reanimated):** O design *Liquid Glass* exige que os elementos não sejam estáticos. Esta biblioteca permite criar animações baseadas em física de molas (*spring physics*). Quando tocar num botão de vidro, este afundará e voltará de forma orgânica e responsiva a 60-120 *frames* por segundo, correndo diretamente na *thread* de interface (UI Thread) do telemóvel para evitar qualquer engasgo.  
4. **Tailwind CSS (NativeWind):** Usaremos o NativeWind para aplicar a estilização de forma rápida, aproveitando o poder do Tailwind CSS diretamente no aplicativo nativo.

## **2\. Camada de Dados e Backend (Back-End)**

O sistema requer uma base transacional inquebrável, com capacidade de responder rapidamente às consultas do aplicativo e às injeções automatizadas vindas do WhatsApp (n8n).

**Banco de Dados Principal:** PostgreSQL

* **Justificativa:** É o padrão ouro para sistemas financeiros. Garante as propriedades ACID (Atomicidade, Consistência, Isolamento e Durabilidade).  
* **Regras Implementadas:** Tipagem BIGINT (cêntimos) para valores monetários e UUIDs para evitar colisão de dados no modo *offline-first*.

**Camada de API / Backend as a Service (BaaS):** Supabase

* **Justificativa:** O Supabase é a alternativa open-source definitiva ao Firebase, construída inteiramente sobre PostgreSQL. Fornece autenticação segura e *WebSockets* (se enviar uma despesa pelo WhatsApp, o gráfico na tela do seu aplicativo React Native atualiza no mesmo milissegundo, sem precisar fechar e abrir a app).

## **3\. Motor de Automação e Orquestração (Middleware)**

A camada invisível que torna a aplicação numa experiência conversacional contínua.

**Orquestrador de Fluxos:** n8n (Auto-hospedado)

* **Justificativa:** Plataforma visual extremamente poderosa para ligar o WhatsApp, a IA e o Supabase. Por ser de uso próprio, pode processar quantos recibos quiser sem pagar taxas abusivas por execução.

**Conexão WhatsApp:** Evolution API

* **Justificativa:** Contorna as burocracias do WhatsApp Oficial. Apenas lê um QR Code com o seu número, e a Evolution API transforma o seu WhatsApp num canal seguro para o n8n capturar as mensagens financeiras.

## **4\. Camada Cognitiva e Inteligência Artificial**

Para a extração cirúrgica de dados não estruturados de áudios e fotografias.

**Processamento de Imagens e Recibos:** OpenAI GPT-4o (Vision)

* **Implementação:** Configurado com *System Prompts* rigorosos em formato *JSON Mode*.  
* **Justificativa:** O GPT-4o lê uma foto mal tirada de um recibo e extrai apenas o estabelecimento, a data e o valor bruto, ignorando ruídos.

**Processamento de Áudio:** OpenAI Whisper

* **Justificativa:** Transcreve áudios enviados no WhatsApp (ex: "Gastei 50 euros no Uber") com perfeição cirúrgica, entregando o texto ao n8n para categorização.

## **5\. Resumo da Arquitetura do Sistema (O Caminho do Dado)**

1. O utilizador envia um áudio ou foto de fatura no **WhatsApp**.  
2. A **Evolution API** capta a mensagem e dispara um evento silencioso para o **n8n**.  
3. O **n8n** envia os dados/imagem para a **OpenAI (GPT-4o/Whisper)** com ordem de extração em JSON.  
4. O **n8n** recebe os dados matemáticos limpos e injeta-os no banco de dados **PostgreSQL (via Supabase)**.  
5. O **Supabase** dispara um sinal em tempo real para o aplicativo móvel.  
6. A interface nativa em **React Native**, estilizada com elementos *Liquid Glass*, atualiza instantaneamente os saldos na palma da sua mão.