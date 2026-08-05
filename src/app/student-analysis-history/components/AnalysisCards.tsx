'use client';
import React, { useState } from 'react';
import { Star, AlertCircle, Compass, ClipboardList, ChevronDown, ChevronUp } from 'lucide-react';
import Icon from '@/components/ui/AppIcon';


interface AnalysisCardsProps {
  analysis: {
    strengths: string[];
    weaknesses: string[];
    approach: string[];
    tasks: string[];
  };
}

const CARDS = [
  {
    key: 'strengths' as const,
    label: 'Strengths',
    icon: Star,
    headerBg: '#E8F5E9',
    headerColor: '#2E7D32',
    iconBg: '#C8E6C9',
    bulletColor: '#4CAF50',
    badgeClass: 'badge-strength',
  },
  {
    key: 'weaknesses' as const,
    label: 'Weaknesses',
    icon: AlertCircle,
    headerBg: '#FDECEA',
    headerColor: '#C62828',
    iconBg: '#FFCDD2',
    bulletColor: '#EF5350',
    badgeClass: 'badge-weakness',
  },
  {
    key: 'approach' as const,
    label: 'Approach Required',
    icon: Compass,
    headerBg: '#FFF8E1',
    headerColor: '#F57F17',
    iconBg: '#FFE082',
    bulletColor: '#FFA726',
    badgeClass: 'badge-approach',
  },
  {
    key: 'tasks' as const,
    label: 'Task List',
    icon: ClipboardList,
    headerBg: '#E8EAF6',
    headerColor: '#283593',
    iconBg: '#C5CAE9',
    bulletColor: '#3949AB',
    badgeClass: 'badge-task',
  },
];

export default function AnalysisCards({ analysis }: AnalysisCardsProps) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    strengths: true,
    weaknesses: true,
    approach: true,
    tasks: true,
  });

  const toggleCard = (key: string) => {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {CARDS.map((card) => {
        const Icon = card.icon;
        const items: string[] = analysis[card.key];
        const isExpanded = expanded[card.key];

        return (
          <div
            key={`analysis-card-${card.key}`}
            className="analysis-card"
          >
            {/* Card header */}
            <button
              type="button"
              onClick={() => toggleCard(card.key)}
              className="w-full flex items-center justify-between mb-0"
              aria-expanded={isExpanded}
              aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${card.label} section`}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: card.iconBg }}
                >
                  <Icon size={17} style={{ color: card.headerColor }} />
                </div>
                <div className="text-left">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-700" style={{ color: 'var(--foreground)', fontWeight: 700 }}>
                      {card.label}
                    </h3>
                    <span className={card.badgeClass}>{items.length} items</span>
                  </div>
                </div>
              </div>
              {isExpanded ? (
                <ChevronUp size={16} style={{ color: 'var(--muted-foreground)' }} />
              ) : (
                <ChevronDown size={16} style={{ color: 'var(--muted-foreground)' }} />
              )}
            </button>

            {/* Divider */}
            {isExpanded && (
              <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--border)' }}>
                <ul className="flex flex-col gap-2.5">
                  {items.map((item, idx) => (
                    <li
                      key={`${card.key}-item-${idx + 1}`}
                      className="flex items-start gap-2.5"
                    >
                      <span
                        className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5 tabular-nums"
                        style={{
                          background: card.headerBg,
                          color: card.headerColor,
                          fontWeight: 700,
                          minWidth: '20px',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {idx + 1}
                      </span>
                      <p className="text-sm leading-relaxed" style={{ color: 'var(--foreground)' }}>
                        {item}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}