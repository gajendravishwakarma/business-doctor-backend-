import React, { useState } from 'react';
import { useBusinessStore } from '../../lib/store';
import { Bot, Send, Sparkles, X, Loader2, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface AskDoctorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AskDoctorModal: React.FC<AskDoctorModalProps> = ({ isOpen, onClose }) => {
  const { business, metrics, user } = useBusinessStore();
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([
    {
      role: 'assistant',
      content: `Namaste! I am your AI Business Doctor for **${business.name}**.\n\nI have live visibility into your **${metrics.totalOrders} recorded orders**, **${metrics.repeatCustomerRate}% repeat retention rate**, and **${business.currency_symbol}${metrics.netProfit.toLocaleString('en-IN')} net profit**.\n\nWhat challenge would you like to solve today? (e.g. "How do I fill empty therapy slots on weekdays?" or "Should I raise prices on Kumkumadi Oil?")`,
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);

  const quickPrompts = [
    'How do I double my repeat customer retention?',
    'What is my single biggest revenue bottleneck right now?',
    'Give me a 3-step WhatsApp campaign to reactivate dormant buyers',
    'How do I improve my product profit margins?',
  ];

  const handleSend = async (textToSend?: string) => {
    const query = textToSend || question;
    if (!query.trim() || isLoading) return;

    const userMsg = { role: 'user' as const, content: query.trim() };
    const newHistory = [...messages, userMsg];
    setMessages(newHistory);
    setQuestion('');
    setIsLoading(true);

    try {
      const authHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (user?.access_token) {
        authHeaders['Authorization'] = `Bearer ${user.access_token}`;
      }
      if (business?.id) {
        authHeaders['x-business-id'] = business.id;
      }

      const response = await fetch('/api/ai/ask-doctor', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          question: query.trim(),
          business,
          metrics,
          conversationHistory: newHistory.slice(-4),
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setMessages((prev) => [...prev, { role: 'assistant', content: data.answer || 'Analysis complete.' }]);
      } else {
        throw new Error('Doctor offline');
      }
    } catch {
      // Deterministic fallback response
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `**Prescription for ${business.name}:**\n1. **Focus on Direct WhatsApp Engagement**: For Indian SMBs, phone-based WhatsApp conversions yield 4x higher closing rate than email.\n2. **Protect Margin Buffers**: Ensure your top-selling products maintain at least 45% gross margin after logistics and packaging.\n3. **Tighten Speed-to-Lead**: Reach out to new leads within 15 minutes of inquiry to prevent buyer drop-off.`,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="bg-slate-900 border border-slate-700/80 w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden text-slate-100"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/60">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-emerald-500 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <div className="font-bold text-base flex items-center gap-2">
                  Business Doctor AI Consult
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-900/60 text-emerald-300 font-semibold border border-emerald-700/40">
                    Live Diagnostics
                  </span>
                </div>
                <div className="text-xs text-slate-400">
                  Grounded in real metrics for {business.name}
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Quick suggestions */}
          <div className="px-5 py-2.5 bg-slate-950/40 border-b border-slate-800/80 flex items-center gap-2 overflow-x-auto text-xs scrollbar-none">
            <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="text-slate-400 shrink-0 font-medium">Quick Prompts:</span>
            {quickPrompts.map((prompt, i) => (
              <button
                key={i}
                onClick={() => handleSend(prompt)}
                className="shrink-0 bg-slate-800/80 hover:bg-slate-700 text-slate-300 px-2.5 py-1 rounded-md border border-slate-700/50 hover:border-slate-600 transition-colors flex items-center gap-1.5"
              >
                <span>{prompt}</span>
                <ArrowRight className="w-2.5 h-2.5 opacity-60" />
              </button>
            ))}
          </div>

          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {messages.map((m, idx) => (
              <div
                key={idx}
                className={`flex gap-3 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {m.role === 'assistant' && (
                  <div className="w-8 h-8 rounded-lg bg-indigo-600/30 border border-indigo-500/30 flex items-center justify-center shrink-0 text-indigo-300 mt-1">
                    <Bot className="w-4 h-4" />
                  </div>
                )}
                <div
                  className={`max-w-[85%] rounded-xl p-3.5 text-sm leading-relaxed ${
                    m.role === 'user'
                      ? 'bg-indigo-600 text-white rounded-br-none shadow-md shadow-indigo-600/20'
                      : 'bg-slate-800/90 text-slate-200 border border-slate-700/60 rounded-bl-none'
                  }`}
                >
                  <div className="whitespace-pre-wrap">{m.content}</div>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex gap-3 justify-start">
                <div className="w-8 h-8 rounded-lg bg-indigo-600/30 border border-indigo-500/30 flex items-center justify-center shrink-0 text-indigo-300">
                  <Loader2 className="w-4 h-4 animate-spin" />
                </div>
                <div className="bg-slate-800/80 text-slate-400 border border-slate-700/60 rounded-xl p-3 text-xs flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
                  Analyzing operational evidence and formulating prescription...
                </div>
              </div>
            )}
          </div>

          {/* Input Area */}
          <div className="p-4 border-t border-slate-800 bg-slate-950/60 flex items-center gap-2">
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder={`Ask anything about ${business.name}'s revenue, marketing, or operations...`}
              className="flex-1 bg-slate-800/90 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-400 focus:outline-none focus:border-indigo-500 transition-colors"
            />
            <button
              onClick={() => handleSend()}
              disabled={isLoading || !question.trim()}
              className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2.5 rounded-xl font-medium text-sm flex items-center gap-2 shadow-md shadow-indigo-600/20 transition-colors shrink-0"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              <span>Ask</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
