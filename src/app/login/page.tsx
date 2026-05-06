"use client";

import React, { useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, Lock, ArrowRight, Globe, Sparkles, UserPlus, Eye, EyeOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  
  const router = useRouter();
  const supabase = createClient();

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    // 1. Tentar Login
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (!signInError) {
      router.push("/");
      router.refresh();
      return;
    }

    // 2. Se o erro for "Invalid login credentials", pode ser que o usuário não exista
    // Nota: Por segurança, o Supabase às vezes retorna o mesmo erro para usuário inexistente ou senha errada.
    // Vamos tentar o SignUp se o erro indicar que não foi possível logar.
    if (signInError.message.includes("Invalid login credentials")) {
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (signUpError) {
        setMessage({ type: "error", text: signUpError.message });
        setLoading(false);
        return;
      }

      setMessage({ 
        type: "success", 
        text: "Conta criada! Verifique seu e-mail ou tente entrar novamente." 
      });
    } else {
      setMessage({ type: "error", text: signInError.message });
    }

    setLoading(false);
  }

  async function handleForgotPassword() {
    if (!email) {
      setMessage({ type: "error", text: "Digite seu e-mail primeiro." });
      return;
    }
    
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    });

    if (error) {
      setMessage({ type: "error", text: error.message });
    } else {
      setMessage({ type: "success", text: "E-mail de recuperação enviado!" });
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-violet-600/20 blur-[120px] rounded-full pointer-events-none" />
      
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-12">
          <div className="w-16 h-16 bg-white/5 rounded-[22px] border border-white/10 flex items-center justify-center mx-auto mb-6 shadow-2xl">
            <Sparkles className="w-8 h-8 text-violet-500" />
          </div>
          <h1 className="text-4xl font-bold text-white tracking-tight mb-2">
            Ves<span className="text-violet-500">per</span>
          </h1>
          <p className="text-white/40 font-medium">Controle financeiro em estado de fluxo.</p>
        </div>

        <div className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-[32px] p-8 shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-violet-500/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          
          <form onSubmit={handleAuth} className="space-y-6">
            {message && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className={cn(
                  "p-4 rounded-2xl text-sm font-medium border",
                  message.type === "success" 
                    ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" 
                    : "bg-red-500/10 border-red-500/20 text-red-400"
                )}
              >
                {message.text}
              </motion.div>
            )}

            <div className="space-y-4">
              <div className="relative group">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/20 group-focus-within:text-violet-500 transition-colors" />
                <input
                  type="email"
                  placeholder="Seu e-mail"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-white/5 border border-white/5 rounded-2xl py-4 pl-12 pr-4 text-white placeholder:text-white/20 outline-none focus:border-violet-500/50 transition-all"
                  required
                />
              </div>

              <div className="space-y-2">
                <div className="relative group">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/20 group-focus-within:text-violet-500 transition-colors" />
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="Sua senha"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-white/5 border border-white/5 rounded-2xl py-4 pl-12 pr-12 text-white placeholder:text-white/20 outline-none focus:border-violet-500/50 transition-all"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-white/20 hover:text-white transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                
                <div className="flex justify-end px-1">
                  <button 
                    type="button"
                    onClick={handleForgotPassword}
                    className="text-xs font-bold text-white/20 hover:text-violet-400 uppercase tracking-widest transition-colors"
                  >
                    Esqueceu a senha?
                  </button>
                </div>
              </div>
            </div>

            <button
              disabled={loading}
              className="w-full bg-violet-600 hover:bg-violet-500 text-white font-bold py-4 rounded-2xl transition-all shadow-lg shadow-violet-600/20 active:scale-[0.98] flex items-center justify-center gap-2 group"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  Entrar no Vesper
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>

          <div className="mt-8 pt-8 border-t border-white/5 space-y-4">
            <p className="text-center text-xs text-white/20 font-bold uppercase tracking-[0.2em]">
              Ou acesse com
            </p>
            <div className="grid grid-cols-2 gap-4">
              <button className="flex items-center justify-center gap-3 bg-white/5 hover:bg-white/10 border border-white/10 py-3 rounded-2xl text-white/60 hover:text-white transition-all text-sm font-medium">
                <Globe className="w-5 h-5" />
                Google
              </button>
              <button className="flex items-center justify-center gap-3 bg-white/5 hover:bg-white/10 border border-white/10 py-3 rounded-2xl text-white/60 hover:text-white transition-all text-sm font-medium">
                <UserPlus className="w-5 h-5" />
                Outros
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
