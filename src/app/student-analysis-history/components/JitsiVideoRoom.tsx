'use client';
import React, { useState, useCallback } from 'react';
import { Video, Copy, Check, X, Users } from 'lucide-react';

interface JitsiVideoRoomProps {
  studentName: string;
}

function generateRoomId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 10; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export default function JitsiVideoRoom({ studentName }: JitsiVideoRoomProps) {
  const [isActive, setIsActive] = useState(false);
  const [roomUrl, setRoomUrl] = useState('');
  const [roomName, setRoomName] = useState('');
  const [copied, setCopied] = useState(false);

  const startSession = useCallback(() => {
    const id = generateRoomId();
    const room = `LuminarsGuide-${id}`;
    const url = `https://meet.jit.si/${room}`;
    setRoomName(room);
    setRoomUrl(url);
    setIsActive(true);
  }, []);

  const endSession = useCallback(() => {
    setIsActive(false);
    setRoomUrl('');
    setRoomName('');
    setCopied(false);
  }, []);

  const copyInviteLink = useCallback(async () => {
    if (!roomUrl) return;
    try {
      await navigator.clipboard.writeText(roomUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback for older browsers
      const el = document.createElement('textarea');
      el.value = roomUrl;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  }, [roomUrl]);

  if (!isActive) {
    return (
      <div
        className="rounded-2xl p-6"
        style={{ background: 'var(--card)', border: '1.5px solid var(--border)' }}
      >
        <div className="flex items-center gap-3 mb-4">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'var(--gradient-primary)' }}
          >
            <Video size={18} className="text-white" />
          </div>
          <div>
            <h3 className="text-base font-bold" style={{ color: 'var(--foreground)' }}>Live Video Session</h3>
            <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Start a free Jitsi Meet video call with {studentName}</p>
          </div>
        </div>

        <div
          className="flex items-start gap-2 px-3 py-2.5 rounded-xl mb-5 text-xs"
          style={{ background: 'var(--secondary)', border: '1px solid var(--border)' }}
        >
          <Users size={13} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--primary)' }} />
          <span style={{ color: 'var(--muted-foreground)' }}>
            For optimal performance on this free server, please limit sessions to a maximum of{' '}
            <span className="font-bold" style={{ color: 'var(--foreground)' }}>75 participants</span>.
          </span>
        </div>

        <button
          onClick={startSession}
          className="btn-primary w-full flex items-center justify-center gap-2"
        >
          <Video size={16} />
          Start Live Video Session
        </button>
      </div>
    );
  }

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ background: 'var(--card)', border: '1.5px solid var(--border)' }}
    >
      {/* Top bar */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ background: 'var(--secondary)', borderBottom: '1px solid var(--border)' }}
      >
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#4CAF50' }} />
          <span className="text-sm font-600" style={{ color: 'var(--foreground)', fontWeight: 600 }}>
            Live Session — {studentName}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* Copy invite link */}
          <button
            onClick={copyInviteLink}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-600 transition-all duration-150"
            style={{
              background: copied ? '#E8F5E9' : 'var(--primary)',
              color: copied ? '#2E7D32' : 'white',
              fontWeight: 600,
              border: 'none',
            }}
            title="Copy student invite link"
          >
            {copied ? <Check size={13} /> : <Copy size={13} />}
            {copied ? 'Copied!' : 'Copy Student Invite Link'}
          </button>
          {/* End session */}
          <button
            onClick={endSession}
            className="p-1.5 rounded-lg transition-colors hover:opacity-80"
            style={{ background: '#FDECEA', color: '#C62828' }}
            title="End session"
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {/* Participant note */}
      <div
        className="flex items-center gap-2 px-4 py-2 text-xs"
        style={{ background: '#FFF8E1', borderBottom: '1px solid #FFE082' }}
      >
        <Users size={12} style={{ color: '#F57F17', flexShrink: 0 }} />
        <span style={{ color: '#F57F17' }}>
          For optimal performance on this free server, please limit sessions to a maximum of{' '}
          <strong>75 participants</strong>.
        </span>
      </div>

      {/* Jitsi IFrame */}
      <div style={{ height: 520 }}>
        <iframe
          src={`https://meet.jit.si/${roomName}#config.startWithAudioMuted=false&config.startWithVideoMuted=false&config.toolbarButtons=["microphone","camera","desktop","fullscreen","hangup","chat","settings","participants-pane"]`}
          allow="camera; microphone; display-capture; autoplay; clipboard-write"
          style={{ width: '100%', height: '100%', border: 'none' }}
          title={`Jitsi Meet — ${roomName}`}
        />
      </div>

      {/* Room URL display */}
      <div
        className="px-4 py-3 flex items-center gap-2"
        style={{ borderTop: '1px solid var(--border)', background: 'var(--secondary)' }}
      >
        <span className="text-xs flex-shrink-0" style={{ color: 'var(--muted-foreground)' }}>Room:</span>
        <span
          className="text-xs font-mono flex-1 truncate"
          style={{ color: 'var(--primary-dark)' }}
        >
          {roomUrl}
        </span>
        <button
          onClick={copyInviteLink}
          className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg transition-colors"
          style={{
            background: copied ? '#E8F5E9' : 'var(--muted)',
            color: copied ? '#2E7D32' : 'var(--muted-foreground)',
          }}
        >
          {copied ? <Check size={11} /> : <Copy size={11} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
    </div>
  );
}
