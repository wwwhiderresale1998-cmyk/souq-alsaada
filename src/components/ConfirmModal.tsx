import React from "react";
import { AlertTriangle } from "lucide-react";

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  confirmText = "موافق",
  cancelText = "إلغاء",
  onConfirm,
  onCancel
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[99999] flex items-center justify-center p-4">
      <div className="bg-[#1e222d] border border-[#2a2e39] rounded-2xl w-full max-w-sm overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.7)] text-white text-right">
        <div className="p-6">
          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-amber-500/15 border border-amber-500/30 mx-auto mb-4">
            <AlertTriangle className="w-6 h-6 text-amber-400" />
          </div>
          
          <h3 className="text-lg font-bold text-center text-white mb-2">{title}</h3>
          <p className="text-slate-400 text-center text-sm leading-relaxed mb-6">
            {message}
          </p>
          
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="flex-1 px-4 py-2.5 rounded-xl border border-[#2a2e39] text-slate-400 font-medium hover:bg-[#2a2e39] hover:text-white transition-colors"
            >
              {cancelText}
            </button>
            <button
              onClick={onConfirm}
              className="flex-1 px-4 py-2.5 rounded-xl bg-[#ff9800] hover:bg-[#ffa726] text-[#131722] font-bold transition-all shadow-[0_4px_15px_rgba(255,152,0,0.3)] hover:shadow-[0_4px_20px_rgba(255,152,0,0.45)]"
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
