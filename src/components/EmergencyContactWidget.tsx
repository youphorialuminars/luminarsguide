'use client';
import React, { useState } from 'react';
import { Phone, Mail, Clock, X, AlertTriangle, ChevronDown } from 'lucide-react';
import { EMERGENCY_CONFIG } from '@/lib/emergencyConfig';

export default function EmergencyContactWidget() {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      {/* Trigger button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 px-3 py-2 rounded-xl transition-all duration-200 hover:opacity-90"
        style={{
          background: 'linear-gradient(135deg, #C62828 0%, #E53935 100%)',
          color: 'white',
          fontSize: '12px',
          fontWeight: 700,
          boxShadow: '0 2px 8px rgba(198,40,40,0.35)',
        }}
        aria-label="Open Support & Emergency Contact"
        title="Support & Emergency Contact"
      >
        <AlertTriangle size={14} />
        <span className="hidden sm:inline">Emergency</span>
        <ChevronDown size={12} style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />
      </button>
      {/* Dropdown card */}
      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
          <div
            className="absolute right-0 top-full mt-2 z-50 rounded-2xl p-5 w-80 shadow-2xl"
            style={{
              background: 'var(--card)',
              border: '1.5px solid var(--border)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg, #C62828, #E53935)' }}
                >
                  <AlertTriangle size={15} className="text-white" />
                </div>
                <div>
                  <p className="text-sm font-bold" style={{ color: 'var(--foreground)', fontWeight: 700 }}>
                    Support &amp; Emergency
                  </p>
                  <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                    Quick-access contact channels
                  </p>
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="p-1 rounded-lg hover:bg-muted transition-colors"
                aria-label="Close"
              >
                <X size={14} style={{ color: 'var(--muted-foreground)' }} />
              </button>
            </div>

            {/* Emergency Call */}
            <a
              href={`tel:${EMERGENCY_CONFIG?.phoneNumber}`}
              className="flex items-center gap-3 p-3 rounded-xl mb-3 transition-all hover:opacity-90"
              style={{
                background: 'linear-gradient(135deg, #FFEBEE, #FFCDD2)',
                border: '1.5px solid #FFCDD2',
                textDecoration: 'none',
              }}
            >
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: '#C62828' }}
              >
                <Phone size={16} className="text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold" style={{ color: '#B71C1C', fontWeight: 700 }}>
                  Emergency Call Line
                </p>
                <p className="text-sm font-bold font-mono" style={{ color: '#C62828', fontWeight: 700 }}>
                  {EMERGENCY_CONFIG?.phoneDisplay}
                </p>
                <p className="text-xs" style={{ color: '#C62828', opacity: 0.8 }}>
                  Tap to dial instantly
                </p>
              </div>
            </a>

            {/* Support Email */}
            <a
              href={`mailto:${EMERGENCY_CONFIG?.supportEmail}?subject=Urgent Support Request — Luminar's Guide`}
              className="flex items-center gap-3 p-3 rounded-xl mb-3 transition-all hover:opacity-90"
              style={{
                background: 'var(--secondary)',
                border: '1.5px solid var(--border)',
                textDecoration: 'none',
              }}
            >
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'var(--primary)' }}
              >
                <Mail size={16} className="text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold" style={{ color: 'var(--foreground)', fontWeight: 700 }}>
                  Support Email
                </p>
                <p className="text-sm font-bold" style={{ color: 'var(--primary-dark)', fontWeight: 700 }}>
                  {EMERGENCY_CONFIG?.supportEmail}
                </p>
                <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                  Tap to send an alert
                </p>
              </div>
            </a>

            {/* Office Hours */}
            <div
              className="flex items-start gap-3 p-3 rounded-xl"
              style={{ background: 'var(--muted)', border: '1px solid var(--border)' }}
            >
              <Clock size={15} style={{ color: 'var(--primary)', flexShrink: 0, marginTop: '2px' }} />
              <div>
                <p className="text-xs font-bold mb-0.5" style={{ color: 'var(--foreground)', fontWeight: 700 }}>
                  Office Hours &amp; Protocol
                </p>
                <p className="text-xs mb-1" style={{ color: 'var(--muted-foreground)' }}>
                  {EMERGENCY_CONFIG?.officeHours}
                </p>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>
                  {EMERGENCY_CONFIG?.emergencyProtocol}
                </p>
                <p className="text-xs mt-1" style={{ color: 'var(--muted-foreground)', opacity: 0.8 }}>
                  {EMERGENCY_CONFIG?.responseTime}
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
