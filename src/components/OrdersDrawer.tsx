import React from "react";
import { X, Clock } from "lucide-react";
import UserOrdersList from "./UserOrdersList";
import { Product } from "../types";

interface OrdersDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: any;
  products: Product[];
}

export default function OrdersDrawer({
  isOpen,
  onClose,
  currentUser,
  products
}: OrdersDrawerProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden font-sans [direction:rtl]">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/70 backdrop-blur-sm transition-opacity duration-300" 
        onClick={onClose}
      />

      {/* Panel Wrapper */}
      <div className="absolute inset-y-0 right-0 max-w-full flex">
        {/* Sliding Panel */}
        <div className="w-screen max-w-lg bg-[#1e222d] border-l border-[#2a2e39] text-white flex flex-col shadow-[-25px_0_60px_rgba(0,0,0,0.5)] animate-in slide-in-from-right duration-300">
          
          {/* Header */}
          <div className="p-6 border-b border-[#2a2e39] flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[#ff9800]/10 border border-[#ff9800]/20 rounded-xl flex items-center justify-center text-[#ff9800]">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-black text-base text-white">سجل الطلبات</h3>
                <p className="text-[10px] text-[#787b86] font-bold">تابع حالة طلباتك السابقة</p>
              </div>
            </div>
            
            <button 
              onClick={onClose}
              className="text-gray-400 hover:text-white bg-[#131722]/50 hover:bg-[#2a2e39] p-2.5 rounded-xl transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6">
            <UserOrdersList currentUser={currentUser} products={products} />
          </div>
        </div>
      </div>
    </div>
  );
}
