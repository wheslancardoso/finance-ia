# Vesper Mobile 📱

Versão nativa (Android/iOS) do Vesper Finance, focada em inteligência financeira, liquidez em tempo real e experiência premium.

## 🚀 Stack Tecnológica

- **Core**: React Native + Expo (Managed Workflow)
- **Navegação**: Expo Router (File-based routing)
- **Estilização**: NativeWind v4 (Tailwind CSS)
- **Animações**: Moti + React Native Reanimated
- **Backend**: Supabase (Auth, Database, Edge Functions)
- **Testes**: Jest + React Native Testing Library

## 🏗️ Arquitetura

Seguimos a mesma separação de camadas do projeto Web para garantir manutenibilidade e compartilhamento de lógica:

- `src/domain/`: Regras de negócio puras (compartilhadas conceitualmente).
- `src/application/`: Hooks e lógica de orquestração.
- `src/infrastructure/`: Cliente Supabase e serviços externos.
- `src/components/`: Componentes visuais atômicos e moleculares.
- `app/`: Roteamento e telas.

## 🧪 Testes

Rode a suíte de testes com:

```bash
npm test
```

## 🛠️ Setup Inicial

1. Entre na pasta mobile: `cd mobile`
2. Instale as dependências: `npm install`
3. Inicie o expo: `npx expo start`
