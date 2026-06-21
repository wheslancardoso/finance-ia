# 02. Arquitetura e Tech Stack Mobile

Mapeamento da infraestrutura técnica necessária para levar o ecossistema Vesper para iOS e Android.

## 🛠️ Stack Tecnológica Recomendada

- **Framework:** Expo SDK + React Native. Facilita o desenvolvimento, build na nuvem (EAS Build) e uso de módulos nativos via Expo Modules.
- **Estilização:** NativeWind (Tailwind CSS para React Native) ou StyleSheet puro (se focado em máxima performance de renderização).
- **Backend & Auth:** `@supabase/supabase-js`. Idêntico ao web.
- **Estado Global:** `Zustand`. Mais leve e compatível com React Native do que soluções pesadas, ideal para substituir Contextos gigantes se necessário.
- **Animações:** `react-native-reanimated`. Para animações a 60fps rodando na UI Thread (substitui Framer Motion).
- **Listas de Alta Performance:** `@shopify/flash-list`. Substitui mapas simples em scrollviews virtuais da web.

---

## 💾 Banco de Dados Local (Substituindo Dexie)

O Dexie.js (IndexedDB) brilha na Web, mas no mobile precisamos de uma solução focada em Threads e SQLite para evitar engasgos na JS Thread.

**Opção 1: Expo SQLite (Recomendado)**
- A versão mais recente do Expo SQLite é assíncrona, robusta e muito próxima do bare-metal.
- Permite construir nossa própria camada de "Local-First" que já usamos no web.

**Opção 2: WatermelonDB**
- Banco focado inteiramente em arquiteturas Offline-First para React Native.
- Traz sistema de concorrência massiva e renderização reativa nativa.
- Curva de aprendizado maior para replicar nosso modelo de _Sync_, mas traz performance incomparável para listas gigantes.

---

## 🔑 Autenticação (Supabase no Mobile)

- O gerenciamento de sessão com Supabase em React Native exige a troca do `storage` padrão do navegador pelo `AsyncStorage` (ou `SecureStore` do Expo para segurança máxima de tokens).
- Autenticação biométrica: Pode-se adicionar `expo-local-authentication` para exigir FaceID/TouchID antes de abrir o App.

---

## 📁 Estrutura de Pastas Sugerida

Muito similar à estrutura web, mas adaptada:

```text
src/
  app/              # Telas (Expo Router para file-based routing)
    (tabs)/         # Bottom Tabs (Home, Extrato, etc)
    (modals)/       # Modais empilhados
  components/
    ui/             # Componentes base
    domain/         # Componentes ligados ao negócio (ex: SurvivalHUD)
  domain/           # Regras de negócio, igual à web
  hooks/            # Hooks customizados
  infrastructure/   # Conexão com SQLite / Supabase Sync
  store/            # Estado global (Zustand)
```
