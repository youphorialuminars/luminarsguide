'use client';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MessageSquare, Send, X, Circle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface ChatMessage {
  id: string;
  sender_id: string;
  recipient_id: string;
  message: string;
  is_read: boolean;
  created_at: string;
  sender_name?: string;
}

interface MentorStudentChatProps {
  /** The other party's user_profiles.id */
  recipientId: string;
  /** Display name of the other party */
  recipientName: string;
  /** Optional: student record id for context */
  studentId?: string;
}

export default function MentorStudentChat({ recipientId, recipientName, studentId }: MentorStudentChatProps) {
  const { user } = useAuth();
  const supabase = createClient();

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<any>(null);

  const loadMessages = useCallback(async () => {
    if (!user || !recipientId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('id, sender_id, recipient_id, message, is_read, created_at')
        .or(
          `and(sender_id.eq.${user.id},recipient_id.eq.${recipientId}),and(sender_id.eq.${recipientId},recipient_id.eq.${user.id})`
        )
        .order('created_at', { ascending: true })
        .limit(100);

      if (error) throw error;
      setMessages(data || []);

      // Count unread messages sent to me
      const unread = (data || []).filter((m) => m.recipient_id === user.id && !m.is_read).length;
      setUnreadCount(unread);
    } catch (err: any) {
      console.error('Chat load error:', err);
    } finally {
      setLoading(false);
    }
  }, [user, recipientId]);

  const markAsRead = useCallback(async () => {
    if (!user || !recipientId) return;
    await supabase
      .from('chat_messages')
      .update({ is_read: true })
      .eq('recipient_id', user.id)
      .eq('sender_id', recipientId)
      .eq('is_read', false);
    setUnreadCount(0);
  }, [user, recipientId]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  // Real-time subscription
  useEffect(() => {
    if (!user || !recipientId) return;

    const channel = supabase
      .channel(`chat-${user.id}-${recipientId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
        },
        (payload) => {
          const msg = payload.new as ChatMessage;
          const isRelevant =
            (msg.sender_id === user.id && msg.recipient_id === recipientId) ||
            (msg.sender_id === recipientId && msg.recipient_id === user.id);
          if (isRelevant) {
            setMessages((prev) => {
              if (prev.find((m) => m.id === msg.id)) return prev;
              return [...prev, msg];
            });
            if (msg.recipient_id === user.id) {
              if (open) {
                markAsRead();
              } else {
                setUnreadCount((c) => c + 1);
              }
            }
          }
        }
      )
      .subscribe();

    channelRef.current = channel;
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, recipientId, open, markAsRead]);

  // Scroll to bottom when messages change or chat opens
  useEffect(() => {
    if (open) {
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
      markAsRead();
    }
  }, [open, messages.length, markAsRead]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || !user || !recipientId) return;
    setSending(true);
    try {
      const { error } = await supabase.from('chat_messages').insert({
        sender_id: user.id,
        recipient_id: recipientId,
        student_id: studentId || null,
        message: text,
      });
      if (error) throw error;
      setInput('');
    } catch (err: any) {
      toast.error('Failed to send: ' + err.message);
    } finally {
      setSending(false);
    }
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === today.toDateString()) return 'Today';
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  };

  // Group messages by date
  const grouped: { date: string; msgs: ChatMessage[] }[] = [];
  messages.forEach((msg) => {
    const dateLabel = formatDate(msg.created_at);
    const last = grouped[grouped.length - 1];
    if (last && last.date === dateLabel) {
      last.msgs.push(msg);
    } else {
      grouped.push({ date: dateLabel, msgs: [msg] });
    }
  });

  return (
    <div className="relative">
      {/* Trigger Button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative flex items-center gap-1.5 px-3 py-2 rounded-xl transition-all duration-200 hover:opacity-90"
        style={{
          background: 'linear-gradient(135deg, #1565C0 0%, #1976D2 100%)',
          color: 'white',
          fontSize: '12px',
          fontWeight: 700,
          boxShadow: '0 2px 8px rgba(21,101,192,0.35)',
        }}
        aria-label="Open Chat"
        title={`Chat with ${recipientName}`}
      >
        <MessageSquare size={14} />
        <span className="hidden sm:inline">Chat</span>
        {unreadCount > 0 && (
          <span
            className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full flex items-center justify-center text-white"
            style={{ background: '#C62828', fontSize: '9px', fontWeight: 700 }}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Chat Window */}
      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className="absolute right-0 top-full mt-2 z-50 rounded-2xl flex flex-col"
            style={{
              width: '340px',
              height: '460px',
              background: 'var(--card)',
              border: '1.5px solid var(--border)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
            }}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-4 py-3 rounded-t-2xl flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #1565C0, #1976D2)', color: 'white' }}
            >
              <div className="flex items-center gap-2">
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs"
                  style={{ background: 'rgba(255,255,255,0.25)' }}
                >
                  {recipientName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-bold leading-tight">{recipientName}</p>
                  <div className="flex items-center gap-1">
                    <Circle size={6} fill="#4CAF50" color="#4CAF50" />
                    <span style={{ fontSize: '10px', opacity: 0.85 }}>Online</span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="p-1 rounded-lg hover:bg-white/20 transition-colors"
                aria-label="Close chat"
              >
                <X size={14} />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-1" style={{ minHeight: 0 }}>
              {loading ? (
                <div className="flex items-center justify-center h-full">
                  <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" style={{ color: 'var(--primary)' }} />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" style={{ color: 'var(--primary)' }} />
                  </svg>
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-2">
                  <MessageSquare size={28} style={{ color: 'var(--muted-foreground)' }} />
                  <p className="text-xs text-center" style={{ color: 'var(--muted-foreground)' }}>
                    No messages yet. Say hello! 👋
                  </p>
                </div>
              ) : (
                grouped.map((group) => (
                  <div key={group.date}>
                    {/* Date separator */}
                    <div className="flex items-center gap-2 my-2">
                      <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
                      <span className="text-xs px-2" style={{ color: 'var(--muted-foreground)' }}>
                        {group.date}
                      </span>
                      <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
                    </div>
                    {group.msgs.map((msg) => {
                      const isMine = msg.sender_id === user?.id;
                      return (
                        <div
                          key={msg.id}
                          className={`flex mb-1.5 ${isMine ? 'justify-end' : 'justify-start'}`}
                        >
                          <div
                            className="max-w-[75%] px-3 py-2 rounded-2xl text-xs leading-relaxed"
                            style={{
                              background: isMine
                                ? 'linear-gradient(135deg, #1565C0, #1976D2)'
                                : 'var(--secondary)',
                              color: isMine ? 'white' : 'var(--foreground)',
                              borderBottomRightRadius: isMine ? '4px' : '16px',
                              borderBottomLeftRadius: isMine ? '16px' : '4px',
                              border: isMine ? 'none' : '1px solid var(--border)',
                            }}
                          >
                            <p style={{ wordBreak: 'break-word' }}>{msg.message}</p>
                            <p
                              className="mt-0.5 text-right"
                              style={{
                                fontSize: '9px',
                                opacity: 0.7,
                                color: isMine ? 'rgba(255,255,255,0.8)' : 'var(--muted-foreground)',
                              }}
                            >
                              {formatTime(msg.created_at)}
                              {isMine && (
                                <span className="ml-1">{msg.is_read ? '✓✓' : '✓'}</span>
                              )}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))
              )}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div
              className="flex items-center gap-2 px-3 py-3 rounded-b-2xl flex-shrink-0"
              style={{ borderTop: '1px solid var(--border)' }}
            >
              <input
                type="text"
                className="input-mystic flex-1 text-xs"
                placeholder="Type a message..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                style={{ height: '36px', padding: '0 12px' }}
              />
              <button
                onClick={handleSend}
                disabled={sending || !input.trim()}
                className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-all hover:opacity-90 disabled:opacity-40"
                style={{ background: 'linear-gradient(135deg, #1565C0, #1976D2)' }}
                aria-label="Send message"
              >
                {sending ? (
                  <svg className="animate-spin w-3.5 h-3.5 text-white" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                ) : (
                  <Send size={14} className="text-white" />
                )}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
