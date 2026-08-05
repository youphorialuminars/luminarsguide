'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Plus, Video, Copy, Check, Trash2, X, Clock, CalendarCheck, UserCheck, UserX } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface Meeting {
  id: string;
  title: string;
  meeting_date: string;
  meeting_time: string;
  jitsi_url: string;
  jitsi_room: string;
  notes: string;
}

interface AttendanceRecord {
  attendance_date: string;
  status: 'present' | 'absent';
}

interface StudentCalendarProps {
  studentId: string;
  studentName: string;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function generateRoomId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 10; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function formatDateKey(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export default function StudentCalendar({ studentId, studentName }: StudentCalendarProps) {
  const { user } = useAuth();
  const [currentYear, setCurrentYear] = useState(0);
  const [currentMonth, setCurrentMonth] = useState(0);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [attendance, setAttendance] = useState<Record<string, 'present' | 'absent'>>({});
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showDayModal, setShowDayModal] = useState(false);
  const [showAttendanceModal, setShowAttendanceModal] = useState(false);
  const [scheduleTitle, setScheduleTitle] = useState('Mentorship Session');
  const [scheduleTime, setScheduleTime] = useState('10:00');
  const [scheduleNotes, setScheduleNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [savingAttendance, setSavingAttendance] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [today, setToday] = useState('');
  const [activeView, setActiveView] = useState<'meetings' | 'attendance'>('meetings');

  useEffect(() => {
    const now = new Date();
    setCurrentYear(now.getFullYear());
    setCurrentMonth(now.getMonth());
    setToday(formatDateKey(now.getFullYear(), now.getMonth(), now.getDate()));
  }, []);

  const fetchMeetings = useCallback(async () => {
    if (!user || !studentId) return;
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('meetings')
        .select('id, title, meeting_date, meeting_time, jitsi_url, jitsi_room, notes')
        .eq('student_id', studentId)
        .eq('mentor_id', user.id)
        .order('meeting_date', { ascending: true });

      if (!error && data) {
        setMeetings(data as Meeting[]);
      }
    } catch {
      // ignore
    }
  }, [user, studentId]);

  const fetchAttendance = useCallback(async () => {
    if (!user || !studentId) return;
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('attendance')
        .select('attendance_date, status')
        .eq('student_id', studentId)
        .eq('mentor_id', user.id);

      if (!error && data) {
        const map: Record<string, 'present' | 'absent'> = {};
        (data as AttendanceRecord[]).forEach((r) => {
          map[r.attendance_date] = r.status;
        });
        setAttendance(map);
      }
    } catch {
      // ignore
    }
  }, [user, studentId]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await Promise.all([fetchMeetings(), fetchAttendance()]);
      setLoading(false);
    };
    load();
  }, [fetchMeetings, fetchAttendance]);

  const prevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const nextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const meetingsByDate = meetings.reduce<Record<string, Meeting[]>>((acc, m) => {
    if (!acc[m.meeting_date]) acc[m.meeting_date] = [];
    acc[m.meeting_date].push(m);
    return acc;
  }, {});

  const handleDayClick = (dateKey: string) => {
    setSelectedDate(dateKey);
    if (activeView === 'attendance') {
      setShowAttendanceModal(true);
    } else {
      if (meetingsByDate[dateKey]?.length) {
        setShowDayModal(true);
      } else {
        setScheduleTitle('Mentorship Session');
        setScheduleTime('10:00');
        setScheduleNotes('');
        setShowScheduleModal(true);
      }
    }
  };

  const handleMarkAttendance = async (status: 'present' | 'absent') => {
    if (!user || !selectedDate) return;
    setSavingAttendance(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('attendance')
        .upsert(
          {
            mentor_id: user.id,
            student_id: studentId,
            attendance_date: selectedDate,
            status,
          },
          { onConflict: 'student_id,attendance_date' }
        );

      if (!error) {
        setAttendance((prev) => ({ ...prev, [selectedDate]: status }));
      }
    } finally {
      setSavingAttendance(false);
      setShowAttendanceModal(false);
      setSelectedDate(null);
    }
  };

  const handleRemoveAttendance = async (dateKey: string) => {
    if (!user) return;
    const supabase = createClient();
    await supabase
      .from('attendance')
      .delete()
      .eq('student_id', studentId)
      .eq('attendance_date', dateKey)
      .eq('mentor_id', user.id);
    setAttendance((prev) => {
      const next = { ...prev };
      delete next[dateKey];
      return next;
    });
  };

  const handleScheduleMeeting = async () => {
    if (!user || !selectedDate) return;
    setSaving(true);
    try {
      const roomId = generateRoomId();
      const roomName = `LuminarsGuide-${roomId}`;
      const jitsiUrl = `https://meet.jit.si/${roomName}`;
      const supabase = createClient();
      const { error } = await supabase.from('meetings').insert({
        mentor_id: user.id,
        student_id: studentId,
        title: scheduleTitle || 'Mentorship Session',
        meeting_date: selectedDate,
        meeting_time: scheduleTime,
        jitsi_room: roomName,
        jitsi_url: jitsiUrl,
        notes: scheduleNotes,
      });
      if (!error) {
        await fetchMeetings();
        setShowScheduleModal(false);
        setSelectedDate(null);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteMeeting = async (meetingId: string) => {
    const supabase = createClient();
    await supabase.from('meetings').delete().eq('id', meetingId);
    await fetchMeetings();
  };

  const copyLink = async (url: string, id: string) => {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const el = document.createElement('textarea');
      el.value = url;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    }
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  // Attendance summary for current month
  const presentCount = Object.entries(attendance).filter(([date, status]) => {
    const d = new Date(date);
    return d.getFullYear() === currentYear && d.getMonth() === currentMonth && status === 'present';
  }).length;
  const absentCount = Object.entries(attendance).filter(([date, status]) => {
    const d = new Date(date);
    return d.getFullYear() === currentYear && d.getMonth() === currentMonth && status === 'absent';
  }).length;

  if (currentYear === 0) {
    return (
      <div className="rounded-2xl p-6" style={{ background: 'var(--card)', border: '1.5px solid var(--border)' }}>
        <div className="animate-pulse h-64 rounded-xl" style={{ background: 'var(--secondary)' }} />
      </div>
    );
  }

  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const firstDay = getFirstDayOfMonth(currentYear, currentMonth);
  const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7;

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--card)', border: '1.5px solid var(--border)' }}>
      {/* Calendar header */}
      <div
        className="flex items-center justify-between px-5 py-4"
        style={{ background: 'var(--secondary)', borderBottom: '1px solid var(--border)' }}
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--gradient-primary)' }}>
            <CalendarCheck size={15} className="text-white" />
          </div>
          <div>
            <h3 className="text-sm font-bold" style={{ color: 'var(--foreground)' }}>Session Calendar</h3>
            <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Meetings & Attendance for {studentName}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-muted transition-colors" aria-label="Previous month">
            <ChevronLeft size={16} style={{ color: 'var(--muted-foreground)' }} />
          </button>
          <span className="text-sm font-600 px-2 min-w-[130px] text-center" style={{ color: 'var(--foreground)', fontWeight: 600 }}>
            {MONTHS[currentMonth]} {currentYear}
          </span>
          <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-muted transition-colors" aria-label="Next month">
            <ChevronRight size={16} style={{ color: 'var(--muted-foreground)' }} />
          </button>
        </div>
      </div>

      {/* View toggle */}
      <div className="flex gap-1 p-3" style={{ borderBottom: '1px solid var(--border)', background: 'var(--muted)' }}>
        <button
          onClick={() => setActiveView('meetings')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-600 transition-all"
          style={{
            background: activeView === 'meetings' ? 'var(--card)' : 'transparent',
            color: activeView === 'meetings' ? 'var(--primary-dark)' : 'var(--muted-foreground)',
            fontWeight: 600,
            boxShadow: activeView === 'meetings' ? '0 1px 4px rgba(124,110,170,0.10)' : 'none',
          }}
        >
          <Video size={13} />
          Meetings
        </button>
        <button
          onClick={() => setActiveView('attendance')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-600 transition-all"
          style={{
            background: activeView === 'attendance' ? 'var(--card)' : 'transparent',
            color: activeView === 'attendance' ? 'var(--primary-dark)' : 'var(--muted-foreground)',
            fontWeight: 600,
            boxShadow: activeView === 'attendance' ? '0 1px 4px rgba(124,110,170,0.10)' : 'none',
          }}
        >
          <UserCheck size={13} />
          Attendance
        </button>

        {/* Attendance summary */}
        {activeView === 'attendance' && (
          <div className="ml-auto flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#A8D5A2' }} />
              <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{presentCount} Present</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#F4A9A8' }} />
              <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{absentCount} Absent</span>
            </div>
          </div>
        )}
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 border-b" style={{ borderColor: 'var(--border)' }}>
        {DAYS.map((d) => (
          <div key={d} className="py-2 text-center text-xs font-600" style={{ color: 'var(--muted-foreground)', fontWeight: 600 }}>
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7">
        {Array.from({ length: totalCells }).map((_, idx) => {
          const dayNum = idx - firstDay + 1;
          const isValid = dayNum >= 1 && dayNum <= daysInMonth;
          const dateKey = isValid ? formatDateKey(currentYear, currentMonth, dayNum) : '';
          const dayMeetings = isValid ? (meetingsByDate[dateKey] ?? []) : [];
          const isToday = dateKey === today;
          const attendanceStatus = isValid ? attendance[dateKey] : undefined;

          // Attendance background colors
          let cellBg = 'transparent';
          if (isValid && activeView === 'attendance' && attendanceStatus === 'present') {
            cellBg = '#D4EDDA'; // soft pastel green
          } else if (isValid && activeView === 'attendance' && attendanceStatus === 'absent') {
            cellBg = '#FADADD'; // soft pastel red
          }

          return (
            <div
              key={`cell-${idx}`}
              onClick={() => isValid && handleDayClick(dateKey)}
              className="min-h-[72px] p-1.5 border-b border-r transition-colors"
              style={{
                borderColor: 'var(--border)',
                background: isValid ? cellBg : 'var(--muted)',
                cursor: isValid ? 'pointer' : 'default',
              }}
              onMouseEnter={(e) => {
                if (isValid && !attendanceStatus) {
                  (e.currentTarget as HTMLElement).style.background = 'var(--secondary)';
                }
              }}
              onMouseLeave={(e) => {
                if (isValid) {
                  (e.currentTarget as HTMLElement).style.background = cellBg;
                }
              }}
            >
              {isValid && (
                <>
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-600 mb-1"
                    style={{
                      fontWeight: 600,
                      background: isToday ? 'var(--primary)' : 'transparent',
                      color: isToday ? 'white' : 'var(--foreground)',
                    }}
                  >
                    {dayNum}
                  </div>

                  {/* Attendance view: show status badge */}
                  {activeView === 'attendance' && attendanceStatus && (
                    <div
                      className="text-xs px-1 py-0.5 rounded mb-0.5 flex items-center gap-0.5"
                      style={{
                        background: attendanceStatus === 'present' ? '#A8D5A2' : '#F4A9A8',
                        color: attendanceStatus === 'present' ? '#1B5E20' : '#7B1A1A',
                        fontSize: '10px',
                        fontWeight: 600,
                      }}
                    >
                      {attendanceStatus === 'present' ? <UserCheck size={9} /> : <UserX size={9} />}
                      {attendanceStatus === 'present' ? 'Present' : 'Absent'}
                    </div>
                  )}

                  {/* Meetings view: show meeting chips */}
                  {activeView === 'meetings' && (
                    <>
                      {dayMeetings.slice(0, 2).map((m) => (
                        <div
                          key={m.id}
                          className="text-xs px-1.5 py-0.5 rounded mb-0.5 truncate"
                          style={{ background: 'var(--primary)', color: 'white', fontSize: '10px' }}
                          title={`${m.title} at ${m.meeting_time}`}
                        >
                          {m.meeting_time} {m.title}
                        </div>
                      ))}
                      {dayMeetings.length > 2 && (
                        <div className="text-xs" style={{ color: 'var(--primary)', fontSize: '10px' }}>
                          +{dayMeetings.length - 2} more
                        </div>
                      )}
                    </>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      {activeView === 'attendance' && (
        <div
          className="px-5 py-3 flex items-center gap-4 flex-wrap"
          style={{ borderTop: '1px solid var(--border)', background: 'var(--muted)' }}
        >
          <p className="text-xs font-600" style={{ color: 'var(--muted-foreground)', fontWeight: 600 }}>
            Click any date to mark attendance:
          </p>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded" style={{ background: '#D4EDDA', border: '1px solid #A8D5A2' }} />
            <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Present</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded" style={{ background: '#FADADD', border: '1px solid #F4A9A8' }} />
            <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Absent</span>
          </div>
        </div>
      )}

      {loading && (
        <div className="px-5 py-3 text-xs text-center" style={{ color: 'var(--muted-foreground)' }}>
          Loading calendar data...
        </div>
      )}

      {/* Attendance Modal */}
      {showAttendanceModal && selectedDate && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(45, 37, 80, 0.5)', backdropFilter: 'blur(6px)' }}
        >
          <div
            className="w-full max-w-sm rounded-2xl p-6 slide-up"
            style={{ background: 'var(--card)', border: '1.5px solid var(--border)' }}
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-bold" style={{ color: 'var(--foreground)' }}>Mark Attendance</h2>
                <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>{selectedDate}</p>
              </div>
              <button
                onClick={() => { setShowAttendanceModal(false); setSelectedDate(null); }}
                className="p-1.5 rounded-lg hover:bg-muted transition-colors"
              >
                <X size={16} style={{ color: 'var(--muted-foreground)' }} />
              </button>
            </div>

            {attendance[selectedDate] && (
              <div
                className="flex items-center gap-2 px-3 py-2 rounded-xl mb-4 text-xs"
                style={{
                  background: attendance[selectedDate] === 'present' ? '#D4EDDA' : '#FADADD',
                  color: attendance[selectedDate] === 'present' ? '#1B5E20' : '#7B1A1A',
                }}
              >
                {attendance[selectedDate] === 'present' ? <UserCheck size={13} /> : <UserX size={13} />}
                Currently marked as <strong>{attendance[selectedDate]}</strong>
              </div>
            )}

            <div className="flex flex-col gap-3">
              <button
                type="button"
                disabled={savingAttendance}
                onClick={() => handleMarkAttendance('present')}
                className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-600 transition-all"
                style={{
                  background: '#D4EDDA',
                  color: '#1B5E20',
                  fontWeight: 600,
                  border: '2px solid #A8D5A2',
                }}
              >
                <UserCheck size={16} />
                Mark as Present
              </button>
              <button
                type="button"
                disabled={savingAttendance}
                onClick={() => handleMarkAttendance('absent')}
                className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-600 transition-all"
                style={{
                  background: '#FADADD',
                  color: '#7B1A1A',
                  fontWeight: 600,
                  border: '2px solid #F4A9A8',
                }}
              >
                <UserX size={16} />
                Mark as Absent
              </button>
              {attendance[selectedDate] && (
                <button
                  type="button"
                  disabled={savingAttendance}
                  onClick={() => {
                    handleRemoveAttendance(selectedDate);
                    setShowAttendanceModal(false);
                    setSelectedDate(null);
                  }}
                  className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs transition-all"
                  style={{ background: 'var(--muted)', color: 'var(--muted-foreground)' }}
                >
                  <Trash2 size={13} />
                  Remove Mark
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Schedule Meeting Modal */}
      {showScheduleModal && selectedDate && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(45, 37, 80, 0.5)', backdropFilter: 'blur(6px)' }}
        >
          <div
            className="w-full max-w-md rounded-2xl p-6 slide-up"
            style={{ background: 'var(--card)', border: '1.5px solid var(--border)' }}
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-base font-bold" style={{ color: 'var(--foreground)' }}>Schedule Meeting</h2>
                <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                  {selectedDate} · A Jitsi Meet link will be auto-generated
                </p>
              </div>
              <button
                onClick={() => { setShowScheduleModal(false); setSelectedDate(null); }}
                className="p-1.5 rounded-lg hover:bg-muted transition-colors"
              >
                <X size={16} style={{ color: 'var(--muted-foreground)' }} />
              </button>
            </div>
            <div className="flex flex-col gap-4">
              <div>
                <label className="block text-sm font-600 mb-1.5" style={{ color: 'var(--foreground)', fontWeight: 600 }}>Meeting Title</label>
                <input type="text" className="input-mystic" value={scheduleTitle} onChange={(e) => setScheduleTitle(e.target.value)} placeholder="e.g. Weekly Check-in" />
              </div>
              <div>
                <label className="block text-sm font-600 mb-1.5" style={{ color: 'var(--foreground)', fontWeight: 600 }}>Time</label>
                <input type="time" className="input-mystic" value={scheduleTime} onChange={(e) => setScheduleTime(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-600 mb-1.5" style={{ color: 'var(--foreground)', fontWeight: 600 }}>Notes (optional)</label>
                <textarea className="input-mystic resize-none" rows={2} value={scheduleNotes} onChange={(e) => setScheduleNotes(e.target.value)} placeholder="Any agenda or notes..." />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button type="button" onClick={() => { setShowScheduleModal(false); setSelectedDate(null); }} className="btn-secondary flex-1">Cancel</button>
              <button type="button" onClick={handleScheduleMeeting} disabled={saving} className="btn-primary flex-1 flex items-center justify-center gap-2">
                {saving ? <svg className="animate-spin w-4 h-4 text-white" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" /></svg> : <Video size={15} />}
                {saving ? 'Scheduling...' : 'Schedule Meeting'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Day meetings modal */}
      {showDayModal && selectedDate && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(45, 37, 80, 0.5)', backdropFilter: 'blur(6px)' }}
        >
          <div
            className="w-full max-w-md rounded-2xl p-6 slide-up"
            style={{ background: 'var(--card)', border: '1.5px solid var(--border)' }}
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-base font-bold" style={{ color: 'var(--foreground)' }}>Meetings on {selectedDate}</h2>
                <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>{meetingsByDate[selectedDate]?.length ?? 0} scheduled</p>
              </div>
              <button onClick={() => { setShowDayModal(false); setSelectedDate(null); }} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                <X size={16} style={{ color: 'var(--muted-foreground)' }} />
              </button>
            </div>
            <div className="flex flex-col gap-3 mb-4">
              {(meetingsByDate[selectedDate] ?? []).map((m) => (
                <div key={m.id} className="rounded-xl p-4" style={{ background: 'var(--secondary)', border: '1px solid var(--border)' }}>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-600 truncate" style={{ color: 'var(--foreground)', fontWeight: 600 }}>{m.title}</p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <Clock size={11} style={{ color: 'var(--muted-foreground)' }} />
                        <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{m.meeting_time}</span>
                      </div>
                    </div>
                    <button onClick={() => handleDeleteMeeting(m.id)} className="p-1.5 rounded-lg flex-shrink-0" style={{ background: '#FDECEA', color: '#C62828' }} title="Delete meeting">
                      <Trash2 size={13} />
                    </button>
                  </div>
                  {m.notes && <p className="text-xs mb-2" style={{ color: 'var(--muted-foreground)' }}>{m.notes}</p>}
                  <div className="flex items-center gap-2">
                    <a href={m.jitsi_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-600" style={{ background: 'var(--primary)', color: 'white', fontWeight: 600, textDecoration: 'none' }}>
                      <Video size={12} />Join Meeting
                    </a>
                    <button onClick={() => copyLink(m.jitsi_url, m.id)} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-600 transition-all" style={{ background: copiedId === m.id ? '#E8F5E9' : 'var(--muted)', color: copiedId === m.id ? '#2E7D32' : 'var(--muted-foreground)', fontWeight: 600 }}>
                      {copiedId === m.id ? <Check size={12} /> : <Copy size={12} />}
                      {copiedId === m.id ? 'Copied!' : 'Copy Student Invite Link'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={() => { setShowDayModal(false); setScheduleTitle('Mentorship Session'); setScheduleTime('10:00'); setScheduleNotes(''); setShowScheduleModal(true); }} className="btn-primary w-full flex items-center justify-center gap-2">
              <Plus size={15} />Add Another Meeting
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
