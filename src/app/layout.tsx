import React from 'react';
import type { Metadata, Viewport } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import '../styles/tailwind.css';
import { Toaster } from 'sonner';
import { AuthProvider } from '@/contexts/AuthContext';

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-plus-jakarta-sans',
  display: 'swap',
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export const metadata: Metadata = {
  title: "Luminar's Guide — AI Mentorship Assistant for Educators",
  description:
    "Luminar's Guide helps mentors generate AI-powered personalized guidance and track student progress across educational, emotional, and social pillars.",
  icons: {
    icon: [{ url: '/favicon.ico', type: 'image/x-icon' }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={plusJakartaSans.variable}>
      <body className={plusJakartaSans.className}>
        <AuthProvider>
          {children}
        </AuthProvider>
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              fontFamily: 'var(--font-sans)',
              background: 'var(--card)',
              color: 'var(--foreground)',
              border: '1.5px solid var(--border)',
              borderRadius: '12px',
            },
          }}
        />

        <script type="module" async src="https://static.rocket.new/rocket-web.js?_cfg=https%3A%2F%2Fluminarsgu1266back.builtwithrocket.new&_be=https%3A%2F%2Fappanalytics.rocket.new&_v=0.1.20" />
        <script type="module" defer src="https://static.rocket.new/rocket-shot.js?v=0.0.2" /></body>
    </html>
  );
}