"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  LayoutDashboard, 
  ArrowLeftRight, 
  Wallet, 
  Target, 
  Plus
} from "lucide-react";
import { useTransactionModal } from "@/context/TransactionModalContext";
import { cn } from "@/lib/utils";

const mobileItems = [
  { name: "Início", href: "/", icon: LayoutDashboard },
  { name: "Transações", href: "/transactions", icon: ArrowLeftRight },
  { name: "Nova", href: "#", icon: Plus, isAction: true },
  { name: "Contas", href: "/accounts", icon: Wallet },
  { name: "Metas", href: "/goals", icon: Target },
];

export function MobileNav() {
  const pathname = usePathname();
  const { openAdd } = useTransactionModal();

  return (
    <div className="fixed bottom-0 left-0 right-0 h-20 bg-black/40 backdrop-blur-xl border-t border-white/10 z-[100] md:hidden flex items-center justify-around px-2 pb-safe">
      {mobileItems.map((item) => {
        const isActive = pathname === item.href;
        
        if (item.isAction) {
          return (
            <button
              key={item.name}
              onClick={() => openAdd()}
              data-testid="mobile-add-button"
              className="w-12 h-12 -mt-8 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 shadow-lg shadow-violet-500/20 flex items-center justify-center text-white active:scale-95 transition-transform"
            >
              <Plus className="w-6 h-6" />
            </button>
          );
        }

        return (
          <Link
            key={item.name}
            href={item.href}
            data-testid={`mobile-nav-${item.href.replace('/', '') || 'home'}`}
            className={cn(
              "flex flex-col items-center gap-1 p-2 transition-all",
              isActive ? "text-violet-400" : "text-white/40"
            )}
          >
            <item.icon className={cn("w-5 h-5", isActive && "animate-pulse")} />
            <span className="text-[10px] font-medium uppercase tracking-wider">{item.name}</span>
          </Link>
        );
      })}
    </div>
  );
}
