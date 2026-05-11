---
trigger: always_on
---

# 02 · Arquitetura

> Camadas, padrões obrigatórios, organização de pastas e decisões arquiteturais.

---

## 🏗️ Estrutura em Camadas

Cada camada só pode depender da camada imediatamente abaixo — nunca ao contrário.

```
presentation/   → UI, componentes, páginas, controllers
application/    → Use cases, orquestradores de fluxo
domain/         → Entidades, regras de negócio, interfaces de repositório
infrastructure/ → Implementações concretas: banco, APIs externas, email
```

---

## 📐 Padrões Obrigatórios

### Repository Pattern

A interface do repositório vive em `domain/`. A implementação concreta vive em `infrastructure/`. Nunca acesse o banco de dados diretamente em controllers, componentes ou use cases.

```typescript
// ✅ Correto
// domain/repositories/userRepository.ts
interface UserRepository {
  findById(id: string): Promise<User | null>;
  save(user: User): Promise<void>;
}

// infrastructure/repositories/prismaUserRepository.ts
class PrismaUserRepository implements UserRepository { ... }

// ❌ Errado — Prisma/Mongoose direto num controller ou componente
```

### Service Layer

- Lógica de negócio que envolve múltiplas entidades ou efeitos colaterais (emails, filas) vive em serviços.
- Serviços são **injetados via injeção de dependência** — nunca instanciados com `new` dentro de outros serviços ou controllers.

### Use Cases (Application Layer)

- Cada ação do usuário mapeia para exatamente **um use case**.
- Use cases orquestram repositórios e serviços; **não contêm regras de negócio** — elas pertencem ao `domain/`.
- Nomenclatura clara: `createUser.usecase.ts`, `cancelOrder.usecase.ts`.

---

## 🚫 Regras Invioláveis

- **Nenhuma regra de negócio em controllers ou componentes de UI.**
- **Nenhum acesso direto à infraestrutura na camada de domínio.** Use interfaces.
- **Evite God Objects**: se uma classe/módulo cresce demais, quebre-a.
- **Nunca importe uma implementação concreta onde uma interface é suficiente.**

---

## 📁 Organização de Pastas (Feature-First — recomendada)

```
src/
  features/
    users/
      domain/
        user.entity.ts
        userRepository.interface.ts
      application/
        createUser.usecase.ts
        getUser.usecase.ts
      infrastructure/
        prismaUser.repository.ts
      presentation/
        user.controller.ts
  shared/
    errors/
    utils/
    types/
```

---

## 💉 Injeção de Dependência

- Prefira injeção por construtor.
- Use um container de DI quando o projeto crescer (ex: `tsyringe`, `inversify`, NestJS nativo).

---

## 📋 ADR — Architecture Decision Records

Quando uma decisão arquitetural relevante for tomada, registre em `docs/adr/`:

```markdown
# ADR-001: [Título]
**Status:** Aceito
**Contexto:** Por que esta decisão foi necessária?
**Decisão:** O que foi decidido?
**Consequências:** Quais são os trade-offs?
```