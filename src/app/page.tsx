import RealtimeDashboard from "@/components/RealtimeDashboard";

export default function Home() {
  return (
    <div className="px-4 pb-4 pt-0 md:p-12 max-w-7xl mx-auto w-full">

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
