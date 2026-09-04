import { useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
import { toast } from "sonner";

import { Avatar } from "./Avatar";
import type { ChatMessage } from "@/lib/aviator/table";

export function ChatPanel({
  messages,
  userId,
  onSend,
  onlineCount,
}: {
  messages: ChatMessage[];
  userId: string | null;
  onSend: (message: string) => void;
  onlineCount: number;
}) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const node = listRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [messages.length]);

  const send = () => {
    const value = text.trim();
    if (!value) return;
    if (!userId) {
      toast.error("Log in to join the chat");
      return;
    }
    setSending(true);
    try {
      onSend(value);
      setText("");
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="panel-surface flex h-full min-h-0 flex-col">
      <header className="flex items-center justify-between border-b border-border px-3 py-2">
        <h2 className="font-display text-xs uppercase tracking-[0.2em] text-foreground">Chat</h2>
        <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-success" />
          {onlineCount} playing
        </span>
      </header>

      <div ref={listRef} className="min-h-0 flex-1 space-y-2 overflow-y-auto px-2.5 py-2 xb-slimscroll">
        {messages.length === 0 ? (
          <p className="py-6 text-center text-[11px] text-muted-foreground">
            Be the first to say something.
          </p>
        ) : (
          messages.map((item) => (
            <div key={item.id} className="flex gap-2">
              <Avatar username={item.name} seed={item.userId} size={22} />
              <div className="min-w-0">
                <span className="font-display text-[11px] text-primary">{item.name}</span>
                <p className="break-words text-xs leading-snug text-foreground/85">
                  {item.message}
                </p>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="flex items-center gap-1.5 border-t border-border p-2">
        <input
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") send();
          }}
          maxLength={240}
          placeholder="Reply"
          className="stepper-input text-xs"
        />
        <button
          type="button"
          disabled={sending}
          onClick={() => send()}
          aria-label="Send message"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform active:scale-95"
        >
          <Send className="h-3.5 w-3.5" />
        </button>
      </div>
    </section>
  );
}