---
trigger: always_on
---

# 04 · Git Workflow

> Convenções de branches, commits e **obrigações de limpeza**.

---

## 🌳 Estrutura de Branches

Sempre crie uma branch a partir de `main` (ou `develop`) antes de iniciar qualquer etapa.

| Prefixo | Uso | Exemplo |
|---|---|---|
| `setup/` | Configurações iniciais | `setup/spring-boot-base` |
| `feat/` | Novas funcionalidades | `feat/user-habit-entities` |
| `fix/` | Correção de bugs | `fix/db-connection-error` |
| `refactor/` | Melhorias em código funcional | `refactor/auth-service` |
| `test/` | Adição ou ajuste de testes | `test/e2e-checkout-flow` |
| `docs/` | Documentação exclusivamente | `docs/update-readme` |

---

## 🗑️ Limpeza de Branches — Obrigatório

> Branches são temporárias. Após o merge, **devem ser apagadas imediatamente**.

### Regras

- Ao fazer merge de qualquer branch, apague-a logo em seguida — local **e** remota.
- Nunca deixe branches mergeadas acumuladas no repositório.
- Antes de criar uma nova branch, verifique se já existe uma com propósito similar ainda aberta.

### Comandos de limpeza

```bash
# Apagar branch local após merge
git branch -d feat/minha-feature

# Apagar branch remota
git push origin --delete feat/minha-feature

# Listar branches já mergeadas (candidatas a limpeza)
git branch --merged main

# Limpeza em lote: apagar todas as branches locais já mergeadas em main
git branch --merged main | grep -v '^\* main' | xargs git branch -d

# Sincronizar referências remotas deletadas
git remote prune origin
```

### No diário de bordo, sempre informe

```
Branches apagadas nesta tarefa:
- feat/nome-da-branch (local + remota)
```

---

## 📝 Conventional Commits

Formato: `tipo: descrição curta no imperativo`

| Tipo | Quando usar | Exemplo |
|---|---|---|
| `feat:` | Novo código, classe ou tela | `feat: cria entidades User e Habit` |
| `fix:` | Correção de erro | `fix: resolve mapeamento na coluna user_id` |
| `chore:` | Deps, ferramentas | `chore: atualiza dependências do projeto` |
| `docs:` | Documentação | `docs: adiciona regras de versionamento` |
| `style:` | Formatação (sem lógica) | `style: formata pacote models` |
| `refactor:` | Melhoria sem alterar comportamento | `refactor: extrai lógica de validação` |
| `test:` | Testes | `test: adiciona E2E para fluxo de login` |

### Regras de commit

- Um commit = uma responsabilidade. Não misture `feat` com `fix`.
- A descrição completa a frase: *"Se aplicado, este commit vai…"*
- Prefira commits menores e frequentes a commits gigantes.