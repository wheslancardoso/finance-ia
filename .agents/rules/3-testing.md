---
trigger: always_on
---

# 03 · Testes Automatizados

> Filosofia, estratégia e padrões para testes unit, integration e E2E.

---

## 🧪 Pirâmide de Testes

```
        /‾‾‾‾‾‾‾\
       /   E2E    \       ← Playwright (poucos, alto valor)
      /‾‾‾‾‾‾‾‾‾‾‾\
     / Integration  \     ← Banco real, serviços reais
    /‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾\
   /   Unit Tests    \    ← Lógica pura, isolada, rápida (maioria)
  /‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾\
```

Código sem teste **não está pronto**. Nunca substitua unit tests por E2E — use os dois.

---

## ✅ Unit Tests

- Testam **uma unidade de lógica isolada** (função, método, use case).
- Dependências externas são sempre **mockadas**.
- Um teste = um comportamento. Nome: `deve [resultado] quando [condição]`.
- Cobertura mínima: **80% em `domain/` e `application/`**.

```typescript
describe('CreateUserUseCase', () => {
  it('deve lançar erro quando email já está cadastrado', async () => {
    mockUserRepository.findByEmail.mockResolvedValue(userFixture);
    await expect(createUser.execute(input)).rejects.toThrow(EmailAlreadyExistsError);
  });
});
```

---

## 🔗 Integration Tests

- Testam a **integração entre camadas reais**: use case + repositório + banco.
- Use banco de teste isolado (SQLite in-memory ou container via `testcontainers`).
- Limpe o estado do banco antes de cada teste.

```typescript
beforeEach(async () => {
  await db.migrate.latest();
  await db.seed.run();
});

afterEach(async () => {
  await db('users').del();
});
```

---

## 🎭 E2E com Playwright

### Estrutura de arquivos

```
tests/
  e2e/
    fixtures/         → dados de teste reutilizáveis
    pages/            → Page Objects
    specs/            → testes por funcionalidade
      auth.spec.ts
      checkout.spec.ts
    playwright.config.ts
```

### Page Object Model (POM) — obrigatório

Nunca acesse seletores diretamente no arquivo de teste.

```typescript
// tests/e2e/pages/loginPage.ts
export class LoginPage {
  constructor(private page: Page) {}

  async goto() { await this.page.goto('/login'); }

  async fillCredentials(email: string, password: string) {
    await this.page.getByLabel('E-mail').fill(email);
    await this.page.getByLabel('Senha').fill(password);
  }

  async submit() {
    await this.page.getByRole('button', { name: 'Entrar' }).click();
  }

  async getErrorMessage() {
    return this.page.getByRole('alert').textContent();
  }
}
```

### Seletores — ordem de preferência

1. `getByRole('button', { name: 'Enviar' })` — semântico
2. `getByLabel('E-mail')` — campos de formulário
3. `getByText('Confirmar pedido')` — textos visíveis
4. `getByTestId('checkout-btn')` — último recurso semântico
5. `locator('.classe-css')` — **evite**, frágil a mudanças de estilo

### Autenticação — reutilize sessão

Use `storageState` para não repetir fluxo de login em cada teste:

```typescript
// playwright.config.ts
use: {
  storageState: 'tests/e2e/fixtures/authState.json',
}
```

Para criar/limpar dados de teste, use a **API diretamente** (`request`) — não clique em telas para preparar o cenário de outro teste.

### O que cobrir com E2E

| Fluxo | Cobrir? |
|---|---|
| Login / Logout | ✅ |
| Cadastro de usuário | ✅ |
| Happy path da aplicação | ✅ |
| Validação de formulários críticos | ✅ |
| Mensagens de erro ao usuário | ✅ |
| Variações de UI/estilo | ❌ use visual regression |
| Regras de negócio complexas | ❌ use unit tests |

### Comandos

```bash
npx playwright test                                      # todos
npx playwright test --ui                                 # interface visual
npx playwright test tests/e2e/specs/auth.spec.ts        # arquivo específico
npx playwright show-report                               # relatório HTML
```

---

## 🔁 Feedback Loop Contínuo — Rode Testes a Cada Alteração

> Não espere terminar a feature para descobrir que algo quebrou. **Teste enquanto desenvolve.**

### Regra de ouro

A cada alteração de código — por menor que seja — rode os testes do escopo afetado **antes de continuar para o próximo passo**. Isso evita o efeito bola de neve: um bug silencioso que se propaga por vários commits e vira um pesadelo para depurar depois.

### O que rodar em cada situação

| Você alterou… | Rode imediatamente |
|---|---|
| Uma função ou use case isolado | `npx jest --testPathPattern=nomeDoArquivo` |
| Um repositório ou serviço | Testes unitários da camada + integration tests relacionados |
| Um componente ou página | Spec E2E do fluxo correspondente |
| Múltiplos arquivos / refactor | Suite completa: unit + integration + E2E |
| Corrigiu um bug | O teste que cobre o bug + suite completa ao final |

### Fluxo esperado por iteração

```
Altera código
    ↓
Roda testes do escopo afetado
    ↓
Passou? → Continua para o próximo passo
Falhou? → Corrige AGORA, neste passo — não acumula para depois
    ↓
Ao finalizar a feature: roda suite completa antes do diário de bordo
```

### ❌ Nunca faça isso

- Acumular 5 alterações e rodar os testes só no final.
- Ignorar um teste falhando porque "vou resolver depois".
- Commitar com testes vermelhos achando que são "unrelated".

---

## 🚦 Execução Obrigatória Após Toda Feature

> Implementou uma feature? Os testes E2E **não são opcionais** — fazem parte da definição de "pronto".

### Fluxo obrigatório ao finalizar uma feature

```
1. Implementa a feature
2. Escreve ou atualiza o spec E2E correspondente
3. Roda a suite completa: npx playwright test
4. Todos passando? → Segue para o diário de bordo
   Algum falhou?   → Veja o protocolo abaixo
```

### Protocolo quando um teste E2E falha

O teste que quebrou é um sinal de que **a feature tem um problema** — não o teste. Siga este processo antes de qualquer outra ação:

1. Leia o relatório completo: `npx playwright show-report`
2. Identifique qual assertion falhou e em qual passo.
3. Reproduza manualmente o fluxo no browser para confirmar o comportamento.
4. **Corrija o código da feature** até o teste passar.
5. Rode a suite completa novamente para garantir que nenhum outro teste foi afetado.

### ❌ Proibido ao lidar com falha de E2E

- Deletar ou comentar o teste que falhou para "desbloquear" o merge.
- Marcar o teste com `.skip()` sem deixar um `// TODO:` explicando e uma issue aberta.
- Alterar as assertions do teste para que passem sem corrigir o comportamento real.

### Exceção: teste desatualizado por mudança intencional de UI

Se a feature mudou intencionalmente um seletor ou texto que um teste existente dependia (ex: renomear um botão), **isso não é falha da feature** — é o teste que precisa ser atualizado. Nesse caso:

1. Atualize o Page Object correspondente com o novo seletor/texto.
2. Confirme que a mudança foi intencional documentando no commit: `test: atualiza POM após renomear botão de confirmação`.
3. Nunca altere a lógica de negócio da assertion — só o seletor.