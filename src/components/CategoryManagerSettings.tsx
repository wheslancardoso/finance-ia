"use client";

import React, { useState } from "react";
import { useFinancialData } from "@/context/FinancialDataContext";
import { financialService } from "@/services/financialService";
import { 
  Tags, Plus, Edit2, CheckCircle2, Save, X, EyeOff, FileBarChart, Scale
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Category } from "@/lib/db";

export function CategoryManagerSettings() {
  const { categories, refreshData } = useFinancialData();
  const [editingCategory, setEditingCategory] = useState<Partial<Category> | null>(null);
  const [loading, setLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const handleSave = async () => {
    if (!editingCategory?.name || !editingCategory?.type) return;
    setLoading(true);

    const { error } = await financialService.upsertCategory(editingCategory);

    if (!error) {
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
      setEditingCategory(null);
      refreshData();
    }
    setLoading(false);
  };

  const handleEdit = (category: Category) => {
    setEditingCategory({ ...category });
  };

  const handleNew = () => {
    setEditingCategory({
      name: "",
      type: "EXPENSE",
      icon_name: "Tags",
      color_hex: "#9CA3AF",
      ignore_dashboard: false,
      ignore_reports: false,
      ignore_balance: false
    });
  };

  return (
    <div className="space-y-6" data-testid="category-manager-settings">
      {!editingCategory ? (
        <>
          <div className="flex items-center justify-between">
            <p className="text-[10px] text-white/40 uppercase tracking-widest font-black">
              Categorias Cadastradas ({categories.length})
            </p>
            <button
              onClick={handleNew}
              className="flex items-center gap-2 bg-violet-500 hover:bg-violet-600 text-white px-3 py-1.5 rounded-xl text-[10px] uppercase font-black tracking-widest transition-colors"
            >
              <Plus className="w-3 h-3" />
              Nova
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
            {categories.map((cat) => (
              <div 
                key={cat.id}
                className="flex items-center justify-between p-3 rounded-2xl bg-white/5 border border-white/5 hover:border-white/10 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div 
                    className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                    style={{ backgroundColor: `${cat.color_hex}20`, color: cat.color_hex }}
                  >
                    <Tags className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white">{cat.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={cn(
                        "text-[8px] uppercase font-black tracking-widest",
                        cat.type === 'INCOME' ? "text-emerald-400" : "text-rose-400"
                      )}>
                        {cat.type === 'INCOME' ? "Receita" : "Despesa"}
                      </span>
                      
                      {(cat.ignore_dashboard || cat.ignore_balance) && (
                        <div className="flex gap-1" title={cat.ignore_dashboard ? "Oculto do Dashboard" : "Ignorado no Saldo"}>
                          {cat.ignore_dashboard && <EyeOff className="w-3 h-3 text-amber-400" />}
                          {cat.ignore_balance && <Scale className="w-3 h-3 text-rose-400" />}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                
                <button
                  onClick={() => handleEdit(cat)}
                  disabled={cat.is_system_default}
                  className="p-2 text-white/20 hover:text-white/60 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="space-y-4 p-4 rounded-3xl bg-white/5 border border-white/10 relative">
          <button 
            onClick={() => setEditingCategory(null)}
            className="absolute top-4 right-4 text-white/20 hover:text-white/60 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
          
          <h4 className="text-sm font-bold text-white mb-4">
            {editingCategory.id ? "Editar Categoria" : "Nova Categoria"}
          </h4>

          <div className="space-y-3">
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-white/40 ml-1">Nome da Categoria</label>
              <input
                type="text"
                value={editingCategory.name || ""}
                onChange={(e) => setEditingCategory({ ...editingCategory, name: e.target.value })}
                className="w-full mt-1 bg-black/20 border border-white/10 rounded-xl py-3 px-4 text-white text-sm outline-none focus:border-violet-500/50"
                placeholder="Ex: Assinaturas"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-white/40 ml-1">Tipo</label>
                <select
                  value={editingCategory.type}
                  onChange={(e) => setEditingCategory({ ...editingCategory, type: e.target.value as any })}
                  className="w-full mt-1 bg-black/20 border border-white/10 rounded-xl py-3 px-4 text-white text-sm outline-none focus:border-violet-500/50 appearance-none"
                >
                  <option value="EXPENSE">Despesa</option>
                  <option value="INCOME">Receita</option>
                </select>
              </div>
              
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-white/40 ml-1">Cor (Hex)</label>
                <div className="flex gap-2 mt-1">
                  <input
                    type="color"
                    value={editingCategory.color_hex || "#9CA3AF"}
                    onChange={(e) => setEditingCategory({ ...editingCategory, color_hex: e.target.value })}
                    className="w-12 h-[46px] rounded-xl cursor-pointer bg-black/20 border border-white/10"
                  />
                  <input
                    type="text"
                    value={editingCategory.color_hex || ""}
                    onChange={(e) => setEditingCategory({ ...editingCategory, color_hex: e.target.value })}
                    className="flex-1 bg-black/20 border border-white/10 rounded-xl px-4 text-white text-sm outline-none uppercase"
                  />
                </div>
              </div>
            </div>

            <div className="pt-2 pb-2">
              <div className="h-px bg-white/10 w-full mb-3" />
              <h5 className="text-[10px] font-black text-amber-400 uppercase tracking-widest mb-3">Diretrizes Avançadas (Shadow Flags)</h5>
              
              <div className="space-y-3">
                <label className="flex items-start gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={editingCategory.ignore_dashboard || false}
                    onChange={(e) => setEditingCategory({ ...editingCategory, ignore_dashboard: e.target.checked })}
                    className="mt-1 accent-amber-500"
                  />
                  <div>
                    <p className="text-xs font-bold text-white/80 group-hover:text-white transition-colors flex items-center gap-1.5">
                      <EyeOff className="w-3.5 h-3.5" /> Ocultar do Dashboard
                    </p>
                    <p className="text-[10px] text-white/30 leading-tight mt-0.5">Gastos dessa categoria não aparecerão nos gráficos de rosca ou barras do painel principal.</p>
                  </div>
                </label>

                <label className="flex items-start gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={editingCategory.ignore_reports || false}
                    onChange={(e) => setEditingCategory({ ...editingCategory, ignore_reports: e.target.checked })}
                    className="mt-1 accent-amber-500"
                  />
                  <div>
                    <p className="text-xs font-bold text-white/80 group-hover:text-white transition-colors flex items-center gap-1.5">
                      <FileBarChart className="w-3.5 h-3.5" /> Ocultar de Relatórios
                    </p>
                    <p className="text-[10px] text-white/30 leading-tight mt-0.5">Não será somada na aba de relatórios analíticos do ecossistema.</p>
                  </div>
                </label>

                <label className="flex items-start gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={editingCategory.ignore_balance || false}
                    onChange={(e) => setEditingCategory({ ...editingCategory, ignore_balance: e.target.checked })}
                    className="mt-1 accent-rose-500"
                  />
                  <div>
                    <p className="text-xs font-bold text-rose-400/80 group-hover:text-rose-400 transition-colors flex items-center gap-1.5">
                      <Scale className="w-3.5 h-3.5" /> Ignorar no Saldo (Shadow)
                    </p>
                    <p className="text-[10px] text-white/30 leading-tight mt-0.5">CRÍTICO: O valor não será abatido do seu saldo final nem do teto semanal de sobrevivência.</p>
                  </div>
                </label>
              </div>
            </div>

            <button
              onClick={handleSave}
              disabled={loading || !editingCategory.name}
              className={cn(
                "w-full py-4 rounded-xl font-black text-[10px] uppercase tracking-[0.3em] transition-all flex items-center justify-center gap-3 mt-4",
                showSuccess 
                  ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20" 
                  : "bg-violet-600 text-white hover:bg-violet-500 disabled:opacity-50"
              )}
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              ) : showSuccess ? (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Salvo
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Salvar Categoria
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
