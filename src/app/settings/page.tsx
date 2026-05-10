import { createClient } from "@/utils/supabase/server";
import { getUserId } from "@/utils/supabase/auth-helpers";
import { redirect } from "next/navigation";
import { Shield, Zap, Palette, Bell, CreditCard, ChevronRight, UserPlus, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { WhatsAppSettings } from "@/components/WhatsAppSettings";

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const userId = await getUserId();

  // Buscar members do grupo e o profile do usuário logado
  const { data: profileData } = await supabase
    .from("profiles")
    .select("whatsapp_number")
    .eq("id", user.id)
    .single();

  const sections = [
    {
      id: "whatsapp",
      title: "Protocolo WhatsApp",
      subtitle: "Vincule seu número para comandar o Vesper via mensagens.",
      icon: MessageSquare,
      color: "text-emerald-400",
      bg: "bg-emerald-400/10",
      content: <WhatsAppSettings userId={user.id} initialNumber={profileData?.whatsapp_number} />
    },
    {
      id: "preferences",
      title: "Preferências",
      subtitle: "Personalize sua experiência no Centro de Comando.",
      icon: Palette,
      color: "text-amber-400",
      bg: "bg-amber-400/10",
      content: (
        <div className="space-y-3">
          <div className="p-4 rounded-3xl bg-white/[0.02] border border-white/5 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-white">Moeda Padrão</p>
              <p className="text-[10px] text-white/20 uppercase font-black tracking-widest">Real Brasileiro (BRL)</p>
            </div>
            <ChevronRight className="w-4 h-4 text-white/10" />
          </div>
          <div className="p-4 rounded-3xl bg-white/[0.02] border border-white/5 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-white">Tema Visual</p>
              <p className="text-[10px] text-white/20 uppercase font-black tracking-widest">Liquid Glass (Dark)</p>
            </div>
            <ChevronRight className="w-4 h-4 text-white/10" />
          </div>
        </div>
      )
    }
  ];

  return (
    <div className="p-8 md:p-12 max-w-4xl mx-auto w-full space-y-12">
      <header className="space-y-2">
        <div className="flex items-center gap-3 text-violet-400">
          <Shield className="w-5 h-5" />
          <span className="text-[10px] font-black uppercase tracking-[0.3em]">Vault Control</span>
        </div>
        <h1 className="text-4xl font-black text-white tracking-tighter">Configurações</h1>
        <p className="text-white/40 max-w-md">Gerencie seu ecossistema financeiro e personalize suas diretrizes de comando.</p>
      </header>

      <div className="grid gap-8">
        {sections.map((section) => (
          <section key={section.id} className="relative group">
            {/* Connector Line */}
            <div className="absolute -left-6 top-10 bottom-0 w-[1px] bg-gradient-to-b from-white/10 to-transparent" />
            
            <div className="flex items-start gap-6">
              <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border border-white/10 shadow-2xl", section.bg)}>
                <section.icon className={cn("w-6 h-6", section.color)} />
              </div>
              
              <div className="flex-1 space-y-6">
                <div>
                  <h3 className="text-xl font-bold text-white tracking-tight">{section.title}</h3>
                  <p className="text-sm text-white/30">{section.subtitle}</p>
                </div>
                
                <div className="bg-white/[0.01] border border-white/5 rounded-[40px] p-6 backdrop-blur-sm shadow-2xl">
                  {section.content}
                </div>
              </div>
            </div>
          </section>
        ))}
      </div>

      <footer className="pt-12 flex flex-col items-center gap-4 text-center">
        <div className="w-full h-[1px] bg-gradient-to-r from-transparent via-white/5 to-transparent mb-8" />
        <p className="text-[10px] font-black text-white/10 uppercase tracking-[0.5em]">Vesper v1.0.4 - Secure Connection</p>
        <button className="text-red-500/40 hover:text-red-500 text-[10px] font-black uppercase tracking-widest transition-colors">Encerrar Sessão de Comando</button>
      </footer>
    </div>
  );
}
