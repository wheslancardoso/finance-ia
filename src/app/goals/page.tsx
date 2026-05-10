import { GoalsManager } from "@/components/GoalsManager";

export default function GoalsPage() {
  const goals: any[] = [];

  return (
    <div className="p-8 md:p-12 max-w-7xl mx-auto w-full">
      <GoalsManager initialGoals={goals || []} />
    </div>
  );
}
