import { TransactionsContent } from "@/components/TransactionsContent";

export default function TransactionsPage() {
  const transactions: any[] = [];
  const accounts: any[] = [];

  return (
    <div className="p-8 md:p-12 max-w-7xl mx-auto w-full">
      <TransactionsContent 
        initialTransactions={transactions || []} 
        accounts={accounts || []} 
      />
    </div>
  );
}

