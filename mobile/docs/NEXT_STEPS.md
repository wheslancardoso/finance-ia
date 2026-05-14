# Próximos Passos - Vesper Mobile 🚀

Este documento detalha o roadmap para alcançar a paridade total com a versão Web, mantendo o rigor técnico e a estética premium.

## 🛠️ 1. Infraestrutura e Qualidade (Prioridade Imediata)
- [x] **Fix Babel/Reanimated Test Error**: Resolver o erro `While processing: ...react-native-reanimated/plugin/index.js` que está impedindo a execução dos testes no Jest.
- [x] **Setup CI**: Configurar GitHub Actions para rodar os testes unitários do mobile a cada push.
- [x] **Configuração de Temas**: Extrair as cores do Vesper (Emerald/Dark) para um arquivo de tema centralizado no NativeWind.

## 📱 2. Paridade de Funcionalidades
- [x] **Tela de Contas e Cartões**: Criar a visualização de saldos consolidados e limites de cartão (`app/accounts.tsx`).
- [x] **Modais Natas**: Implementar os modais de "Adicionar Transação" e "Transferência" usando o `BottomSheet` nativo para uma experiência mais fluida.
- [x] **Time Machine Mobile**: Portar os gráficos de projeção financeira (usando `react-native-wagmi-charts`).
- [ ] **Metas (Goals)**: Replicar os cards de progresso de metas.

## ✨ 3. Refinamento de UX
- [ ] **Haptic Feedback**: Adicionar vibrações táteis (Taptic Engine) ao marcar transações como pagas.
- [ ] **Skeletons**: Implementar estados de carregamento elegantes para o Dashboard e Lista de Transações.
- [ ] **Filtros Avançados**: Implementar a busca e filtragem de transações por período/categoria.

---
**Status Atual**: Fundação sólida, Dashboard funcional com dados reais, primeiro teste unitário criado.
