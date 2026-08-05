'use client';
import React, { useState } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { BookOpen } from 'lucide-react';

interface Session {
  id: string;
  topic: string;
  score: number | null;
}

interface TopicPieChartProps {
  sessions: Session[];
  studentName: string;
}

const TOPIC_COLORS = [
  '#7C6EAA',
  '#F0C060',
  '#64B5F6',
  '#81C784',
  '#FF8A65',
  '#BA68C8',
  '#4DB6AC',
  '#FFD54F',
];

const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ name: string; value: number; payload: { avgScore: number | null } }> }) => {
  if (active && payload && payload.length) {
    return (
      <div
        className="px-3 py-2.5 rounded-xl text-xs card-glow"
        style={{ background: 'var(--card)', border: '1.5px solid var(--border)' }}
      >
        <p className="font-600 mb-1" style={{ color: 'var(--foreground)', fontWeight: 600 }}>
          {payload[0].name}
        </p>
        <p style={{ color: 'var(--muted-foreground)' }}>
          {payload[0].value} session{payload[0].value !== 1 ? 's' : ''}
        </p>
        {payload[0].payload.avgScore !== null && (
          <p className="tabular-nums" style={{ color: 'var(--primary)', fontVariantNumeric: 'tabular-nums' }}>
            Avg score: {payload[0].payload.avgScore}%
          </p>
        )}
      </div>
    );
  }
  return null;
};

const CustomLegend = ({ payload }: { payload?: Array<{ value: string; color: string }> }) => {
  if (!payload) return null;
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1.5 justify-center mt-2">
      {payload.map((entry) => (
        <div key={`legend-${entry.value}`} className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: entry.color }} />
          <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{entry.value}</span>
        </div>
      ))}
    </div>
  );
};

export default function TopicPieChart({ sessions, studentName }: TopicPieChartProps) {
  // Aggregate sessions by topic
  const topicMap: Record<string, { count: number; totalScore: number; scoredCount: number }> = {};
  sessions.forEach((s) => {
    if (!topicMap[s.topic]) topicMap[s.topic] = { count: 0, totalScore: 0, scoredCount: 0 };
    topicMap[s.topic].count += 1;
    if (s.score !== null) {
      topicMap[s.topic].totalScore += s.score;
      topicMap[s.topic].scoredCount += 1;
    }
  });

  const data = Object.entries(topicMap).map(([topic, val]) => ({
    name: topic,
    value: val.count,
    avgScore: val.scoredCount > 0 ? Math.round(val.totalScore / val.scoredCount) : null,
  }));

  return (
    <div
      className="rounded-2xl p-5 card-glow"
      style={{ background: 'var(--card)', border: '1.5px solid var(--border)' }}
    >
      <div className="flex items-center gap-2 mb-1">
        <BookOpen size={16} style={{ color: 'var(--primary)' }} />
        <h3 className="text-sm font-700" style={{ color: 'var(--foreground)', fontWeight: 700 }}>
          Topic Distribution
        </h3>
      </div>
      <p className="text-xs mb-4" style={{ color: 'var(--muted-foreground)' }}>
        Sessions by educational pillar · {sessions.length} total
      </p>

      {data.length === 0 ? (
        <div className="flex items-center justify-center h-48 rounded-xl" style={{ background: 'var(--muted)' }}>
          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>No session data yet</p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="45%"
              innerRadius={55}
              outerRadius={90}
              paddingAngle={3}
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell
                  key={`pie-cell-${entry.name}`}
                  fill={TOPIC_COLORS[index % TOPIC_COLORS.length]}
                  stroke="var(--card)"
                  strokeWidth={2}
                />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend content={<CustomLegend />} />
          </PieChart>
        </ResponsiveContainer>
      )}

      {/* Topic breakdown list */}
      <div className="mt-3 flex flex-col gap-2">
        {data.map((entry, idx) => (
          <div key={`topic-row-${entry.name}`} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ background: TOPIC_COLORS[idx % TOPIC_COLORS.length] }}
              />
              <span className="text-xs truncate" style={{ color: 'var(--foreground)' }}>{entry.name}</span>
            </div>
            <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--muted-foreground)' }}>
              <span className="tabular-nums" style={{ fontVariantNumeric: 'tabular-nums' }}>
                {entry.value} session{entry.value !== 1 ? 's' : ''}
              </span>
              {entry.avgScore !== null && (
                <span
                  className="tabular-nums font-600"
                  style={{
                    color: entry.avgScore >= 80 ? '#2E7D32' : entry.avgScore >= 60 ? '#F57F17' : '#C62828',
                    fontWeight: 600,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {entry.avgScore}%
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}