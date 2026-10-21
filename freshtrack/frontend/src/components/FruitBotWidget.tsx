import React, { useState, useRef, useEffect } from 'react';
import {
  MessageSquare,
  X,
  Send,
  Sparkles,
  Bot,
  User,
  ChevronDown,
  RotateCcw,
  Boxes,
  HelpCircle
} from 'lucide-react';
import api from '../api/client';

interface Message {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  time: string;
  suggestions?: string[];
  relatedBatches?: any[];
}

export const FruitBotWidget: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      sender: 'bot',
      text: "👋 Hi! I am **FruitBot**, your Produce & Inventory AI Assistant.\n\nAsk me anything about your active batches, shelf-life deadlines, urgent stock, or spoilage records!",
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      suggestions: [
        "What batches need urgent attention?",
        "What should I sell or dispatch first?",
        "Show batches expiring soon",
        "How much fruit has spoiled?"
      ]
    }
  ]);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  const handleSend = async (textToSend?: string) => {
    const query = (textToSend || input).trim();
    if (!query || loading) return;

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: query,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await api.post('/chatbot/query', { message: query });
      const botMsg: Message = {
        id: `bot-${Date.now()}`,
        sender: 'bot',
        text: res.data.reply,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        suggestions: res.data.actionSuggestions,
        relatedBatches: res.data.relatedBatches
      };
      setMessages((prev) => [...prev, botMsg]);
    } catch (err: any) {
      const botMsg: Message = {
        id: `bot-err-${Date.now()}`,
        sender: 'bot',
        text: "⚠️ Sorry, I encountered an issue retrieving inventory records. Please ensure the backend is connected.",
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages((prev) => [...prev, botMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSend();
    }
  };

  const resetChat = () => {
    setMessages([
      {
        id: 'welcome',
        sender: 'bot',
        text: "👋 Hi! I am **FruitBot**, your Produce & Inventory AI Assistant.\n\nAsk me anything about your active batches, shelf-life deadlines, urgent stock, or spoilage records!",
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        suggestions: [
          "What batches need urgent attention?",
          "What should I sell or dispatch first?",
          "Show batches expiring soon",
          "How much fruit has spoiled?"
        ]
      }
    ]);
  };

  // Helper to format basic bold and bullet markdown in chat bubble
  const renderFormattedText = (txt: string) => {
    return txt.split('\n').map((line, idx) => {
      // Bold formatting
      const parts = line.split(/(\*\*.*?\*\*)/g).map((part, pIdx) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={pIdx} className="font-bold text-slate-900">{part.slice(2, -2)}</strong>;
        }
        if (part.startsWith('*') && part.endsWith('*')) {
          return <em key={pIdx} className="italic text-slate-600">{part.slice(1, -1)}</em>;
        }
        return part;
      });

      return (
        <span key={idx} className="block leading-relaxed">
          {parts}
        </span>
      );
    });
  };

  return (
    <div className="fixed bottom-6 right-6 z-40">
      {/* Floating Toggle Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="group relative flex items-center gap-2.5 px-4 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-xs rounded-full shadow-xl shadow-emerald-950/20 transition-all hover:scale-105 active:scale-95"
          title="Open FruitBot AI Assistant"
        >
          <div className="relative">
            <Bot className="w-5 h-5" />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-300 ring-2 ring-emerald-600 animate-ping"></span>
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-300 ring-2 ring-emerald-600"></span>
          </div>
          <span className="tracking-wide">FruitBot AI</span>
          <span className="px-1.5 py-0.5 rounded bg-white/20 text-[10px] font-mono">Live RAG</span>
        </button>
      )}

      {/* Chat Drawer Window */}
      {isOpen && (
        <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-[380px] sm:w-[420px] h-[560px] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          {/* Header */}
          <div className="p-3.5 px-5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-white shadow-md shadow-emerald-900/40">
                <Bot className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-sm tracking-tight">FruitBot</span>
                  <span className="px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-semibold border border-emerald-500/30">
                    Online
                  </span>
                </div>
                <p className="text-[10px] text-slate-400">Natural Language Produce Intelligence</p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={resetChat}
                className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition-colors"
                title="Restart conversation"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition-colors"
                title="Minimize FruitBot"
              >
                <ChevronDown className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Messages Body */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-slate-50/60 text-xs">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex flex-col ${m.sender === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[85%] p-3.5 rounded-2xl text-xs space-y-1.5 shadow-xs ${
                    m.sender === 'user'
                      ? 'bg-emerald-600 text-white rounded-br-none'
                      : 'bg-white text-slate-700 border border-slate-200/80 rounded-bl-none'
                  }`}
                >
                  <div className="space-y-1">
                    {renderFormattedText(m.text)}
                  </div>
                  <div
                    className={`text-[9px] text-right ${
                      m.sender === 'user' ? 'text-emerald-200' : 'text-slate-400'
                    }`}
                  >
                    {m.time}
                  </div>
                </div>

                {/* Related Batch Cards */}
                {m.relatedBatches && m.relatedBatches.length > 0 && (
                  <div className="mt-2 space-y-1 w-[85%]">
                    {m.relatedBatches.map((b) => (
                      <div
                        key={b._id}
                        className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between text-[11px] hover:border-emerald-500 transition-all cursor-pointer"
                        onClick={() => window.location.href = '/inventory'}
                      >
                        <div className="flex items-center gap-2">
                          <Boxes className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="font-mono font-bold text-slate-800">{b.batch_code}</span>
                          <span className="text-slate-500 capitalize">{b.fruit_type}</span>
                        </div>
                        <span className="text-emerald-700 font-semibold">
                          ~{b.remaining_shelf_life_days ?? 0}d left
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Quick Action Suggestion Chips */}
                {m.suggestions && m.suggestions.length > 0 && (
                  <div className="mt-2.5 flex flex-wrap gap-1.5 max-w-[90%]">
                    {m.suggestions.map((s, sIdx) => (
                      <button
                        key={sIdx}
                        onClick={() => handleSend(s)}
                        className="px-2.5 py-1 bg-white hover:bg-emerald-50 text-slate-600 hover:text-emerald-700 font-semibold rounded-full border border-slate-200 text-[11px] transition-all active:scale-95 text-left shadow-2xs"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="flex items-center gap-2 text-slate-400 text-xs p-2">
                <Sparkles className="w-4 h-4 animate-spin text-emerald-600" />
                <span>FruitBot is querying inventory & reasoning…</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Footer */}
          <div className="p-3 bg-white border-t border-slate-200 flex items-center gap-2">
            <input
              type="text"
              placeholder="Ask about batches, shelf life, or stock actions…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1 px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-slate-800"
            />
            <button
              onClick={() => handleSend()}
              disabled={!input.trim() || loading}
              className="p-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl transition-all shadow-sm active:scale-95"
              title="Send message"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
