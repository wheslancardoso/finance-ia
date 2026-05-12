"use client";

import React from "react";
import { RefreshCcw, User } from "lucide-react";
import Link from "next/link";
import { useFinancialData } from "@/context/FinancialDataContext";
import { cn } from "@/lib/utils";

export function MobileHeader() {
  const { refreshData, loading } = useFinancialData();

  return (
    <header className="fixed top-0 left-0 right-0 h-16 bg-black/20 backdrop-blur-xl border-b border-white/10 z-[100] md:hidden flex items-center justify-between px-6">
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
          <span className="text-white font-bold text-sm">V</span>
        </div>
        <span className="text-lg font-bold tracking-tight text-white">Vesper</span>
      </div>

      <div className="flex items-center gap-4">
        <button 
          onClick={() => refreshData()}
          className="p-2 rounded-full bg-white/5 border border-white/10 text-white/40"
        >
          <RefreshCcw className={cn("w-4 h-4", loading && "animate-spin text-violet-400")} />
        </button>
        <Link 
          href="/settings"
          data-testid="mobile-profile-button"
          className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-colors"
        >
          <User className="w-4 h-4 text-white/40" />
        </Link>
      </div>
    </header>
  );
}
