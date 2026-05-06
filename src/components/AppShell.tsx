"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { AddTransactionModal } from "./AddTransactionModal";
import { AddAccountModal } from "./AddAccountModal";
import { cn } from "@/lib/utils";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname === "/login";

  return (
    <div className="flex min-h-screen">
      {!isLoginPage && <Sidebar />}
      <main 
        className={cn(
          "flex-1 min-h-screen relative",
          !isLoginPage && "md:pl-64"
        )}
      >
        {/* Background elements */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-violet-600/20 blur-[120px] rounded-full animate-pulse" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-fuchsia-600/20 blur-[120px] rounded-full" />
        </div>
        
        {children}
      </main>
      
      {!isLoginPage && (
        <>
          <AddTransactionModal />
          <AddAccountModal />
        </>
      )}
    </div>
  );
}
