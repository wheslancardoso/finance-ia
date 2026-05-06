"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  LayoutDashboard, 
  ArrowLeftRight, 
  Wallet, 
  Target, 
  Settings,
  PieChart
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

const menuItems = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Transações", href: "/transactions", icon: ArrowLeftRight },
  { name: "Contas", href: "/accounts", icon: Wallet },
  { name: "Metas", href: "/goals", icon: Target },
  { name: "Relatórios", href: "/reports", icon: PieChart },
  { name: "Configurações", href: "/settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 border-r border-white/10 bg-black/20 backdrop-blur-2xl z-50 flex flex-col p-6 hidden md:flex">
      {/* Brand */}
      <div className="flex items-center gap-3 mb-12 px-2">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 shadow-lg shadow-violet-500/20 flex items-center justify-center">
          <span className="text-white font-bold text-xl">L</span>
        </div>
        <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-white/60 tracking-tight">
          Liquid Finance
        </h1>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-2">
        {menuItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 group relative",
                isActive 
                  ? "text-white bg-white/5 shadow-inner" 
                  : "text-white/50 hover:text-white/80 hover:bg-white/5"
              )}
            >
              <item.icon className={cn(
                "w-5 h-5 transition-transform duration-300 group-hover:scale-110",
                isActive ? "text-violet-400" : "text-white/40 group-hover:text-violet-300"
              )} />
              <span className="font-medium">{item.name}</span>

              {isActive && (
                <motion.div
                  layoutId="active-pill"
                  className="absolute left-0 w-1 h-6 bg-violet-500 rounded-full"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3 }}
                />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom Profile / Status */}
      <div className="pt-6 border-t border-white/10 mt-auto">
        <div className="flex items-center gap-3 px-2">
          <div className="w-10 h-10 rounded-full bg-white/10 border border-white/10 flex items-center justify-center overflow-hidden">
             <div className="w-full h-full bg-gradient-to-tr from-violet-600/40 to-fuchsia-600/40 animate-pulse" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-medium text-white">Usuário</span>
            <span className="text-xs text-white/40">Plano Pro</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
