# 04. Estratégia de Sincronização Offline-First

O Vesper Finance IA nasceu offline-first, mas o ambiente Mobile traz desafios distintos da Web em relação à durabilidade de background e ciclo de vida do app.

## 🔄 Fluxo de Dados (Local-First Absoluto)

A regra de ouro se mantém: **A UI só lê do Banco Local (SQLite/WatermelonDB). O Banco Local conversa com o Supabase.**

1. Usuário abre o app no metrô (sem sinal).
2. O aplicativo carrega o último estado conhecido do SQLite instantaneamente (0 milissegundos).
3. Usuário insere uma despesa de "R$ 15,00 - Café".
4. A despesa é salva no SQLite com status `sync_status = 'pending'`.
5. O saldo do HUD de Sobrevivência atualiza imediatamente no UI.

---

## 🚀 Background Fetch & Sincronização Assíncrona

Na web, contamos com `window.addEventListener('online')` ou verificações ao focar a aba. No mobile, o app pode estar dormindo (em background) quando a rede voltar.

### Tarefas de Background (`expo-background-fetch` e `expo-task-manager`)
- Registrar uma tarefa que a cada 15 minutos (ou assim que houver conectividade) varre a tabela local por registros com `sync_status = 'pending'` ou `'deleted'`.
- Tenta enviar esses registros para o Supabase em batch.
- Se bem-sucedido, marca como `synced` no SQLite local.

### Estratégia de Fila Resoluta (Queue)
Para evitar que uma transação recém editada seja sobrescrita por uma sync tardia:
- Todas as operações (Create, Update, Delete) devem idealmente salvar em uma "Tabela de Fila de Ações" além de alterar a tabela final, caso a conectividade esteja instável. No mobile, a liberação de recursos nativos (matar o app) é comum e precisamos que essa fila persista além da memória RAM.

---

## 🛡️ Resolução de Conflitos (Timestamp e UUID)

Igual à estratégia web mapeada, se o usuário edita a transação no celular (offline) e altera na web (online):
- O registro possui o campo `updated_at`.
- Ao reconectar o celular, o sync compara o `updated_at` local com o que chega do Supabase. O timestamp mais recente vence (Last-Write-Wins simples).
- Como todos os IDs gerados localmente são `uuid-v4`, não há perigo de colisões de chaves primárias ao sincronizar Múltiplas inserções criadas offline.
