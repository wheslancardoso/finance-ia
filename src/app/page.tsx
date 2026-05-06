import { createClient } from "@/utils/supabase/server";
import RealtimeDashboard from "@/components/RealtimeDashboard";

export default async function Home() {
  const supabase = await createClient();
  
  const { data: transactions } = await supabase
    .from("transactions")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(3);

  // Cast initial data to match the component's expectations
  const initialTransactions = (transactions || []).map((tx: any) => ({
    id: tx.id,
    created_at: tx.created_at,
    description: tx.description,
    amount: tx.amount || tx.amount_cents || 0,
    type: tx.type || "EXPENSE",
  }));

  // Initial balance fixed as per previous requirement (4500 cents)
  const initialBalance = 4500;

  return (
    <main className="relative min-h-screen w-full flex items-center justify-center overflow-hidden bg-[#030303] py-12">
      {/* Dynamic Background Blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-purple-600/30 blur-[120px] animate-pulse" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-blue-600/20 blur-[120px]" />
      <div className="absolute top-[20%] right-[10%] w-[30%] h-[30%] rounded-full bg-indigo-600/20 blur-[100px]" />

      <RealtimeDashboard 
        initialBalance={initialBalance} 
        initialTransactions={initialTransactions} 
      />
    </main>
  );
}
