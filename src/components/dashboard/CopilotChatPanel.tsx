"use client";

import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Sparkles, 
  X, 
  Send, 
  Bot, 
  User, 
  Loader2, 
  ArrowRight,
  TrendingUp,
  Target,
  Calendar,
  CheckCircle2,
  AlertTriangle
} from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { useFinancialData } from "@/context/FinancialDataContext";
import { useFinancialAnalysis } from "@/hooks/useFinancialAnalysis";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Message {
  role: "user" | "model";
  text: string;
}

interface VesperSimulation {
  type: "expense" | "loan";
  title: string;
  amount: number;
  installments: number;
  interestRate?: number;
  description: string;
  impactAnalysis: string;
  customInstallment?: number;
}

interface CopilotChatPanelProps {
  isCopilotOpen: boolean;
  onToggleCopilot: () => void;
  monthOffset: number;
  targetDate: Date;
  onSimulate: (simulations: any[] | null) => void;
  activeSimulations: any[];
}

export default function CopilotChatPanel({
  isCopilotOpen,
  onToggleCopilot,
  monthOffset,
  targetDate,
  onSimulate,
  activeSimulations
}: CopilotChatPanelProps) {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [memoryFacts, setMemoryFacts] = useState<string[]>([]);
  const [groupedFacts, setGroupedFacts] = useState<{
    profile: string[];
    goals: string[];
    fears: string[];
    preferences: string[];
  }>({
    profile: [],
    goals: [],
    fears: [],
    preferences: []
  });
  const [isMemoryOpen, setIsMemoryOpen] = useState(false);
  
  // Ações de feedback nos cartões de simulação
  const [metaSalvaFeedback, setMetaSalvaFeedback] = useState<Record<string, boolean>>({});
  const [agendaFeedback, setAgendaFeedback] = useState<Record<string, boolean>>({});
  const [selectedAccounts, setSelectedAccounts] = useState<Record<string, string>>({});

  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const { 
    accounts, 
    upsertGoal, 
    upsertTransaction, 
    createInstallmentSeries, 
    netLiquidityCents, 
    accumulatedBalanceCents, 
    scheduledExpensesCents 
  } = useFinancialData();

  const {
    netLiquidityCents: activeNetLiquidityCents,
    accumulatedBalanceCents: activeAccumulatedBalanceCents,
    totalConsolidatedDebtCents: activeConsolidatedDebtCents,
    monthlyOutlook: activeMonthlyOutlook,
    isCrisisMode: activeIsCrisisMode
  } = useFinancialAnalysis(monthOffset, activeSimulations);

  const activeMonthLabel = format(targetDate, "MMMM 'de' yyyy", { locale: ptBR });

  // 1. Carregar histórico e memórias de longo prazo do Supabase na inicialização
  useEffect(() => {
    setMounted(true);
    
    async function loadChatAndMemory() {
      try {
        const res = await fetch("/api/chat");
        if (res.ok) {
          const data = await res.json();
          setMemoryFacts(data.memoryFacts || []);
          if (typeof window !== "undefined") {
            localStorage.setItem('vesper_jarvis_memories', JSON.stringify(data.memoryFacts || []));
            window.dispatchEvent(new CustomEvent('jarvis-memories-updated'));
          }
          if (data.groupedFacts) {
            setGroupedFacts(data.groupedFacts);
          } else {
            setGroupedFacts({
              profile: [],
              goals: data.memoryFacts || [],
              fears: [],
              preferences: []
            });
          }
          
          if (data.history && data.history.length > 0) {
            setMessages(data.history);
          } else {
            // Boas-vindas padrão
            setMessages([
              {
                role: "model",
                text: "Olá! Sou o Vesper AI Copilot, seu mentor de sobrevivência financeira. Entendo perfeitamente que as coisas andam muito difíceis, mas estou aqui com você, sem julgamentos. Olhei os seus dados reais de contas e faturas de cartão.\n\nComo estou integrado ao Modo Projeção, posso simular o impacto de qualquer gasto ou empréstimo diretamente nas contas desse mês ativo na Time Machine. O que você gostaria de analisar hoje?"
              }
            ]);
          }
        }
      } catch (err) {
        console.error("Erro ao carregar histórico persistente do Supabase:", err);
      } finally {
        setIsInitializing(false);
      }
    }
    
    loadChatAndMemory();
  }, []);

  // 2. Scroll automático
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isCopilotOpen && mounted) {
      setTimeout(scrollToBottom, 100);
    }
  }, [messages, isCopilotOpen, mounted]);

  // Atualizar mensagens localmente
  const saveMessages = (newMessages: Message[]) => {
    setMessages(newMessages);
  };

  // Limpar chat no Supabase (com opção de reset total de memória)
  const handleClearHistory = async (resetAll = false) => {
    setIsLoading(true);
    try {
      const url = resetAll ? "/api/chat?reset_all=true" : "/api/chat";
      const res = await fetch(url, { method: "DELETE" });
      if (res.ok) {
        const defaultMsg: Message[] = [
          {
            role: "model",
            text: `Olá! Chat reiniciado. Estou pronto para te ajudar com novas simulações e planejamentos financeiros no mês de ${activeMonthLabel}. O que faremos agora?`
          }
        ];
        setMessages(defaultMsg);
        if (resetAll) {
          setMemoryFacts([]);
          if (typeof window !== "undefined") {
            localStorage.setItem('vesper_jarvis_memories', JSON.stringify([]));
            window.dispatchEvent(new CustomEvent('jarvis-memories-updated'));
          }
          setGroupedFacts({ profile: [], goals: [], fears: [], preferences: [] });
        }
        onSimulate(null);
      }
    } catch (e) {
      console.error("Falha ao limpar histórico no Supabase:", e);
    } finally {
      setIsLoading(false);
    }
  };

  // 3. Parser de Simulações
  const parseMessageTextAndSimulations = (text: string) => {
    const regex = /<vesper-simulation>([\s\S]*?)<\/vesper-simulation>/g;
    const simulations: VesperSimulation[] = [];
    let cleanText = text;
    let match;

    while ((match = regex.exec(text)) !== null) {
      try {
        const simJson = JSON.parse(match[1].trim());
        simulations.push(simJson);
        // Remover a tag XML do texto visível
        cleanText = cleanText.replace(match[0], "");
      } catch (err) {
        console.error("Erro ao parsear JSON de simulação emitido pela IA:", err);
      }
    }

    // Limpar formatações de markdown (# e *) para exibição limpa em plain text
    const plainText = cleanText
      .replace(/\*\*/g, "") // remove negritos **
      .replace(/\*/g, "")   // remove itálicos *
      .replace(/#+\s/g, "") // remove marcadores de título #, ##, ###
      .trim();

    return {
      text: plainText,
      simulations
    };
  };

  // 4. Envio de mensagem
  const handleSend = async (e?: React.FormEvent, customMsg?: string) => {
    e?.preventDefault();
    const activeMsg = customMsg || message;
    if (!activeMsg.trim() || isLoading) return;

    if (!customMsg) {
      setMessage("");
    }

    // Adicionar a mensagem do usuário na tela localmente de imediato
    const updatedHistory = [...messages, { role: "user" as const, text: activeMsg }];
    setMessages(updatedHistory);
    setIsLoading(true);

    const projectionSummary = {
      netLiquidityCents: activeNetLiquidityCents,
      accumulatedBalanceCents: activeAccumulatedBalanceCents,
      weeklyLimitCents: Math.max(2000, Math.round(activeAccumulatedBalanceCents / 4)),
      plannedExpensesCents: activeMonthlyOutlook.plannedExpenses,
      isCrisis: activeIsCrisisMode
    };

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: activeMsg,
          monthOffset,
          monthLabel: activeMonthLabel,
          projectionSummary
        })
      });

      if (!response.ok) {
        throw new Error("Falha ao comunicar com a IA.");
      }

      const data = await response.json();
      
      // Atualizar mensagens e memórias com o retorno limpo da IA
      setMessages([...updatedHistory, { role: "model" as const, text: data.response }]);
      if (data.memoryFacts) {
        setMemoryFacts(data.memoryFacts);
        if (typeof window !== "undefined") {
          localStorage.setItem('vesper_jarvis_memories', JSON.stringify(data.memoryFacts || []));
          window.dispatchEvent(new CustomEvent('jarvis-memories-updated'));
        }
      }
      if (data.groupedFacts) {
        setGroupedFacts(data.groupedFacts);
      } else if (data.memoryFacts) {
        setGroupedFacts({
          profile: [],
          goals: data.memoryFacts,
          fears: [],
          preferences: []
        });
      }
    } catch (error) {
      setMessages([
        ...updatedHistory,
        {
          role: "model",
          text: "Desculpe, tive um pequeno problema ao processar seu pedido. Mas não se preocupe, podemos tentar novamente ou verificar a conexão!"
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickQuestion = (question: string) => {
    handleSend(undefined, question);
  };

  // Ações de Simulação
  const handleActionSimulate = (sim: VesperSimulation, index: number) => {
    const simKey = `${sim.title}-${index}`;
    // Verificar se já está simulado
    const isAlreadySimulated = activeSimulations.some(
      (s) => s.description === `Simulado: ${sim.title}`
    );

    if (isAlreadySimulated) {
      // Remover
      const newSims = activeSimulations.filter(
        (s) => s.description !== `Simulado: ${sim.title}`
      );
      onSimulate(newSims.length > 0 ? newSims : null);
    } else {
      // Adicionar
      const newSim = {
        description: `Simulado: ${sim.title}`,
        amount_cents: Math.round(sim.amount * 100),
        installments: sim.installments,
        interestRate: sim.interestRate || 0,
        type: sim.type === "loan" ? "INCOME" : "EXPENSE",
        isLoan: sim.type === "loan",
        startMonthOffset: monthOffset,
        customInstallmentCents: sim.customInstallment ? Math.round(sim.customInstallment * 100) : undefined
      };
      onSimulate([...activeSimulations, newSim]);
    }
  };

  const handleActionSaveAsGoal = async (sim: VesperSimulation, index: number) => {
    const simKey = `${sim.title}-${index}`;
    setMetaSalvaFeedback(prev => ({ ...prev, [simKey]: true }));
    
    try {
      await upsertGoal({
        name: `Meta: ${sim.title}`,
        target_amount_cents: Math.round(sim.amount * 100),
        current_amount_cents: 0,
        status: "active"
      });
      // feedback visual permanece
    } catch (e) {
      console.error("Falha ao salvar meta a partir do simulador de IA:", e);
      setMetaSalvaFeedback(prev => ({ ...prev, [simKey]: false }));
    }
  };

  const handleActionSchedule = async (sim: VesperSimulation, index: number) => {
    const simKey = `${sim.title}-${index}`;
    setAgendaFeedback(prev => ({ ...prev, [simKey]: true }));
    
    const accountId = selectedAccounts[simKey] || (accounts.length > 0 ? accounts[0].id : "");
    if (!accountId) {
      alert("Por favor, selecione uma conta bancária ou cartão de crédito para agendar.");
      setAgendaFeedback(prev => ({ ...prev, [simKey]: false }));
      return;
    }

    try {
      if (sim.installments > 1) {
        // Criar série parcelada
        await createInstallmentSeries({
          description: sim.title,
          amount_total_cents: Math.round(sim.amount * 100),
          installments: sim.installments,
          account_id: accountId,
          start_date: new Date().toISOString(),
          category_id: null
        });
      } else {
        // Transação avulsa agendada
        await upsertTransaction({
          description: sim.title,
          amount_cents: Math.round(sim.amount * 100),
          transaction_type: sim.type === "expense" ? "EXPENSE" : "INCOME",
          date: new Date().toISOString(),
          account_id: accountId,
          category_id: null,
          is_paid: false
        });
      }
    } catch (e) {
      console.error("Falha ao agendar transação a partir do simulador de IA:", e);
      setAgendaFeedback(prev => ({ ...prev, [simKey]: false }));
    }
  };

  if (!isCopilotOpen || !mounted) return null;

  return (
    <div className="flex flex-col h-full bg-[#070708]/90 backdrop-blur-3xl border-l border-white/5 shadow-2xl relative">
      {/* Luzes de Fundo Glassmorphic */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-violet-600/5 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-80 h-80 bg-indigo-600/5 blur-[120px] rounded-full pointer-events-none" />

      {/* Cabeçalho */}
      <div className="relative z-10 px-6 py-5 border-b border-white/5 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-violet-600/10 border border-violet-500/20 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-violet-400 animate-pulse" />
          </div>
          <div className="flex flex-col">
            <h3 className="text-xs font-black text-white uppercase tracking-[0.2em] flex items-center gap-1.5">
              Vesper Copilot
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            </h3>
            <span className="text-[8px] font-black text-white/30 uppercase tracking-widest mt-0.5">
              Modo Jarvis Integrado
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handleClearHistory(false)}
            className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-[8px] font-black uppercase text-white/60 hover:text-white transition-all border border-white/5"
            title="Limpar Histórico"
          >
            Limpar Chat
          </button>
          
          <button
            onClick={onToggleCopilot}
            className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center border border-white/5 transition-all text-white/60 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Time Machine Indicator Header */}
      <div className="px-6 py-2.5 bg-violet-500/10 border-b border-violet-500/10 relative z-10 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-[8px] font-black uppercase bg-violet-500/20 text-violet-300 px-2 py-0.5 rounded">
            Temporal
          </span>
          <span className="text-[9px] font-bold text-violet-200">
            Análise focada em <span className="capitalize">{activeMonthLabel}</span>
          </span>
        </div>
        <span className="text-[8px] text-white/40 font-black uppercase tracking-widest">
          {monthOffset === 0 ? "Tempo Presente" : `+${monthOffset}m no Futuro`}
        </span>
      </div>

      {/* Painel Cognitivo do Jarvis (🧠 Memória de Longo Prazo) */}
      {memoryFacts.length > 0 && (
        <div className="relative z-10 px-6 py-2.5 bg-indigo-500/5 border-b border-indigo-500/10 flex flex-col shrink-0">
          <button 
            type="button"
            onClick={() => setIsMemoryOpen(!isMemoryOpen)}
            className="flex items-center justify-between text-left w-full hover:opacity-80 transition-opacity"
          >
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
              <span className="text-[8px] font-black text-indigo-300 uppercase tracking-widest flex items-center gap-1.5">
                🧠 Jarvis Lembra de {memoryFacts.length} fatos
              </span>
            </div>
            <span className="text-[7px] font-black text-indigo-400/60 uppercase">
              {isMemoryOpen ? "Recolher" : "Visualizar"}
            </span>
          </button>

          <AnimatePresence>
            {isMemoryOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden mt-2 border-t border-indigo-500/5 pt-2"
              >
                <div className="max-h-60 overflow-y-auto space-y-3 custom-scrollbar pr-1">
                  {/* Categoria 1: Perfil */}
                  {groupedFacts.profile && groupedFacts.profile.length > 0 && (
                    <div className="space-y-1">
                      <span className="text-[7.5px] font-black uppercase text-indigo-400/80 tracking-widest block">
                        💼 Perfil & Renda
                      </span>
                      <div className="space-y-1">
                        {groupedFacts.profile.map((fact, idx) => (
                          <div key={idx} className="text-[8.5px] font-bold text-white/70 bg-indigo-500/5 border border-indigo-500/10 rounded-lg p-1.5 leading-normal">
                            {fact}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Categoria 2: Objetivos */}
                  {groupedFacts.goals && groupedFacts.goals.length > 0 && (
                    <div className="space-y-1">
                      <span className="text-[7.5px] font-black uppercase text-emerald-400/80 tracking-widest block">
                        🎯 Objetivos & Sonhos
                      </span>
                      <div className="space-y-1">
                        {groupedFacts.goals.map((fact, idx) => (
                          <div key={idx} className="text-[8.5px] font-bold text-white/70 bg-emerald-500/5 border border-emerald-500/10 rounded-lg p-1.5 leading-normal">
                            {fact}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Categoria 3: Preocupações */}
                  {groupedFacts.fears && groupedFacts.fears.length > 0 && (
                    <div className="space-y-1">
                      <span className="text-[7.5px] font-black uppercase text-rose-400/80 tracking-widest block">
                        🛑 Preocupações & Dores
                      </span>
                      <div className="space-y-1">
                        {groupedFacts.fears.map((fact, idx) => (
                          <div key={idx} className="text-[8.5px] font-bold text-white/70 bg-rose-500/5 border border-rose-500/10 rounded-lg p-1.5 leading-normal">
                            {fact}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Categoria 4: Preferências */}
                  {groupedFacts.preferences && groupedFacts.preferences.length > 0 && (
                    <div className="space-y-1">
                      <span className="text-[7.5px] font-black uppercase text-amber-400/80 tracking-widest block">
                        🛠️ Preferências de Decisão
                      </span>
                      <div className="space-y-1">
                        {groupedFacts.preferences.map((fact, idx) => (
                          <div key={idx} className="text-[8.5px] font-bold text-white/70 bg-amber-500/5 border border-amber-500/10 rounded-lg p-1.5 leading-normal">
                            {fact}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-end pt-2 mt-2 border-t border-white/5">
                  <button
                    type="button"
                    onClick={() => handleClearHistory(true)}
                    className="text-[7px] font-black uppercase text-red-400/60 hover:text-red-400 transition-colors"
                    title="Apagar permanentemente a memória de longo prazo da IA"
                  >
                    Resetar Memória de Longo Prazo
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Área de Mensagens */}
      <div className="flex-1 overflow-y-auto p-6 space-y-5 custom-scrollbar relative z-10">
        {isInitializing ? (
          <div className="space-y-4">
            {[1, 2].map((i) => (
              <div key={i} className="flex gap-3 max-w-[80%] animate-pulse">
                <div className="w-7 h-7 rounded-lg bg-white/5 border border-white/5" />
                <div className="space-y-2 flex-1">
                  <div className="h-4 bg-white/5 rounded-[12px] w-3/4" />
                  <div className="h-3 bg-white/5 rounded-[8px] w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          messages.map((msg, index) => {
          const parsed = parseMessageTextAndSimulations(msg.text);
          return (
            <div key={index} className="space-y-3">
              {/* Balão de Mensagem Tradicional */}
              <div
                className={cn(
                  "flex gap-3 max-w-[90%]",
                  msg.role === "user" ? "ml-auto flex-row-reverse" : ""
                )}
              >
                <div
                  className={cn(
                    "w-7 h-7 rounded-lg shrink-0 flex items-center justify-center border",
                    msg.role === "user"
                      ? "bg-violet-600/10 border-violet-500/20 text-violet-400"
                      : "bg-white/5 border-white/5 text-white/40"
                  )}
                >
                  {msg.role === "user" ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
                </div>
                <div
                  className={cn(
                    "p-4 rounded-[20px] text-[11px] leading-relaxed whitespace-pre-line font-medium shadow-inner",
                    msg.role === "user"
                      ? "bg-violet-600 text-white rounded-tr-none"
                      : "bg-white/[0.03] border border-white/5 text-white/80 rounded-tl-none"
                  )}
                >
                  {parsed.text}
                </div>
              </div>

              {/* Cartões de Simulação Parseados (Se existirem) */}
              {parsed.simulations.map((sim, simIdx) => {
                const simKey = `${sim.title}-${index}`;
                const isSimulated = activeSimulations.some(
                  (s) => s.description === `Simulado: ${sim.title}`
                );
                const hasSavedGoal = metaSalvaFeedback[simKey];
                const hasScheduled = agendaFeedback[simKey];
                const currentAccountId = selectedAccounts[simKey] || (accounts.length > 0 ? accounts[0].id : "");

                return (
                  <motion.div
                    key={simIdx}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="ml-10 p-5 rounded-[24px] bg-gradient-to-tr from-violet-950/20 to-indigo-950/20 border border-violet-500/20 space-y-4 shadow-2xl relative overflow-hidden"
                  >
                    <div className="absolute top-0 right-0 w-24 h-24 bg-violet-500/5 blur-xl pointer-events-none" />
                    
                    {/* Linha 1: Título e Tipo */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-violet-400" />
                        <span className="text-[10px] font-black text-violet-400 uppercase tracking-widest">
                          {sim.type === "loan" ? "Simulação de Crédito/Empréstimo" : "Simulação de Gasto"}
                        </span>
                      </div>
                      <span className="text-[9px] font-bold text-white/40">
                        {sim.installments}x parcelas
                      </span>
                    </div>

                    {/* Linha 2: Valor e Detalhes */}
                    <div>
                      <h4 className="text-sm font-black text-white">{sim.title}</h4>
                      <div className="flex items-baseline gap-2 mt-1">
                        <span className="text-xl font-black text-emerald-400">
                          {formatCurrency(sim.amount * 100)}
                        </span>
                        {sim.installments > 1 && (() => {
                          const amountCents = sim.amount * 100;
                          let installmentCents = Math.round(amountCents / sim.installments);
                          if (sim.customInstallment && sim.customInstallment > 0) {
                            installmentCents = Math.round(sim.customInstallment * 100);
                          } else if (sim.type === "loan") {
                            const rate = (sim.interestRate && sim.interestRate > 0) ? sim.interestRate : 9.53;
                            const i = rate / 100;
                            const n = sim.installments;
                            const pmt = amountCents * (i * Math.pow(1 + i, n)) / (Math.pow(1 + i, n) - 1);
                            installmentCents = Math.round(pmt);
                          }
                          return (
                            <span className="text-[10px] text-white/50">
                              (ou {sim.installments}x de {formatCurrency(installmentCents)})
                            </span>
                          );
                        })()}
                      </div>
                      {sim.interestRate && sim.interestRate > 0 ? (
                        <p className="text-[9px] text-red-400 font-bold mt-1">
                          Taxa de Juros: {sim.interestRate}% a.m.
                        </p>
                      ) : null}
                    </div>

                    {/* Descrições da IA */}
                    <div className="text-[10px] text-white/60 space-y-2 border-t border-white/5 pt-3">
                      <p>{sim.description}</p>
                      <div className="p-3 rounded-xl bg-white/5 border border-white/5 flex items-start gap-2">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                        <p className="text-[9px] text-amber-300 font-bold leading-normal">
                          {sim.impactAnalysis}
                        </p>
                      </div>
                    </div>

                    {/* Seletor de Conta para Agendar */}
                    <div className="flex flex-col gap-1.5 border-t border-white/5 pt-3">
                      <label className="text-[8px] font-black text-white/30 uppercase tracking-widest">
                        Conta para Agendamento / Simulação:
                      </label>
                      <select
                        value={currentAccountId}
                        onChange={(e) => setSelectedAccounts(prev => ({ ...prev, [simKey]: e.target.value }))}
                        className="bg-black/40 border border-white/5 text-white/80 rounded-xl px-3 py-2 text-[10px] focus:outline-none focus:border-violet-500/50"
                      >
                        {accounts.map(acc => {
                          const isCard = acc.type === "CREDIT_CARD";
                          const label = isCard ? "Fatura" : "Saldo";
                          const amount = isCard 
                            ? (Number(acc.closed_invoice_cents) || 0) + (Number(acc.open_invoice_cents) || 0)
                            : acc.balance_cents;
                          return (
                            <option key={acc.id} value={acc.id}>
                              {acc.name} ({label}: {formatCurrency(amount)})
                            </option>
                          );
                        })}
                      </select>
                    </div>

                    {/* Botões de Ação Interativos */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 border-t border-white/5 pt-3">
                      {/* Simular no Caixa */}
                      <button
                        onClick={() => handleActionSimulate(sim, index)}
                        className={cn(
                          "py-2 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 border active:scale-95",
                          isSimulated
                            ? "bg-violet-600 border-violet-500 text-white shadow-lg shadow-violet-600/20"
                            : "bg-white/5 border-white/5 text-violet-300 hover:bg-violet-500/10"
                        )}
                      >
                        <TrendingUp className="w-3 h-3" />
                        {isSimulated ? "Simulado" : "Simular Caixa"}
                      </button>

                      {/* Salvar como Meta */}
                      <button
                        onClick={() => handleActionSaveAsGoal(sim, index)}
                        disabled={hasSavedGoal}
                        className={cn(
                          "py-2 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 border active:scale-95 disabled:pointer-events-none",
                          hasSavedGoal
                            ? "bg-emerald-600/20 border-emerald-500/20 text-emerald-400"
                            : "bg-white/5 border-white/5 text-emerald-300 hover:bg-emerald-500/10"
                        )}
                      >
                        {hasSavedGoal ? (
                          <>
                            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                            Salvo!
                          </>
                        ) : (
                          <>
                            <Target className="w-3 h-3" />
                            Criar Meta
                          </>
                        )}
                      </button>

                      {/* Agendar Lançamento */}
                      <button
                        onClick={() => handleActionSchedule(sim, index)}
                        disabled={hasScheduled}
                        className={cn(
                          "py-2 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 border active:scale-95 disabled:pointer-events-none",
                          hasScheduled
                            ? "bg-blue-600/20 border-blue-500/20 text-blue-400"
                            : "bg-white/5 border-white/5 text-blue-300 hover:bg-blue-500/10"
                        )}
                      >
                        {hasScheduled ? (
                          <>
                            <CheckCircle2 className="w-3 h-3 text-blue-400" />
                            Agendado!
                          </>
                        ) : (
                          <>
                            <Calendar className="w-3 h-3" />
                            Confirmar
                          </>
                        )}
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          );
        }))}

        {isLoading && (
          <div className="flex gap-3 max-w-[90%]">
            <div className="w-7 h-7 rounded-lg shrink-0 flex items-center justify-center bg-white/5 border border-white/5 text-white/40">
              <Bot className="w-3.5 h-3.5" />
            </div>
            <div className="p-4 rounded-2xl rounded-tl-none bg-white/[0.02] border border-white/5 flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 text-violet-400 animate-spin" />
              <span className="text-[9px] font-bold text-white/40 uppercase tracking-widest">
                Refazendo projeções financeiras...
              </span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Sugestões Rápidas (Aparecem quando o histórico está limpo/apenas boas-vindas) */}
      {messages.length === 1 && !isLoading && (
        <div className="px-6 py-3 relative z-10 flex flex-col gap-2 shrink-0 border-t border-white/5 bg-[#070708]/50">
          <p className="text-[8px] font-black text-white/20 uppercase tracking-[0.2em]">
            Ideias de Exploração Contextual:
          </p>
          {[
            "Simular empréstimo de 3000 para emergências",
            "Consigo comprar um fogão de 800 parcelado em 4x?",
            "Qual o impacto de gastar 500 no mercado agora?"
          ].map((q, idx) => (
            <button
              key={idx}
              onClick={() => handleQuickQuestion(q)}
              className="flex items-center justify-between text-left p-2.5 rounded-xl bg-white/[0.02] hover:bg-white/5 border border-white/5 text-[9px] font-bold text-white/40 hover:text-white/80 transition-all group"
            >
              <span>{q}</span>
              <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-violet-400" />
            </button>
          ))}
        </div>
      )}

      {/* Formulário de Input */}
      <form
        onSubmit={handleSend}
        className="relative z-10 p-6 border-t border-white/5 bg-[#070708] flex gap-2 shrink-0"
      >
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Peça análises de compras, metas ou crédito..."
          className="flex-1 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/20 text-[11px] font-medium focus:outline-none focus:border-violet-500/50 transition-all"
          disabled={isLoading}
        />
        <button
          type="submit"
          className="p-3 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:bg-violet-600/30 text-white shadow-lg shadow-violet-600/20 transition-all active:scale-95"
          disabled={!message.trim() || isLoading}
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
