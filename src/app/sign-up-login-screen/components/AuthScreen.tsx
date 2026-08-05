'use client';
import React, { useState } from 'react';
import LoginForm from './LoginForm';
import SignUpForm from './SignUpForm';
import ForgotPasswordForm from './ForgotPasswordForm';
import { Star, BookOpen, Heart, Shield, Sparkles } from 'lucide-react';
import Icon from '@/components/ui/AppIcon';


type AuthView = 'login' | 'signup' | 'forgot';

export default function AuthScreen() {
  const [view, setView] = useState<AuthView>('login');

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--background)' }}>
      {/* Left panel — brand illustration */}
      <div
        className="hidden lg:flex flex-col justify-between w-[480px] xl:w-[520px] flex-shrink-0 relative overflow-hidden p-10"
        style={{ background: 'var(--gradient-hero)' }}
      >
        {/* Decorative orbs */}
        <div
          className="absolute top-[-80px] left-[-80px] w-[320px] h-[320px] rounded-full opacity-20"
          style={{ background: 'radial-gradient(circle, #FAE8A0 0%, transparent 70%)' }}
        />
        <div
          className="absolute bottom-[-100px] right-[-60px] w-[280px] h-[280px] rounded-full opacity-15"
          style={{ background: 'radial-gradient(circle, #C8D8F8 0%, transparent 70%)' }}
        />

        {/* Logo */}
        <div className="flex items-center gap-3 relative z-10">
          <div
            className="w-10 h-10 rounded-2xl flex items-center justify-center"
            style={{ background: 'rgba(255,255,255,0.25)', backdropFilter: 'blur(8px)' }}
          >
            <Star size={20} className="text-white" />
          </div>
          <span className="text-white font-bold text-lg">Luminar's Guide</span>
        </div>

        {/* Center content */}
        <div className="relative z-10">
          <div
            className="w-20 h-20 rounded-3xl flex items-center justify-center mb-6"
            style={{ background: 'rgba(255,255,255,0.20)', backdropFilter: 'blur(10px)' }}
          >
            <BookOpen size={40} className="text-white" />
          </div>
          <h1 className="text-3xl xl:text-4xl font-bold text-white leading-tight mb-4">
            Guiding Every<br />Student's Journey
          </h1>
          <p className="text-white/80 text-base leading-relaxed mb-8">
            An AI-powered mentorship assistant that helps educators generate
            personalized guidance and track meaningful student progress.
          </p>

          {/* Feature pills */}
          <div className="flex flex-col gap-3">
            {[
              { icon: Sparkles, text: 'AI-generated personalized analysis' },
              { icon: Heart, text: 'Holistic student well-being focus' },
              { icon: Shield, text: 'Secure & private session history' },
            ].map((feat) => {
              const Icon = feat.icon;
              return (
                <div
                  key={`feat-${feat.text.slice(0, 10)}`}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl"
                  style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)' }}
                >
                  <Icon size={16} className="text-white flex-shrink-0" />
                  <span className="text-white/90 text-sm font-500">{feat.text}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer quote */}
        <div className="relative z-10">
          <p className="text-white/60 text-xs italic">
            "Education is not the filling of a pail, but the lighting of a fire."
          </p>
          <p className="text-white/40 text-xs mt-1">— W.B. Yeats</p>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center px-6 py-10">
        <div className="w-full max-w-[420px]">
          {/* Mobile logo */}
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <div className="w-8 h-8 rounded-xl gradient-primary flex items-center justify-center">
              <Star size={16} className="text-white" />
            </div>
            <span className="font-bold text-base" style={{ color: 'var(--foreground)' }}>
              Luminar's Guide
            </span>
          </div>

          {view === 'login' && (
            <LoginForm
              onSwitchToSignup={() => setView('signup')}
              onForgotPassword={() => setView('forgot')}
            />
          )}
          {view === 'signup' && (
            <SignUpForm onSwitchToLogin={() => setView('login')} />
          )}
          {view === 'forgot' && (
            <ForgotPasswordForm onBack={() => setView('login')} />
          )}
        </div>
      </div>
    </div>
  );
}