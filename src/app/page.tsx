import RealtimeDashboard from "@/components/RealtimeDashboard";
import SurvivalHUD from "@/components/SurvivalHUD";

export default function Home() {
  return (
    <div className="p-6 md:p-12 max-w-7xl mx-auto w-full space-y-8">
      <header className="flex flex-col gap-1">
        <h2 className="text-3xl font-bold tracking-tight text-white">Dashboard</h2>
        <p className="text-white/40">Bem-vindo de volta ao Centro de Comando.</p>
      </header>

      <SurvivalHUD />

      <RealtimeDashboard
        initialBalance={0}
        initialTransactions={[]}
        initialBudgets={[]}
        initialRecurring={[]}
        lastFutureTransactionDate={null}
        accounts={[]}
      />
    </div>
  );
}
