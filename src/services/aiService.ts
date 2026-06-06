export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export const aiService = {
  /**
   * Obtém a resposta do provedor de IA ativo
   */
  async getResponse(messages: ChatMessage[], systemPrompt?: string): Promise<string> {
    const provider = this.getProvider();
    
    switch (provider) {
      case "openai":
        return this.callOpenAI(messages, systemPrompt);
      case "gemini":
        return this.callGemini(messages, systemPrompt);
      default:
        throw new Error("Nenhum provedor de IA configurado ou reconhecido no ambiente.");
    }
  },

  /**
   * Identifica dinamicamente qual provedor está disponível
   */
  getProvider(): "openai" | "gemini" | "unknown" {
    const customProvider = process.env.AI_PROVIDER?.toLowerCase();
    if (customProvider === "openai" || customProvider === "gemini") {
      return customProvider as "openai" | "gemini";
    }

    if (process.env.OPENAI_API_KEY) {
      return "openai";
    }

    if (process.env.GEMINI_API_KEY) {
      return "gemini";
    }

    return "unknown";
  },

  /**
   * Integração com a OpenAI Chat Completions API
   */
  async callOpenAI(messages: ChatMessage[], systemPrompt?: string): Promise<string> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY não configurada no ambiente.");
    }

    const modelName = process.env.OPENAI_MODEL || "gpt-5.4-mini-2026-03-17";
    const url = "https://api.openai.com/v1/chat/completions";

    const formattedMessages = [];
    if (systemPrompt) {
      formattedMessages.push({ role: "system", content: systemPrompt });
    }
    
    formattedMessages.push(...messages.map(msg => ({
      role: msg.role === "assistant" ? "assistant" : msg.role === "system" ? "system" : "user",
      content: msg.content
    })));

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: modelName,
        messages: formattedMessages,
        temperature: 0.7,
        max_completion_tokens: 2000
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Erro na API da OpenAI: ${response.status} - ${errText}`);
    }

    const resJson = await response.json();
    const text = resJson.choices?.[0]?.message?.content;
    if (!text) {
      throw new Error("Resposta inválida ou vazia da OpenAI.");
    }

    return text;
  },

  /**
   * Integração com a Gemini API (gemini-2.5-flash)
   */
  async callGemini(messages: ChatMessage[], systemPrompt?: string): Promise<string> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY não configurada no ambiente.");
    }

    const modelName = process.env.GEMINI_MODEL || "gemini-2.5-flash";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

    const geminiContents = messages
      .filter(msg => msg.role !== "system")
      .map(msg => ({
        role: msg.role === "assistant" ? "model" as const : "user" as const,
        parts: [{ text: msg.content }]
      }));

    // Garantir alternância estrita e início com papel "user"
    if (geminiContents.length > 0 && geminiContents[0].role === "model") {
      geminiContents.shift();
    }

    const requestBody: any = {
      contents: geminiContents.slice(-11),
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 2000
      }
    };

    if (systemPrompt) {
      requestBody.systemInstruction = {
        parts: [{ text: systemPrompt }]
      };
    }

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Erro na API do Gemini: ${response.status} - ${errText}`);
    }

    const resJson = await response.json();
    const text = resJson.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      throw new Error("Resposta inválida ou vazia do Gemini.");
    }

    return text;
  }
};
