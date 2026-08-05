'use client';
import React, { useState, useEffect } from 'react';
import Sidebar from './Sidebar';

interface AppLayoutProps {
  children: React.ReactNode;
  activeRoute?: string;
}

export default function AppLayout({ children, activeRoute }: AppLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Restore saved font size preference on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('luminar_font_size');
      if (saved && ['small', 'medium', 'large'].includes(saved)) {
        const sizeMap: Record<string, string> = { small: '13px', medium: '14px', large: '16px' };
        document.documentElement.style.fontSize = sizeMap[saved] ?? '14px';
      }
    } catch {
      // ignore
    }
  }, []);

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--background)' }}>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-foreground/20 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((v) => !v)}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
        activeRoute={activeRoute}
      />

      {/* Main content */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Mobile topbar */}
        <div
          className="flex items-center justify-between px-4 py-3 lg:hidden border-b"
          style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
        >
          <button
            onClick={() => setMobileOpen(true)}
            className="p-2 rounded-lg hover:bg-muted transition-colors"
            aria-label="Open navigation menu"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg gradient-primary flex items-center justify-center">
              <span className="text-white text-xs font-bold">LG</span>
            </div>
            <span className="font-bold text-sm" style={{ color: 'var(--foreground)' }}>
              Luminar's Guide
            </span>
          </div>
          <div className="w-9" />
        </div>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-screen-2xl mx-auto px-4 md:px-6 xl:px-10 py-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}