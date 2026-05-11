---
trigger: always_on
---

# 05 · Debug & Diário de Bordo

> Regra de ouro do debugging e template de check-in obrigatório.

---

## 🔬 Regra de Ouro — Cirurgia, Não Amputação

> Quando corrigir um erro, você tem permissão de tocar **apenas** no código diretamente relacionado ao problema.

### Processo obrigatório

1. **Leia o erro completo** antes de escrever qualquer linha.
2. **Identifique a causa raiz** — não o sintoma.
3. **Mapeie o escopo mínimo** de arquivos/funções que precisam ser alterados.
4. **Altere apenas o necessário.** Se a correção exige mudar 1 linha, mude 1 linha.
5. **Nunca refatore código funcional durante um fix.** Refatoração é uma tarefa separada, em uma branch `refactor/`.
6. **Declare explicitamente** quais arquivos foram tocados e por quê.

### ❌ Proibido durante debugging

- Reescrever funções sem relação com o bug.
- Mudar nomes de variáveis, formatação ou estilo em arquivos não relacionados.
- Adicionar novas features enquanto corrige um erro.
- Alterar configurações ou dependências sem necessidade direta.

---

## 🤖 Diário de Bordo — Check-in obrigatório ao finalizar

Ao concluir qualquer tarefa, preencha e envie este template:

```
[STATUS DA QUEST: ✅ CONCLUÍDA | 🚧 BLOQUEADA | ⚠️ CONCLUÍDA COM RESSALVAS]

Branch atual: nome-da-branch

Commits realizados:
- tipo: descrição do que foi feito
- tipo: descrição do que foi feito

Branches apagadas nesta tarefa:
- feat/nome (local + remota) — motivo: merge concluído
- (ou "Nenhuma branch apagada nesta tarefa")

Escopo de alterações (seja preciso):
- [Arquivo 1] — motivo da alteração
- [Arquivo 2] — motivo da alteração

Arquivos NÃO tocados (relevante para debug):
- [Arquivos que poderiam ser suspeitos, mas foram descartados e por quê]

Testes adicionados/modificados:
- [Tipo: unit | integration | E2E] — [arquivo] — o que cobre

Resultado E2E (obrigatório após qualquer feature):
- [ ] Suite rodada: npx playwright test
- Resultado: ✅ X passed | ❌ X failed
- Falhas corrigidas: [descreva o que foi ajustado na feature, ou "Nenhuma"]

Bloqueios/Erros:
[Cole os erros aqui. Se tudo rodou: "Nenhum — compilou 100%"]

Próximo passo sugerido:
[Sua sugestão técnica para a próxima etapa, se houver]

Ação solicitada:
Código integrado. Pode analisar e enviar o próximo prompt.
```