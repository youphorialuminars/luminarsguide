import React from 'react';
import { Users, TrendingUp, AlertTriangle, Star } from 'lucide-react';
import Icon from '@/components/ui/AppIcon';


interface Student {
  id: string;
  avgScore: number;
  sessions: number;
  alertLevel: string | null;
  trend: string;
}

export default function DashboardStats({ students }: { students: Student[] }) {
  const totalStudents = students.length;
  const avgScore = Math.round(students.reduce((s, st) => s + st.avgScore, 0) / students.length);
  const totalSessions = students.reduce((s, st) => s + st.sessions, 0);
  const needsAttention = students.filter((s) => s.alertLevel !== null).length;

  const stats = [
    {
      id: 'stat-total',
      label: 'Registered Students',
      value: totalStudents,
      icon: Users,
      color: 'var(--primary)',
      bg: 'var(--secondary)',
      trend: null,
    },
    {
      id: 'stat-avg',
      label: 'Average Score',
      value: `${avgScore}%`,
      icon: Star,
      color: '#2E7D32',
      bg: '#E8F5E9',
      trend: '+3.2% this month',
    },
    {
      id: 'stat-sessions',
      label: 'Total Sessions',
      value: totalSessions,
      icon: TrendingUp,
      color: '#1565C0',
      bg: '#E3F2FD',
      trend: '12 this week',
    },
    {
      id: 'stat-attention',
      label: 'Needs Attention',
      value: needsAttention,
      icon: AlertTriangle,
      color: '#C62828',
      bg: '#FDECEA',
      trend: 'Review recommended',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-2">
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <div
            key={stat.id}
            className="rounded-2xl p-4 border"
            style={{ background: stat.bg, borderColor: 'var(--border)' }}
          >
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-600 uppercase tracking-wide" style={{ color: stat.color, fontWeight: 600, letterSpacing: '0.05em' }}>
                {stat.label}
              </p>
              <Icon size={16} style={{ color: stat.color }} />
            </div>
            <p className="text-3xl font-bold tabular-nums" style={{ color: 'var(--foreground)', fontVariantNumeric: 'tabular-nums' }}>
              {stat.value}
            </p>
            {stat.trend && (
              <p className="text-xs mt-1" style={{ color: stat.color }}>
                {stat.trend}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}