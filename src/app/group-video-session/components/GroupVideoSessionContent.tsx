'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { Copy, Check, Video, Users } from 'lucide-react';

function generateRoomName(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 10; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `LuminarsGuide-Group-${result}`;
}

export default function GroupVideoSessionContent() {
  const [roomName, setRoomName] = useState<string>('');
  const [jitsiUrl, setJitsiUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const name = generateRoomName();
    setRoomName(name);
    setJitsiUrl(`https://meet.jit.si/${name}`);
  }, []);

  const handleCopyLink = useCallback(async () => {
    if (!jitsiUrl) return;
    try {
      await navigator.clipboard.writeText(jitsiUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // fallback
      const el = document.createElement('textarea');
      el.value = jitsiUrl;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  }, [jitsiUrl]);

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'var(--gradient-primary)' }}
          >
            <Video size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>
              Group Video Session
            </h1>
            <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
              Host a live group session with your students via Jitsi Meet
            </p>
          </div>
        </div>
      </div>

      {/* Capacity warning */}
      <div
        className="flex items-start gap-3 px-4 py-3 rounded-xl border"
        style={{
          background: 'var(--secondary)',
          borderColor: 'var(--border)',
        }}
      >
        <Users size={18} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--accent)' }} />
        <p className="text-sm" style={{ color: 'var(--foreground)' }}>
          <span className="font-semibold">Capacity Notice:</span> For optimal performance on this
          free server, please limit sessions to a maximum of{' '}
          <span className="font-semibold">75 participants</span>.
        </p>
      </div>

      {/* Room info + copy button */}
      <div
        className="flex flex-col sm:flex-row items-start sm:items-center gap-3 px-4 py-3 rounded-xl border"
        style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
      >
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide mb-0.5" style={{ color: 'var(--muted-foreground)' }}>
            Group Room URL
          </p>
          <p
            className="text-sm font-mono truncate"
            style={{ color: 'var(--foreground)' }}
            title={jitsiUrl}
          >
            {jitsiUrl || 'Generating…'}
          </p>
        </div>
        <button
          onClick={handleCopyLink}
          disabled={!jitsiUrl}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 flex-shrink-0"
          style={{
            background: copied ? 'var(--success, #22c55e)' : 'var(--gradient-primary)',
            color: 'white',
            opacity: jitsiUrl ? 1 : 0.5,
            cursor: jitsiUrl ? 'pointer' : 'not-allowed',
          }}
        >
          {copied ? (
            <>
              <Check size={16} />
              Copied!
            </>
          ) : (
            <>
              <Copy size={16} />
              Copy Group Invite Link
            </>
          )}
        </button>
      </div>

      {/* Jitsi IFrame */}
      <div
        className="rounded-2xl overflow-hidden border"
        style={{
          borderColor: 'var(--border)',
          background: 'var(--card)',
          minHeight: '560px',
        }}
      >
        {jitsiUrl ? (
          <iframe
            src={jitsiUrl}
            allow="camera; microphone; fullscreen; display-capture; autoplay"
            style={{
              width: '100%',
              height: '600px',
              border: 'none',
              display: 'block',
            }}
            title="Group Video Session – Jitsi Meet"
          />
        ) : (
          <div
            className="flex items-center justify-center h-full"
            style={{ minHeight: '560px', color: 'var(--muted-foreground)' }}
          >
            <p className="text-sm">Loading video room…</p>
          </div>
        )}
      </div>
    </div>
  );
}
