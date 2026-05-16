import { db, type UserGamificationProfile } from "@/lib/db";

const generateId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};

async function apiFetch(path: string, options?: RequestInit) {
  console.log(`🌐 [Gamification API Fetch] ${options?.method || 'GET'} ${path}`);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s

  try {
    const res = await fetch(path, {
      ...options,
      cache: 'no-store',
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
    });
    
    clearTimeout(timeoutId);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `API error ${res.status}`);
    }
    return res.json();
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('API timeout exceeded');
    }
    throw error;
  }
}

export const gamificationService = {
  /**
   * Recupera o perfil de gamificação do usuário (API → Dexie fallback)
   */
  async getGamificationProfile(userId: string) {
    if (!userId) return { data: null, error: new Error("userId é obrigatório") };

    try {
      // 1. Tentar buscar da API remota
      const data = await apiFetch("/api/gamification");
      
      // 2. Sincronizar cache local com dados atualizados do Supabase
      if (data) {
        await db.gamification_profile.put(data);
      }
      
      return { data, error: null };
    } catch (error: any) {
      console.warn("⚠️ Falha ao obter dados de gamificação da nuvem, buscando local no Dexie:", error.message);
      
      try {
        // Fallback: buscar dados locais do IndexedDB (Dexie)
        let localProfile = await db.gamification_profile.where("user_id").equals(userId).first();
        
        if (!localProfile) {
          // Se não existir perfil local, gera um de fallback
          localProfile = {
            id: generateId(),
            user_id: userId,
            resilience_points: 0,
            current_streak: 0,
            max_streak: 0,
            active_theme: "brutalist-dark",
            unlocked_achievements: [],
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };
          await db.gamification_profile.put(localProfile);
        }
        
        return { data: localProfile, error };
      } catch (localError: any) {
        console.error("❌ Falha crítica ao buscar perfil de gamificação local:", localError);
        return { data: null, error: localError };
      }
    }
  },

  /**
   * Atualiza as informações do perfil de gamificação (API → Dexie local)
   */
  async upsertGamificationProfile(userId: string, updates: Partial<UserGamificationProfile>) {
    if (!userId) return { data: null, error: new Error("userId é obrigatório") };

    try {
      const currentRes = await this.getGamificationProfile(userId);
      const currentProfile = currentRes.data || {
        id: generateId(),
        user_id: userId,
        resilience_points: 0,
        current_streak: 0,
        max_streak: 0,
        active_theme: "brutalist-dark",
        unlocked_achievements: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const payload = {
        ...currentProfile,
        ...updates,
        user_id: userId,
        updated_at: new Date().toISOString()
      };

      // 1. Sincronizar com a API remota
      const saved = await apiFetch("/api/gamification", {
        method: "POST",
        body: JSON.stringify(payload)
      });

      // 2. Atualizar Dexie local com o retorno salvo
      await db.gamification_profile.put({ ...payload, ...saved });

      return { data: { ...payload, ...saved }, error: null };
    } catch (error: any) {
      console.warn("⚠️ Perfil de gamificação salvo apenas localmente no Dexie:", error.message);
      
      try {
        const localProfile = await db.gamification_profile.where("user_id").equals(userId).first();
        const payload = {
          ...(localProfile || {}),
          ...updates,
          id: localProfile?.id || generateId(),
          user_id: userId,
          updated_at: new Date().toISOString()
        } as UserGamificationProfile;

        await db.gamification_profile.put(payload);
        return { data: payload, error };
      } catch (localError: any) {
        return { data: null, error: localError };
      }
    }
  },

  /**
   * Adiciona ou remove pontos de resiliência de forma protegida
   */
  async addResiliencePoints(userId: string, points: number) {
    const res = await this.getGamificationProfile(userId);
    const currentPoints = res.data?.resilience_points || 0;
    const newPoints = Math.max(0, currentPoints + points);

    return this.upsertGamificationProfile(userId, { resilience_points: newPoints });
  },

  /**
   * Incrementa o streak de consistência mensal
   */
  async incrementStreak(userId: string) {
    const res = await this.getGamificationProfile(userId);
    const currentStreak = res.data?.current_streak || 0;
    const maxStreak = res.data?.max_streak || 0;
    const newStreak = currentStreak + 1;
    const newMaxStreak = Math.max(maxStreak, newStreak);

    return this.upsertGamificationProfile(userId, {
      current_streak: newStreak,
      max_streak: newMaxStreak
    });
  },

  /**
   * Reseta o streak (rachadura de streak)
   */
  async resetStreak(userId: string) {
    return this.upsertGamificationProfile(userId, { current_streak: 0 });
  },

  /**
   * Desbloqueia uma conquista por ID
   */
  async unlockAchievement(userId: string, achievementId: string) {
    const res = await this.getGamificationProfile(userId);
    const achievements = res.data?.unlocked_achievements || [];

    if (achievements.includes(achievementId)) {
      return { data: res.data, error: null };
    }

    const updatedAchievements = [...achievements, achievementId];
    return this.upsertGamificationProfile(userId, { unlocked_achievements: updatedAchievements });
  },

  /**
   * Altera o tema ativo do HUD
   */
  async updateTheme(userId: string, theme: string) {
    return this.upsertGamificationProfile(userId, { active_theme: theme });
  }
};
