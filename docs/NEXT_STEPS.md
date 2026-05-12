# Próximos Passos (Roadmap de Evolução)

Com a base técnica estabilizada e a suíte de testes garantindo a integridade dos cálculos, o foco da Vesper agora se volta para inteligência, segurança e acabamento premium.

## 🔴 PRIORIDADE 1: Prontidão para Migração (Migration Ready)
*Estes itens são essenciais para que você possa abandonar seu app atual e confiar seus dados reais à Vesper.*

- [ ] **Autenticação Real (Supabase Auth)**:
    - Substituir o sistema de `user_id` manual no `localStorage` por login real (E-mail/Senha ou Google).
    - Garantir que cada usuário tenha seu "espaço" isolado no banco de dados.
- [ ] **Persistência em Nuvem (PostgreSQL Sync)**:
    - Finalizar a migração de todos os serviços (`financialService.ts`) para que os dados não fiquem apenas no navegador (Dexie), mas sejam sincronizados com o Supabase.
- [ ] **Importador de Dados**:
    - Criar ferramenta para importar extratos em formato CSV ou OFX para evitar digitação manual de histórico.
- [ ] **Criptografia de Dados Sensíveis**:
    - Garantir que nomes de contas e descrições de transações sejam tratados com privacidade.

## 2. Inteligência Financeira & Auditoria
- [ ] **Priorização de Dívidas**: Implementar lógica para sugerir quais faturas ou dívidas devem ser quitadas primeiro com base no custo de juros vs. liquidez.
- [ ] **Auditoria de Transações**: Criar uma tela dedicada para conciliação bancária (bater o saldo real com o projetado).
- [ ] **Alertas Preditivos**: Notificar o usuário caso uma transação agendada vá furar o "Teto de Sobrevivência" no futuro.

## 3. UI/UX & Responsividade (Premium Brutalist)
- [ ] **Refinamento Mobile**: Finalizar a adaptação de todas as tabelas e modais para telas 320px+ (iPhone SE).
- [ ] **Micro-interações**: Adicionar animações de transição (`framer-motion`) entre as páginas e feedback tátil em botões.
- [ ] **Modo Escuro Dinâmico**: Ajustar cores baseadas no horário ou preferência do sistema.

## 4. Relatórios & Exportação
- [ ] **PDF de Fechamento**: Gerar um sumário mensal de "Saúde Financeira" em PDF.
- [ ] **Gráficos de Tendência**: Implementar visualização de linha do tempo para patrimônio líquido (Net Worth) vs. Dívida Consolidada.

## 5. Expansão de Testes
- [ ] **Visual Regression**: Adicionar testes de regressão visual com Playwright para evitar quebras de layout mobile.
- [ ] **Unit Tests (Cálculos)**: Adicionar Jest para testar isoladamente as funções matemáticas em `lib/financial-logic.ts`.

---
*Este roadmap é um documento vivo e deve ser atualizado conforme novas prioridades surgirem.*
