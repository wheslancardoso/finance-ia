"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { Phone, Check, Loader2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export function WhatsAppSettings({ userId, initialNumber }: { userId: string, initialNumber?: string }) {
  const [number, setNumber] = useState(initialNumber || "");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  const supabase = createClient();

  const handleSave = async () => {
    if (!number) return;
    
    setLoading(true);
    setStatus("idle");
    setMessage("");

    try {
      const { error } = await supabase
        .from("profiles")
        .update({ whatsapp_number: number })
        .eq("id", userId);

      if (error) throw error;

      setStatus("success");
      setMessage("Conexão estabelecida com sucesso.");
    } catch (err: any) {
      console.error(err);
      setStatus("error");
      setMessage(err.message || "Erro ao vincular número.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="relative group">
          <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
            <Phone className={cn(
              "w-4 h-4 transition-colors",
              status === "success" ? "text-emerald-400" : "text-white/20"
            )} />
          </div>
          <input
            type="text"
            placeholder="5511999999999"
            value={number}
            onChange={(e) => setNumber(e.target.value.replace(/\D/g, ""))}
            className="w-full bg-white/[0.02] border border-white/5 rounded-2xl py-4 pl-12 pr-4 text-sm text-white placeholder:text-white/10 focus:outline-none focus:border-violet-500/50 transition-all"
          />
          {status === "success" && (
            <div className="absolute inset-y-0 right-4 flex items-center">
              <Check className="w-4 h-4 text-emerald-400" />
            </div>
          )}
        </div>
        
        <p className="text-[10px] text-white/20 uppercase font-black tracking-widest px-1">
          Insira apenas números com DDD (ex: 5511999999999)
        </p>
      </div>

      <button
        onClick={handleSave}
        disabled={loading || !number}
        className={cn(
          "w-full py-4 rounded-2xl flex items-center justify-center gap-2 transition-all font-black text-[10px] uppercase tracking-[0.2em]",
          loading || !number 
            ? "bg-white/5 text-white/20 cursor-not-allowed" 
            : "bg-violet-600 text-white hover:bg-violet-500 shadow-[0_0_20px_rgba(124,58,237,0.3)]"
        )}
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <>
            <Zap className="w-4 h-4 fill-current" />
            Sincronizar Protocolo WhatsApp
          </>
        )}
      </button>

      {message && (
        <div className={cn(
          "flex items-center gap-2 p-4 rounded-2xl text-[10px] font-bold uppercase tracking-wider animate-in fade-in slide-in-from-top-1",
          status === "success" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-red-500/10 text-red-400 border border-red-500/20"
        )}>
          {status === "error" && <AlertCircle className="w-3 h-3" />}
          {message}
        </div>
      )}
    </div>
  );
}
