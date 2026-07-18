import React, { useState, useEffect } from "react";
import { collection, query, where, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "../lib/firebase";
import { Product, Order } from "../types";
import { ShoppingBag, Package, Truck, CheckCircle2, Clock } from "lucide-react";

interface UserOrdersListProps {
  currentUser: any;
  products: Product[];
}

export default function UserOrdersList({ currentUser, products }: UserOrdersListProps) {
  const [orders, setOrders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!currentUser) {
      setIsLoading(false);
      return;
    }

    if (db) {
      const q = query(
        collection(db, "orders"),
        where("userId", "==", currentUser.uid),
        orderBy("createdAt", "desc")
      );

      const unsubscribe = onSnapshot(q, (snap) => {
        const docs = snap.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setOrders(docs);
        setIsLoading(false);
      }, (err) => {
        console.error("User orders listener error:", err);
        setIsLoading(false);
      });

      return () => unsubscribe();
    } else {
      // Fetch from our local fullstack server
      const fetchUserOrders = async () => {
        try {
          const phone = currentUser.phone || currentUser.phoneNumber || "";
          const name = currentUser.displayName || "";
          const url = `/api/user-orders?phone=${encodeURIComponent(phone)}&name=${encodeURIComponent(name)}`;
          const res = await fetch(url);
          if (res.ok) {
            const data = await res.json();
            // Sort by created_at desc
            data.sort((a: any, b: any) => {
              const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
              const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
              return dateB - dateA;
            });
            // Adapt fields if needed: our server orders have item_title, and created_at
            const adapted = data.map((o: any) => ({
              ...o,
              item_name: o.item_title,
              createdAt: {
                toDate: () => new Date(o.created_at)
              }
            }));
            setOrders(adapted);
          }
        } catch (err) {
          console.error("Failed to fetch user orders:", err);
        } finally {
          setIsLoading(false);
        }
      };
      fetchUserOrders();
    }
  }, [currentUser]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <div className="w-10 h-10 border-4 border-[#ff9800] border-t-transparent rounded-full animate-spin" />
        <p className="text-xs text-[#787b86]">جاري جلب سجل طلباتك...</p>
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="text-center py-20 bg-[#1e222d] rounded-3xl border border-[#2a2e39] space-y-4 max-w-xl mx-auto p-6">
        <ShoppingBag className="w-12 h-12 text-[#787b86] mx-auto opacity-50" />
        <h4 className="text-lg font-bold text-white">لا يوجد سجل طلبات حتى الآن</h4>
        <p className="text-xs sm:text-sm text-[#787b86]">
          يبدو أنك لم تقم بإجراء أي طلبات بعد. ابدأ بالتسوق الآن واستمتع بمنتجاتنا المميزة!
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4">
      {orders.map((order) => {
        const statusConfig = {
          pending: { label: "قيد الانتظار", color: "text-amber-400", icon: Clock, bg: "bg-amber-400/10" },
          processing: { label: "جاري التحضير", color: "text-blue-400", icon: Package, bg: "bg-blue-400/10" },
          completed: { label: "تم قبول الطلب", color: "text-blue-400", icon: CheckCircle2, bg: "bg-blue-400/10" },
          shipped: { label: "تم الشحن", color: "text-indigo-400", icon: Truck, bg: "bg-indigo-400/10" },
          delivered: { label: "تم التوصيل", color: "text-emerald-400", icon: CheckCircle2, bg: "bg-emerald-400/10" },
          cancelled: { label: "ملغي", color: "text-rose-400", icon: CheckCircle2, bg: "bg-rose-400/10" },
          failed: { label: "فشل الإرسال", color: "text-rose-400", icon: CheckCircle2, bg: "bg-rose-400/10" }
        };

        const status = statusConfig[order.status as keyof typeof statusConfig] || statusConfig.pending;
        const StatusIcon = status.icon;

        return (
          <div 
            key={order.id}
            className="bg-[#1e222d] border border-[#2a2e39] rounded-2xl p-5 hover:border-[#ff9800]/30 transition-all group overflow-hidden relative"
          >
            <div className="flex flex-col sm:flex-row-reverse justify-between items-start sm:items-center gap-4">
              {/* Order Info */}
              <div className="text-right">
                <div className="flex items-center justify-end gap-2 mb-1">
                  <span className="text-[10px] text-[#787b86]">رقم الطلب: {order.id.slice(0, 8)}...</span>
                  <div className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${status.bg} ${status.color} flex items-center gap-1`}>
                    <StatusIcon className="w-3 h-3" />
                    <span>{status.label}</span>
                  </div>
                </div>
                <h3 className="text-sm font-bold text-white mb-0.5">
                  {order.item_name || "طلب من سوق السعادة"}
                </h3>
                <p className="text-[10px] text-[#787b86]">
                  {order.createdAt?.toDate ? order.createdAt.toDate().toLocaleDateString("ar-IQ") : "قيد المعالجة..."}
                </p>
              </div>

              {/* Price & Summary */}
              <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-start flex-row-reverse">
                <div className="text-right">
                  <span className="text-[10px] text-[#787b86] block">إجمالي المبلغ</span>
                  <span className="text-sm font-black text-[#ff9800]">
                    {(order.all_price || order.total_price || 0).toLocaleString("ar-IQ")} د.ع
                  </span>
                </div>
                <div className="h-8 w-px bg-[#2a2e39] hidden sm:block" />
                <div className="text-right">
                  <span className="text-[10px] text-[#787b86] block">العدد</span>
                  <span className="text-sm font-bold text-gray-300">{order.count || 1} قطع</span>
                </div>
              </div>
            </div>
            
            {/* Failure Reason */}
            {order.status === 'failed' && order.note && order.note.includes('[خطأ المورد:') && (
              <div className="mt-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl">
                <p className="text-xs text-rose-400 text-right">
                  <span className="font-bold">عذراً، تعذر معالجة الطلب:</span>{' '}
                  {order.note.split('[خطأ المورد:')[1].replace(']', '')}
                </p>
                <p className="text-[10px] text-rose-400/70 text-right mt-1">
                  يرجى التواصل مع الدعم الفني أو المحاولة مرة أخرى بتفاصيل مختلفة.
                </p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
