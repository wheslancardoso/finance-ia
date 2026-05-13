"use client";

import React, { useState } from "react";
import { MoreVertical, Edit2, Trash2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { createPortal } from "react-dom";

interface ActionMenuProps {
  onEdit: () => void;
  onDelete: () => void;
  className?: string;
}

export function ActionMenu({ onEdit, onDelete, className }: ActionMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = React.useRef<HTMLButtonElement>(null);
  const [coords, setCoords] = useState({ top: 0, right: 0 });

  const toggleMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setCoords({
        top: rect.bottom + 8,
        right: window.innerWidth - rect.right
      });
    }
    
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
      <motion.button 
        ref={buttonRef}
        type="button"
        whileHover={{ scale: 1.05, backgroundColor: "rgba(255, 255, 255, 0.05)" }}
        whileTap={{ scale: 0.95 }}
        onClick={toggleMenu}
        className="w-8 h-8 md:w-10 md:h-10 rounded-xl text-white/30 hover:text-white transition-all outline-none flex items-center justify-center border border-transparent hover:border-white/10"
        data-testid="action-menu-button"
      >
        <MoreVertical className="w-5 h-5" />
      </motion.button>

      {isOpen && (
        <div 
          key="backdrop"
          className="fixed inset-0 z-[9998] cursor-default" 
          onClick={closeMenu}
        />
      )}
      {isOpen && typeof document !== "undefined" && createPortal(
        <div
          key="menu"
          className="fixed w-48 bg-[#181818] border border-white/10 rounded-2xl p-2 shadow-2xl z-[9999] backdrop-blur-2xl pointer-events-auto shadow-black/50"
          style={{ 
            top: `${coords.top}px`,
            right: `${coords.right}px`
          }}
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
        </div>,
        document.body
      )}
    </div>
  );
}
