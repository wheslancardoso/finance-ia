"use client";

import React, { useState } from "react";
import { MoreVertical, Edit2, Trash2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface ActionMenuProps {
  onEdit: () => void;
  onDelete: () => void;
  className?: string;
}

export function ActionMenu({ onEdit, onDelete, className }: ActionMenuProps) {
  const [isOpen, setIsOpen] = useState(false);

  const toggleMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsOpen(!isOpen);
  };

  const closeMenu = () => setIsOpen(false);

  const handleEdit = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onEdit();
    closeMenu();
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onDelete();
    closeMenu();
  };

  return (
    <div className={cn("relative inline-block", className)}>
      <button 
        type="button"
        onClick={toggleMenu}
        className="p-2 rounded-xl text-white/20 hover:text-white hover:bg-white/5 transition-all outline-none"
        data-testid="action-menu-button"
      >
        <MoreVertical className="w-5 h-5" />
      </button>

      <AnimatePresence>
        {isOpen && (
          <div 
            key="backdrop"
            className="fixed inset-0 z-[9998] cursor-default" 
            onClick={closeMenu}
          />
        )}
        {isOpen && (
          <motion.div
            key="menu"
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            className="absolute right-0 mt-2 w-48 bg-[#181818] border border-white/10 rounded-2xl p-2 shadow-2xl z-[9999] backdrop-blur-2xl pointer-events-auto"
            style={{ position: 'absolute', right: 0, top: '100%' }}
          >
            <button
              type="button"
              onClick={handleEdit}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-white/70 hover:text-white hover:bg-white/10 transition-all text-left"
              data-testid="action-edit-button"
            >
              <Edit2 className="w-4 h-4 text-violet-400" />
              Editar
            </button>
            <button
              type="button"
              onClick={handleDelete}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-red-400/70 hover:text-red-400 hover:bg-red-500/10 transition-all text-left"
              data-testid="action-delete-button"
            >
              <Trash2 className="w-4 h-4" />
              Excluir
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
