'use client';
import React, { useState, useEffect } from 'react';

type FontSize = 'small' | 'medium' | 'large';

const SIZE_MAP: Record<FontSize, string> = {
  small: '13px',
  medium: '14px',
  large: '16px',
};

const SIZES: { key: FontSize; label: string }[] = [
  { key: 'small', label: 'S' },
  { key: 'medium', label: 'M' },
  { key: 'large', label: 'L' },
];

export default function FontSizeAdjuster() {
  const [activeSize, setActiveSize] = useState<FontSize>('medium');

  useEffect(() => {
    try {
      const saved = localStorage.getItem('luminar_font_size') as FontSize | null;
      if (saved && SIZE_MAP[saved]) {
        setActiveSize(saved);
      }
    } catch {
      // ignore
    }
  }, []);

  const handleChange = (size: FontSize) => {
    setActiveSize(size);
    try {
      localStorage.setItem('luminar_font_size', size);
      document.documentElement.style.fontSize = SIZE_MAP[size];
    } catch {
      // ignore
    }
  };

  return (
    <div
      className="rounded-xl p-2.5"
      style={{ background: 'var(--secondary)', border: '1px solid var(--border)' }}
    >
      <p className="text-xs font-600 mb-2 flex items-center gap-1.5" style={{ color: 'var(--muted-foreground)', fontWeight: 600 }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="4 7 4 4 20 4 20 7" />
          <line x1="9" y1="20" x2="15" y2="20" />
          <line x1="12" y1="4" x2="12" y2="20" />
        </svg>
        Font Size
      </p>
      <div className="flex gap-1">
        {SIZES.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => handleChange(key)}
            className="flex-1 py-1.5 rounded-lg text-xs font-600 transition-all"
            style={{
              fontWeight: 600,
              background: activeSize === key ? 'var(--primary)' : 'transparent',
              color: activeSize === key ? 'white' : 'var(--muted-foreground)',
              border: '1.5px solid',
              borderColor: activeSize === key ? 'var(--primary)' : 'var(--border)',
            }}
            aria-label={`Set font size to ${key}`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
