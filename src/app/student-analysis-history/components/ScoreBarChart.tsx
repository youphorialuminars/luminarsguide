'use client';
import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from 'recharts';
import { TrendingUp } from 'lucide-react';

interface Session {
  id: string;
  date: string;
  topic: string;
  score: number | null;
}

interface ScoreBarChartProps {
  sessions: Session[];
  studentName: string;
}

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; payload: { topic: string } }>; label?: string }) => {
  if (active && payload && payload.length) {
    const score = payload[0].value;
    const topic = payload[0].payload.topic;
    const color = score >= 80 ? '#2E7D32' : score >= 60 ? '#F57F17' : '#C62828';
    return (
      <div
        className="px-3 py-2.5 rounded-xl text-xs card-glow"
        style={{ background: 'var(--card)', border: '1.5px solid var(--border)' }}
      >
        <p className="font-600 mb-1" style={{ color: 'var(--foreground)', fontWeight: 600 }}>{label}</p>
        <p style={{ color: 'var(--muted-foreground)' }}>{topic}</p>
        <p className="font-700 mt-1 tabular-nums" style={{ color, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
          Score: {score}/100
        </p>
      </div>
    );
  }
  return null;
};

export default function ScoreBarChart({ sessions, studentName }: ScoreBarChartProps) {
  const scored = sessions
    .filter((s) => s.score !== null)
    .map((s) => ({
      id: s.id,
      date: s.date.split(',')[0],
      topic: s.topic,
      score: s.score as number,
    }))
    .reverse();

  const avg = scored.length
    ? Math.round(scored.reduce((a, b) => a + b.score, 0) / scored.length)
    : 0;

  const getBarColor = (score: number) => {
    if (score >= 80) return '#4CAF50';
    if (score >= 60) return '#FFA726';
    return '#EF5350';
  };

  return (
    <div
      className="rounded-2xl p-5 card-glow"
      style={{ background: 'var(--card)', border: '1.5px solid var(--border)' }}
    >
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="flex items-center gap-2">
            <TrendingUp size={16} style={{ color: 'var(--primary)' }} />
            <h3 className="text-sm font-700" style={{ color: 'var(--foreground)', fontWeight: 700 }}>
              Score Progress
            </h3>
          </div>
          <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
            Test scores over time · Avg: {avg}%
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--muted-foreground)' }}>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: '#4CAF50' }} />80+</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: '#FFA726' }} />60–79</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: '#EF5350' }} />Below 60</span>
        </div>
      </div>

      {scored.length === 0 ? (
        <div className="flex items-center justify-center h-48 rounded-xl" style={{ background: 'var(--muted)' }}>
          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>No scored sessions yet</p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={scored} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="barGradientGreen" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#4CAF50" stopOpacity={0.9} />
                <stop offset="100%" stopColor="#4CAF50" stopOpacity={0.6} />
              </linearGradient>
              <linearGradient id="barGradientOrange" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#FFA726" stopOpacity={0.9} />
                <stop offset="100%" stopColor="#FFA726" stopOpacity={0.6} />
              </linearGradient>
              <linearGradient id="barGradientRed" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#EF5350" stopOpacity={0.9} />
                <stop offset="100%" stopColor="#EF5350" stopOpacity={0.6} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--muted)', radius: 6 }} />
            <ReferenceLine
              y={avg}
              stroke="var(--primary)"
              strokeDasharray="4 4"
              strokeWidth={1.5}
              label={{ value: `Avg ${avg}`, position: 'right', fontSize: 10, fill: 'var(--primary)' }}
            />
            <Bar dataKey="score" radius={[6, 6, 0, 0]} maxBarSize={48}>
              {scored.map((entry) => (
                <Cell
                  key={`bar-cell-${entry.id}`}
                  fill={
                    entry.score >= 80
                      ? 'url(#barGradientGreen)'
                      : entry.score >= 60
                      ? 'url(#barGradientOrange)'
                      : 'url(#barGradientRed)'
                  }
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}