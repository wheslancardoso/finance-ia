# Próxima Implementação: Auditoria de Autenticação e Perfil

Agora que o histórico de transações está 100% coberto, o próximo passo é garantir a integridade do sistema de Autenticação (simulado) e a persistência do perfil do usuário.

## 🎯 Objetivos
1. Validar a troca de usuários via LocalStorage.
2. Garantir que as configurações de perfil (Renda Mensal, Gastos Fixos) persistem corretamente.
3. Testar o redirecionamento ou bloqueio de acesso quando não há um `user_id` válido.

## 🛠️ Plano de Ação
- [ ] Criar `tests/auth-profile.test.ts`.
- [ ] Instrumentar componentes de Perfil (se necessário).
- [ ] Implementar cenários de persistência de dados no LocalStorage.
- [ ] Validar re-hidratação do estado após reload da página.

---
*Status: 6 fluxos core cobertos com sucesso.*
