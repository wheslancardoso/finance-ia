import RealtimeDashboard from "@/components/RealtimeDashboard";

export default function Home() {
  return (
    <div className="p-6 md:p-12 max-w-7xl mx-auto w-full">

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
