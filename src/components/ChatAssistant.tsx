import React, { useState, useRef, useEffect } from "react";
import { MessageSquare, X, Send, Sparkles, AlertCircle, Bot, ZoomIn } from "lucide-react";
import { ChatMessage, Product } from "../types";

const PRESET_QUESTIONS = [
  "ما هي أجور التوصيل للمحافظات؟",
  "هل الشحن لبغداد يستغرق يوم كامل؟",
  "ما هي الساعة الذكية المتوفرة؟",
  "كيف أقدم طلب شراء في متجركم؟"
];

interface ChatAssistantProps {
  products?: Product[];
  onSelectProduct?: (product: Product) => void;
  onOrderProduct?: (product: Product) => void;
  onZoomImage?: (imageUrl: string) => void;
  currentUser?: any;
}

export default function ChatAssistant({ products = [], onSelectProduct, onOrderProduct, onZoomImage, currentUser }: ChatAssistantProps) {
  const [isOpen, setIsOpen] = useState(false);

  const getInitialMessages = (): ChatMessage[] => {
    const defaultMsg: ChatMessage = {
      id: "init",
      sender: "assistant",
      text: "يا هلا بك عيوني نورت سوق السعادة! 😍 أنا مساعدك الذكي المبرمج بالكامل لخدمتك وتوفير الوقت.\n\nبشنو كدر أساعدك اليوم؟ تكدر تسألني عن أي منتج أو أجور التوصيل لأي محافظة!",
      timestamp: new Date().toLocaleTimeString("ar-IQ", { hour: '2-digit', minute: '2-digit' })
    };
    
    try {
      const key = currentUser?.uid ? `souq_saada_chat_${currentUser.uid}` : 'souq_saada_chat_guest';
      const stored = localStorage.getItem(key);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error("Error loading chat history:", e);
    }
    return [defaultMsg];
  };

  const [messages, setMessages] = useState<ChatMessage[]>([]);

  // Load messages when currentUser changes
  useEffect(() => {
    setMessages(getInitialMessages());
  }, [currentUser?.uid]);

  // Save messages whenever they change
  useEffect(() => {
    if (messages.length > 0) {
      try {
        const key = currentUser?.uid ? `souq_saada_chat_${currentUser.uid}` : 'souq_saada_chat_guest';
        localStorage.setItem(key, JSON.stringify(messages));
      } catch (e) {
        console.error("Error saving chat history:", e);
      }
    }
  }, [messages, currentUser?.uid]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && chatEndRef.current) {
      // Small timeout to ensure DOM is fully rendered after opening
      setTimeout(() => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 50);
    }
  }, [messages, isLoading, isOpen]);

  const handleSendMessage = async (textToSend: string) => {
    if (!textToSend.trim() || isLoading) return;

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      sender: "user",
      text: textToSend,
      timestamp: new Date().toLocaleTimeString("ar-IQ", { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/gemini/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: messages.slice(-10), // send last 10 messages for context
          userMessage: textToSend
        })
      });

      const assistantMsgId = `msg-${Date.now() + 1}`;
      let assistantMsg: ChatMessage = {
        id: assistantMsgId,
        sender: "assistant",
        text: "",
        timestamp: new Date().toLocaleTimeString("ar-IQ", { hour: '2-digit', minute: '2-digit' })
      };

      setMessages((prev) => [...prev, assistantMsg]);

      if (!response.body) {
        throw new Error("No response body");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let done = false;

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (value) {
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n");
          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const dataStr = line.slice(6);
              if (dataStr === "[DONE]") {
                done = true;
                break;
              }
              try {
                const data = JSON.parse(dataStr);
                if (data.text) {
                  assistantMsg = { ...assistantMsg, text: assistantMsg.text + data.text };
                  setMessages((prev) => prev.map(m => m.id === assistantMsgId ? assistantMsg : m));
                }
              } catch (e) {
                console.error("Error parsing SSE JSON:", e);
              }
            }
          }
        }
      }
    } catch (err) {
      const errorMsg: ChatMessage = {
        id: `msg-${Date.now() + 1}`,
        sender: "assistant",
        text: "نعتذر منك عيوني، واجهت مشكلة صغيرة بالاتصال بالسيرفر. بس لا تشيل هم، التوصيل مالتنا مستمر خلال 24 ساعة لبغداد بـ 3 آلاف وباقي المحافظات بـ 5 آلاف دينار! تكدر تطلب أي منتج مباشرة بالضغط على 'اطلب الآن'.",
        timestamp: new Date().toLocaleTimeString("ar-IQ", { hour: '2-digit', minute: '2-digit' })
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
      {/* Floating Action Button */}
      {!isOpen && (
        <button
          id="chat-floating-btn"
          onClick={() => setIsOpen(true)}
          className="bg-[#ff9800] text-[#131722] hover:bg-[#ffa726] hover:scale-105 p-4 rounded-full shadow-[0_4px_25px_rgba(255,152,0,0.4)] transition-all duration-300 flex items-center gap-2 font-bold cursor-pointer group"
        >
          <Bot className="w-6 h-6 stroke-[2.5]" />
          <div className="absolute -top-1 -left-1 bg-cyan-400 w-3 h-3 rounded-full animate-ping" />
          <div className="absolute -top-1 -left-1 bg-cyan-400 w-3 h-3 rounded-full border border-[#131722]" />
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div className="bg-[#1e222d] border border-[#2a2e39] rounded-3xl w-[calc(100vw-3rem)] sm:w-[400px] h-[65vh] sm:h-[520px] max-h-[600px] flex flex-col shadow-[0_15px_40px_rgba(0,0,0,0.6)] overflow-hidden animate-in fade-in slide-in-from-bottom-5 duration-300">
          
          {/* Header */}
          <div className="bg-[#ff9800] p-4 flex items-center justify-between text-[#131722]">
            <button 
              id="close-chat-btn"
              onClick={() => setIsOpen(false)} 
              className="text-[#131722] hover:bg-[#131722]/10 p-1.5 rounded-lg transition-all"
            >
              <X className="w-5 h-5 stroke-[2.5]" />
            </button>
            <div className="flex items-center gap-2.5 flex-row-reverse">
              <div className="bg-[#131722] p-1.5 rounded-xl text-[#ff9800]">
                <Bot className="w-5 h-5" />
              </div>
              <div className="text-right">
                <h4 className="font-black text-sm text-[#131722] leading-none">مساعد السعادة الذكي</h4>
                <span className="text-[10px] text-[#131722]/80 font-bold">نشط ويصلك خلال 24 ساعة ⚡</span>
              </div>
            </div>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5 scrollbar-thin bg-[#131722]">
            {messages.map((msg) => {
              const parts = msg.text.split(/(\[PRODUCT:\d+\])/g);
              
              return (
              <div 
                key={msg.id} 
                className={`flex flex-col ${msg.sender === "user" ? "items-start" : "items-end"} text-right`}
              >
                <div 
                  className={`max-w-[85%] rounded-2xl p-3 text-xs sm:text-sm leading-relaxed ${
                    msg.sender === "user" 
                      ? "bg-[#ff9800] text-[#131722] rounded-tl-none font-black" 
                      : "bg-[#2a2e39] text-[#d1d4dc] rounded-tr-none border border-transparent"
                  }`}
                  style={{ whiteSpace: "pre-wrap" }}
                >
                  {parts.map((part, i) => {
                    const match = part.match(/\[PRODUCT:(\d+)\]/);
                    if (match) {
                      const productId = parseInt(match[1]);
                      const product = products.find(p => p.id === productId);
                      if (product) {
                        return (
                          <div key={i} className="mt-2 mb-2 p-2 bg-[#171b26] rounded-xl border border-[#3a3f50] flex items-center gap-3 text-right group">
                            <div className="relative">
                              <img src={product.image} alt={product.title} className="w-12 h-12 rounded-lg object-cover" />
                              {onZoomImage && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); onZoomImage(product.image); }}
                                  className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-lg cursor-pointer"
                                  title="تكبير الصورة"
                                >
                                  <ZoomIn className="w-4 h-4 text-white" />
                                </button>
                              )}
                            </div>
                            <div className="flex-1">
                              <h5 className="text-[10px] sm:text-xs font-bold text-white line-clamp-1">{product.title}</h5>
                              <p className="text-[10px] text-[#ff9800] font-black">{product.price.toLocaleString("ar-IQ")} دينار</p>
                              <div className="flex gap-1 mt-1">
                                {onSelectProduct && (
                                  <button onClick={() => onSelectProduct(product)} className="flex-1 py-1.5 bg-[#2a2e39] hover:bg-[#3a3f50] text-[10px] rounded text-white transition">التفاصيل</button>
                                )}
                                {onOrderProduct && (
                                  <button onClick={() => onOrderProduct(product)} className="flex-1 py-1.5 bg-[#ff9800] hover:bg-[#ffa726] text-[10px] text-[#131722] font-black rounded transition">اطلب الآن</button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      }
                      return null; // Don't render the raw tag if product not found
                    }
                    return <span key={i}>{part}</span>;
                  })}
                </div>
                <span className="text-[9px] text-[#787b86] mt-1 px-1">
                  {msg.timestamp}
                </span>
              </div>
            )})}

            {/* Loading Indicator */}
            {isLoading && (
              <div className="flex flex-col items-end">
                <div className="bg-[#2a2e39] border border-transparent rounded-2xl rounded-tr-none p-3.5 flex items-center space-x-1.5 space-x-reverse">
                  <div className="w-2 h-2 bg-[#ff9800] rounded-full animate-bounce [animation-delay:-0.3s]" />
                  <div className="w-2 h-2 bg-[#ff9800]/80 rounded-full animate-bounce [animation-delay:-0.15s]" />
                  <div className="w-2 h-2 bg-[#ff9800]/60 rounded-full animate-bounce" />
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Preset Questions Selector */}
          <div className="p-3 bg-[#171b26] border-t border-[#2a2e39]">
            <span className="block text-[10px] text-[#787b86] text-right mb-2 font-bold">أسئلة شائعة مجهزة لك:</span>
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none justify-start flex-row-reverse">
              {PRESET_QUESTIONS.map((q, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSendMessage(q)}
                  className="bg-[#2a2e39] hover:bg-[#ff9800]/15 hover:text-[#ff9800] border border-transparent text-[#d1d4dc] text-[10px] sm:text-xs px-3 py-1.5 rounded-lg whitespace-nowrap transition-all duration-200 cursor-pointer text-right shrink-0"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          {/* Input Box */}
          <form 
            onSubmit={(e) => { e.preventDefault(); handleSendMessage(inputText); }}
            className="p-3.5 border-t border-[#2a2e39] bg-[#1e222d] flex gap-2 items-center flex-row-reverse"
          >
            <input
              type="text"
              placeholder="اكتب استفسارك هنا عيوني..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              className="flex-1 bg-[#2a2e39] text-white border border-transparent focus:border-[#ff9800] focus:ring-1 focus:ring-[#ff9800] rounded-xl py-2 px-4 text-right text-xs sm:text-sm outline-none transition-all"
            />
            <button
              type="submit"
              disabled={!inputText.trim() || isLoading}
              className="bg-[#ff9800] hover:bg-[#ffa726] disabled:opacity-40 text-[#131722] p-2.5 rounded-xl transition-all duration-200 flex items-center justify-center cursor-pointer shrink-0"
            >
              <Send className="w-4 h-4 transform rotate-180" />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
