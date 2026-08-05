'use client';
import React, { useState, useEffect } from 'react';
import { Sparkles, Brain, BookOpen, CheckCircle2 } from 'lucide-react';
import Icon from '@/components/ui/AppIcon';


const STEPS_STANDARD = [
  { icon: Brain, label: 'Activating veteran educator persona...', duration: 800 },
  { icon: BookOpen, label: 'Processing session data and observations...', duration: 1200 },
  { icon: Sparkles, label: 'Generating personalized guidance...', duration: 1200 },
  { icon: CheckCircle2, label: 'Finalizing analysis output...', duration: 600 },
];

const STEPS_COMPLEX = [
  { icon: Brain, label: 'Activating enhanced educator persona...', duration: 700 },
  { icon: BookOpen, label: 'Analyzing sensitive topic context...', duration: 1000 },
  { icon: Sparkles, label: 'Applying specialized well-being framework...', duration: 1300 },
  { icon: CheckCircle2, label: 'Finalizing nuanced guidance...', duration: 800 },
];

export default function AILoadingOverlay({
  topic,
  isComplex,
}: {
  topic: string;
  isComplex: boolean;
}) {
  const steps = isComplex ? STEPS_COMPLEX : STEPS_STANDARD;
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    let total = 0;
    const timers: ReturnType<typeof setTimeout>[] = [];
    steps.forEach((step, i) => {
      total += step.duration;
      const t = setTimeout(() => setCurrentStep(i + 1), total);
      timers.push(t);
    });
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(45, 37, 80, 0.5)', backdropFilter: 'blur(8px)' }}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-8 text-center card-glow slide-up"
        style={{ background: 'var(--card)', border: '1.5px solid var(--border)' }}
      >
        {/* Pulsing icon */}
        <div
          className="w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center mx-auto mb-5"
          style={{ animation: 'pulse 2s infinite' }}
        >
          <Sparkles size={28} className="text-white" />
        </div>

        <h3 className="text-lg font-bold mb-1" style={{ color: 'var(--foreground)' }}>
          {isComplex ? 'Deep Analysis in Progress' : 'Generating Analysis'}
        </h3>
        <p className="text-xs mb-6" style={{ color: 'var(--muted-foreground)' }}>
          Topic: <strong>{topic}</strong> · {isComplex ? 'Gemini Pro' : 'Gemini Flash'}
        </p>

        {/* Steps */}
        <div className="flex flex-col gap-3 text-left">
          {steps.map((step, i) => {
            const Icon = step.icon;
            const isDone = currentStep > i;
            const isActive = currentStep === i;
            return (
              <div key={`step-${i + 1}`} className="flex items-center gap-3">
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-all duration-300"
                  style={{
                    background: isDone ? '#E8F5E9' : isActive ? 'var(--secondary)' : 'var(--muted)',
                  }}
                >
                  {isDone ? (
                    <CheckCircle2 size={14} style={{ color: '#2E7D32' }} />
                  ) : (
                    <Icon
                      size={14}
                      style={{
                        color: isActive ? 'var(--primary)' : 'var(--muted-foreground)',
                      }}
                    />
                  )}
                </div>
                <span
                  className="text-xs"
                  style={{
                    color: isDone ? '#2E7D32' : isActive ? 'var(--foreground)' : 'var(--muted-foreground)',
                    fontWeight: isActive ? 600 : 400,
                  }}
                >
                  {step.label}
                </span>
                {isActive && (
                  <svg className="animate-spin w-3 h-3 ml-auto flex-shrink-0" viewBox="0 0 24 24" fill="none" style={{ color: 'var(--primary)' }}>
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}