import GlassCard from "@/components/GlassCard";

export default function ComingSoon() {
  return (
    <div className="p-8 md:p-12 max-w-7xl mx-auto w-full space-y-8">
      <header className="flex flex-col gap-1">
        <h2 className="text-3xl font-bold tracking-tight text-white">Em Breve</h2>
        <p className="text-white/40">Esta funcionalidade está sendo esculpida no Liquid Glass.</p>
      </header>

      <GlassCard className="flex flex-col items-center justify-center py-24 text-center">
        <div className="w-16 h-16 rounded-full bg-violet-500/10 border border-violet-500/20 flex items-center justify-center mb-6 animate-pulse">
           <span className="text-violet-400 font-bold">...</span>
        </div>
        <h3 className="text-xl font-medium text-white mb-2">Construindo Experiência</h3>
        <p className="text-white/40 max-w-sm">
          Estamos integrando os fluxos de dados e as animações para entregar a melhor experiência financeira.
        </p>
      </GlassCard>
    </div>
  );
}
