"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { MobileNav } from "./MobileNav";
import { MobileHeader } from "./MobileHeader";
import { AddTransactionModal } from "./AddTransactionModal";
import { AddAccountModal } from "./AddAccountModal";
import { AddSubscriptionModal } from "./AddSubscriptionModal";
import { AddGoalModal } from "./AddGoalModal";
import { ContributionModal } from "./ContributionModal";
import { GoalDetailModal } from "./GoalDetailModal";
import { TransferModal } from "./TransferModal";
import { SyncUser } from "./SyncUser";
import { FinanceBridgeHUD } from "./FinanceBridgeHUD";
import { cn } from "@/lib/utils";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname === "/login";

  return (
    <div className="flex min-h-screen">
      {!isLoginPage && <Sidebar />}
      <main 
        className={cn(
          "flex-1 min-h-screen relative overflow-x-hidden",
          !isLoginPage && "md:pl-64"
        )}
      >
        {/* Background elements */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-violet-600/20 blur-[120px] rounded-full animate-pulse" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-fuchsia-600/20 blur-[120px] rounded-full" />
        </div>
        
        {!isLoginPage && <MobileHeader />}
        {!isLoginPage && <FinanceBridgeHUD />}
        <div className={cn(!isLoginPage && "pt-16 pb-24 md:pt-0 md:pb-0")}>
          {children}
        </div>
        {!isLoginPage && <MobileNav />}
      </main>
      
      {!isLoginPage && (
        <>
          <SyncUser />
          <AddTransactionModal />
          <AddAccountModal />
          <AddSubscriptionModal />
          <AddGoalModal />
          <ContributionModal />
          <GoalDetailModal />
          <TransferModal />
        </>
      )}
    </div>
  );
}
