import { useState, useEffect, useCallback } from "react";
import { useFinancialData } from "@/context/FinancialDataContext";
import { gamificationService } from "@/services/gamificationService";
import { type UserGamificationProfile } from "@/lib/db";
import { calculateAntifragilityTier } from "@/domain/financial/financial-logic";

export type AntifragilityTier = 0 | 1 | 2 | 3;

export interface TierInfo {
  tier: AntifragilityTier;
  name: string;
  colorClass: string;
  accentColor: string;
  glowClass: string;
  bgGradient: string;
  description: string;
}

export const TIERS: Record<AntifragilityTier, TierInfo> = {
  0: {
    tier: 0,
    name: "Zona de Oxigênio (Crise)",
    colorClass: "text-rose-500",
    accentColor: "#F43F5E",
    glowClass: "shadow-[0_0_25px_rgba(244,63,94,0.5)]",
    bgGradient: "from-rose-500/20 to-transparent",
    description: "Seu oxigênio financeiro está abaixo do nível crítico. O HUD bloqueou metas de consumo e foca 100% na sobrevivência."
  },
  1: {
    tier: 1,
    name: "Sobrevivente",
    colorClass: "text-violet-400",
    accentColor: "#A78BFA",
    glowClass: "shadow-[0_0_15px_rgba(167,139,250,0.3)]",
    bgGradient: "from-violet-500/10 to-transparent",
    description: "Metas básicas e essenciais ativas. Foco em consolidar um colchão de segurança de curto prazo."
  },
  2: {
    tier: 2,
    name: "Imune",
    colorClass: "text-emerald-400",
    accentColor: "#34D399",
    glowClass: "shadow-[0_0_15px_rgba(52,211,153,0.3)]",
    bgGradient: "from-emerald-500/10 to-transparent",
    description: "Resiliência sólida (mais de 3 meses de despesas cobertos). Ambições de médio prazo totalmente liberadas."
  },
  3: {
    tier: 3,
    name: "Antifrágil",
    colorClass: "text-amber-400",
    accentColor: "#F59E0B",
    glowClass: "shadow-[0_0_20px_rgba(245,158,11,0.4)]",
    bgGradient: "from-amber-500/10 to-transparent",
    description: "Liberdade financeira avançada (mais de 6 meses de despesas cobertos). Acesso total a aportes de longo prazo e investimentos."
  }
};

export function useGamification() {
  const { userId, netLiquidityCents, fixedExpensesCents } = useFinancialData();
  const [profile, setProfile] = useState<UserGamificationProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await gamificationService.getGamificationProfile(userId);
    if (data) {
      setProfile(data);
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  // Cálculo matemático do Tier de Resiliência com base em liquidez consolidada real e despesa fixa
  const tier: AntifragilityTier = calculateAntifragilityTier(netLiquidityCents, fixedExpensesCents) as AntifragilityTier;

  const tierInfo = TIERS[tier];

  const addPoints = async (points: number) => {
    if (!userId) return;
    const { data } = await gamificationService.addResiliencePoints(userId, points);
    if (data) setProfile(data);
  };

  const incrementStreak = async () => {
    if (!userId) return;
    const { data } = await gamificationService.incrementStreak(userId);
    if (data) setProfile(data);
  };

  const resetStreak = async () => {
    if (!userId) return;
    const { data } = await gamificationService.resetStreak(userId);
    if (data) setProfile(data);
  };

  const unlockAchievement = async (achievementId: string) => {
    if (!userId) return;
    const { data } = await gamificationService.unlockAchievement(userId, achievementId);
    if (data) setProfile(data);
  };

  const monthsOfCoverage = fixedExpensesCents > 0 ? (netLiquidityCents / fixedExpensesCents) : 0;

  return {
    profile,
    loading,
    tier,
    tierInfo,
    monthsOfCoverage,
    refreshProfile: fetchProfile,
    addPoints,
    incrementStreak,
    resetStreak,
    unlockAchievement
  };
}
