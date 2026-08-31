'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sparkles, Send, Loader2, Check, ChevronDown, ChevronUp, X, Cpu } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { LayoutData, ProjectConfig, AiAssistantResponse, AiAction } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useApp } from '@/lib/store';

interface Msg {
  role: 'user' | 'assistant';
  content: string;
  response?: AiAssistantResponse;
}

interface Props {
  layout: LayoutData;
  config: ProjectConfig;
  onApplyLayout: (l: LayoutData) => void;
}

const SUGGESTIONS = [
  'Make the kitchen larger.',
  'Move the master bedroom to the rear.',
  'Add a balcony.',
  'Give me more parking space.',
  'Make the living room more spacious.',
  'Create a more open layout.',
];

export function AiAssistant({ layout, config, onApplyLayout }: Props) {
  const [open, setOpen] = useState(true);
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: 'assistant',
      content: "Hi, I'm OpenBlueprint AI. Describe a change and I'll translate it into structured design actions. Try: \"make the kitchen larger\" or \"add a balcony\".",
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState<AiAssistantResponse | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const accentColor = useApp((s) => s.accentColor);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading, pending]);

  async function send(text?: string) {
    const message = (text || input).trim();
    if (!message || loading) return;
    setInput('');
    setMessages((m) => [...m, { role: 'user', content: message }]);
    setLoading(true);
    setPending(null);
    try {
      const res = await fetch('/api/ai/design-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, layout, config }),
      });
      const data = await res.json();
      const response = data.response as AiAssistantResponse;
      setMessages((m) => [...m, { role: 'assistant', content: response.explanation, response }]);
      // AUTO-APPLY: immediately apply the changes to the layout so the user sees the result.
      // Only apply if there are real actions (not just a note).
      const hasRealAction = response.actions.some((a) => a.type !== 'note');
      if (hasRealAction && response.appliedLayout) {
        // small delay so the message renders first
        setTimeout(() => {
          onApplyLayout(response.appliedLayout!);
        }, 300);
      } else {
        setPending(response);
      }
    } catch {
      setMessages((m) => [...m, { role: 'assistant', content: 'Sorry, I could not process that right now. Please try again.' }]);
    } finally {
      setLoading(false);
    }
  }

  function applyPending() {
    if (pending?.appliedLayout) {
      onApplyLayout(pending.appliedLayout);
      setPending(null);
    }
  }

  return (
    <div className="border-b border-border shrink-0">
      {/* Header */}
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-muted/40 transition-colors">
        <div className="flex items-center gap-2">
          <div className="size-7 rounded-md bg-gradient-to-br from-primary to-cyan flex items-center justify-center">
            <Sparkles className="size-3.5 text-white" />
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold">OpenBlueprint AI</p>
            <p className="text-[10px] text-muted-foreground">Your intelligent design assistant</p>
          </div>
        </div>
        {open ? <ChevronUp className="size-4 text-muted-foreground" /> : <ChevronDown className="size-4 text-muted-foreground" />}
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3">
              {/* Messages */}
              <div ref={scrollRef} className="h-48 overflow-y-auto scroll-thin space-y-2.5 mb-2 pr-1">
                {messages.map((m, i) => (
                  <div key={i} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
                    <div className={cn('max-w-[85%] rounded-lg px-2.5 py-1.5 text-xs', m.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted')}>
                      {m.role === 'assistant' && m.response && (
                        <div className="flex items-center gap-1 text-[10px] text-cyan font-medium mb-1">
                          <Cpu className="size-2.5" /> AI detected
                        </div>
                      )}
                      <p className="leading-relaxed">{m.content}</p>
                      {m.response?.actions && m.response.actions.length > 0 && m.response.actions[0].type !== 'note' && (
                        <div className="mt-2 pt-2 border-t border-border/40 space-y-1">
                          {m.response.actions.map((a, j) => (
                            <ActionChip key={j} action={a} />
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {loading && (
                  <div className="flex justify-start">
                    <div className="bg-muted rounded-lg px-2.5 py-1.5 text-xs flex items-center gap-1.5">
                      <span className="flex gap-0.5">
                        <span className="size-1.5 rounded-full bg-cyan bp-pulse" />
                        <span className="size-1.5 rounded-full bg-cyan bp-pulse" style={{ animationDelay: '0.2s' }} />
                        <span className="size-1.5 rounded-full bg-cyan bp-pulse" style={{ animationDelay: '0.4s' }} />
                      </span>
                      Interpreting request...
                    </div>
                  </div>
                )}
              </div>

              {/* Apply button */}
              {pending?.appliedLayout && (
                <Button size="sm" className="w-full gap-1.5 mb-2" style={{ background: accentColor }} onClick={applyPending}>
                  <Check className="size-3.5" /> Apply Changes
                </Button>
              )}

              {/* Suggestions */}
              {messages.length <= 1 && (
                <div className="flex flex-wrap gap-1 mb-2">
                  {SUGGESTIONS.map((s) => (
                    <button key={s} onClick={() => send(s)} className="text-[10px] px-2 py-1 rounded-full border border-border text-muted-foreground hover:border-cyan/40 hover:text-foreground">
                      {s}
                    </button>
                  ))}
                </div>
              )}

              {/* Input */}
              <div className="flex gap-1.5">
                <Textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                  placeholder="Describe a change..."
                  className="text-xs min-h-[36px] max-h-24 resize-none"
                  rows={1}
                />
                <Button size="icon" className="size-9 shrink-0" onClick={() => send()} disabled={loading || !input.trim()}>
                  <Send className="size-3.5" />
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ActionChip({ action }: { action: AiAction }) {
  const icons: Record<string, string> = {
    'resize-room': '⤢',
    'move-room': '✥',
    'add-room': '+',
    'remove-room': '−',
    'rename-room': 'A',
    'rearrange': '⟳',
    'note': 'ℹ',
  };
  return (
    <div className="flex items-center gap-1.5 text-[10px] text-foreground/80">
      <span className="size-4 rounded bg-foreground/10 flex items-center justify-center text-[9px] font-bold">{icons[action.type] || '•'}</span>
      <span>{action.description}</span>
    </div>
  );
}
