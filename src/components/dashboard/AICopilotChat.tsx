"use client";

import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, X, Send, Bot, User, Loader2, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface Message {
  role: "user" | "model";
  text: string;
}

export function AICopilotChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "model",
      text: "Olá! Sou o Vesper AI Copilot, seu mentor de sobrevivência financeira. Entendo perfeitamente que as coisas andam muito difíceis, mas estou aqui com você, sem julgamentos. Olhei os seus dados reais de contas e faturas de cartão. Em que posso te ajudar a planejar ou organizar hoje?"
    }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!message.trim() || isLoading) return;

    const userMessage = message;
    setMessage("");
    setMessages((prev) => [...prev, { role: "user", text: userMessage }]);
    setIsLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMessage })
      });

      if (!response.ok) {
        throw new Error("Falha ao comunicar com o Copilot.");
      }

      const data = await response.json();
      setMessages((prev) => [...prev, { role: "model", text: data.response }]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          role: "model",
          text: "Desculpe, tive um pequeno problema ao processar seu pedido. Mas não desista, podemos tentar de novo!"
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickQuestion = (question: string) => {
    setMessage(question);
  };

  return (
    <>
      {/* Balão flutuante minimalista estilo premium */}
      <div className="fixed bottom-24 right-6 md:bottom-28 md:right-8 z-50">
        <motion.button
          onClick={() => setIsOpen(!isOpen)}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="relative group p-4 rounded-full bg-gradient-to-tr from-violet-600 to-indigo-600 text-white shadow-2xl shadow-violet-600/30 overflow-hidden"
          style={{ border: "1px solid rgba(255, 255, 255, 0.2)" }}
        >
          <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="relative z-10 flex items-center gap-2">
            <Sparkles className="w-5 h-5 animate-pulse" />
            <span className="hidden group-hover:inline text-xs font-black uppercase tracking-wider pr-1">Vesper Copilot</span>
          </div>
        </motion.button>
      </div>

      {/* Janela de Chat Expansível */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="fixed bottom-40 right-6 md:bottom-48 md:right-8 w-[420px] max-w-[calc(100vw-2rem)] h-[600px] max-h-[calc(100vh-14rem)] z-50 bg-[#0d0d0d]/90 backdrop-blur-3xl border border-white/10 rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col"
          >
            {/* Efeitos de Luz no Fundo */}
            <div className="absolute -top-32 -right-32 w-64 h-64 blur-[100px] bg-violet-600/20 rounded-full pointer-events-none" />
            <div className="absolute -bottom-32 -left-32 w-64 h-64 blur-[100px] bg-indigo-600/20 rounded-full pointer-events-none" />

            {/* Cabeçalho */}
            <div className="relative z-10 px-6 py-5 border-b border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-violet-600/20 border border-violet-500/20 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-violet-400" />
                </div>
                <div className="flex flex-col">
                  <h3 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-1.5">
                    Vesper Copilot
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  </h3>
                  <span className="text-[8px] font-bold text-white/40 uppercase tracking-tighter">Mentor de Sobrevivência Financeira</span>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center border border-white/5 transition-colors text-white/60 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Área de Mensagens */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar relative z-10">
              {messages.map((msg, index) => (
                <div
                  key={index}
                  className={cn(
                    "flex gap-3 max-w-[85%]",
                    msg.role === "user" ? "ml-auto flex-row-reverse" : ""
                  )}
                >
                  <div
                    className={cn(
                      "w-7 h-7 rounded-lg shrink-0 flex items-center justify-center border",
                      msg.role === "user"
                        ? "bg-violet-600/20 border-violet-500/30 text-violet-400"
                        : "bg-white/5 border-white/10 text-white/60"
                    )}
                  >
                    {msg.role === "user" ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
                  </div>
                  <div
                    className={cn(
                      "p-4 rounded-2xl text-[11px] leading-relaxed whitespace-pre-line font-medium",
                      msg.role === "user"
                        ? "bg-violet-600 text-white shadow-lg shadow-violet-600/10 rounded-tr-none"
                        : "bg-white/5 border border-white/5 text-white/80 rounded-tl-none"
                    )}
                  >
                    {msg.text}
                  </div>
                </div>
              ))}

              {isLoading && (
                <div className="flex gap-3 max-w-[85%]">
                  <div className="w-7 h-7 rounded-lg shrink-0 flex items-center justify-center bg-white/5 border border-white/10 text-white/60">
                    <Bot className="w-3.5 h-3.5" />
                  </div>
                  <div className="p-4 rounded-2xl rounded-tl-none bg-white/5 border border-white/5 flex items-center gap-2">
                    <Loader2 className="w-3.5 h-3.5 text-violet-400 animate-spin" />
                    <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Analisando suas finanças...</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Sugestões Rápidas (Aparecem quando o chat está limpo ou o usuário precisa de rumo) */}
            {messages.length === 1 && (
              <div className="px-6 py-2 relative z-10 flex flex-col gap-1.5">
                <p className="text-[8px] font-black text-white/30 uppercase tracking-widest mb-1">Perguntas Recomendadas:</p>
                {[
                  "Como comprar sabão e itens essenciais no crédito este mês?",
                  "O que é mais barato: Pix Parcelado ou juros do cartão?",
                  "Como sair do vermelho com minha dívida atual de faturas?"
                ].map((q, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleQuickQuestion(q)}
                    className="flex items-center justify-between text-left p-2.5 rounded-xl bg-white/2 hover:bg-white/5 border border-white/5 text-[9px] font-bold text-white/50 hover:text-white/80 transition-all group"
                  >
                    <span>{q}</span>
                    <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity text-violet-400" />
                  </button>
                ))}
              </div>
            )}

            {/* Formulário de Input */}
            <form onSubmit={handleSend} className="relative z-10 p-6 border-t border-white/5 bg-[#0d0d0d]/80 flex gap-2">
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Pergunte ao Copilot..."
                className="flex-1 px-4 py-3 rounded-2xl bg-white/5 border border-white/10 text-white placeholder-white/30 text-xs font-semibold focus:outline-none focus:border-violet-500 transition-colors"
                disabled={isLoading}
              />
              <button
                type="submit"
                className="p-3 rounded-2xl bg-violet-600 hover:bg-violet-500 disabled:bg-violet-600/30 text-white shadow-lg shadow-violet-600/20 transition-colors"
                disabled={!message.trim() || isLoading}
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
