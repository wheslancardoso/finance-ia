# 03. Padrões UI/UX e Estética Brutalista Mobile

O Vesper Finance possui uma identidade visual muito marcante (Premium Brutalism, tipografia forte, cores neons sobre backgrounds ultra-darks). Adaptar isso para uma tela de 6 polegadas exige alguns cuidados.

## 🎨 Paleta de Cores e Tipografia

- O fundo `zinc-950` ou `black` puro (ótimo para telas OLED de smartphones, economiza bateria).
- A tipografia principal (Inter ou Space Grotesk) deve ser mantida via carregamento de fontes customizadas no Expo (`expo-font`).
- Letras grandes e brutas (`text-4xl`, `font-black`) no dashboard de Liquidez, transmitindo imediatamente o "peso" do dinheiro.

---

## 👆 Interações Sensíveis a Toque (Haptics e Gestos)

No mobile, o feedback tátil (vibração) é crucial.

### Haptic Feedback (`expo-haptics`)
- **ImpactLight:** Ao clicar nos dígitos na calculadora do simulador ou no numpad de transação.
- **ImpactMedium:** Ao concluir um Swipe-to-Delete.
- **NotificationSuccess:** Ao pagar uma fatura inteira ou atingir 100% de uma meta.
- **NotificationError:** Quando o usuário tenta gastar acima do Teto de Sobrevivência.

### Gestos Nativos (`react-native-gesture-handler`)
- **Swipe Actions:** Deslizar uma transação para a esquerda revela um botão brutalista vermelho para Deletar. Deslizar para a direita revela um botão verde "Pagar Fatura / Quitar".
- **Pull-to-Refresh:** O scrollview principal da Home deve ter um Custom Refresh Control que dispara a verificação em background com o Supabase.

---

## ⌨️ Entrada de Dados (Teclados Nativos)

Na web, lidar com formatação de moeda em inputs de texto é relativamente tranquilo. No mobile, o teclado do usuário dita a regra.

- **Numpad Customizado vs Teclado Decimal:** Para inserção de valores no `AddTransactionSheet`, o ideal é forçar o `keyboardType="decimal-pad"`.
- Ou melhor: construir um teclado numérico **brutalista nativo (in-app)**, grandes botões retangulares na metade inferior da tela, garantindo que a máscara financeira (R$ 0,00) seja absoluta.

---

## 🚀 Micro-Animações (Reanimated)
- O `SurvivalHUD` que muda de verde (Saudável) para vermelho (Crise) deve ter uma transição de cores suave e palpitação de borda usando `interpolateColor` do Reanimated, em vez do Framer Motion da web.
- Os gráficos de pizza/donuts (`IncomeMixChart`) podem usar o Skia (`@shopify/react-native-skia`) para renderização nativa de gráficos de altíssima fidelidade.
