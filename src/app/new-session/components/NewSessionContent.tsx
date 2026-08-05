'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { useRouter } from 'next/navigation';
import { Sparkles, User, BookOpen, BarChart2, FileText, Zap, AlertCircle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { useChat } from '@/lib/hooks/useChat';
import AILoadingOverlay from './AILoadingOverlay';
import { checkSessionCache, cacheSessionAnalysis } from '@/lib/ai/sessionCache';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface SessionFormValues {
  studentId: string;
  topic: string;
  score: string;
  obsOfflineClass: string;
  obsOnlineTask: string;
  obsGroupTask: string;
  obsMentorCall: string;
  obsComprehensive: string;
}

const EDUCATIONAL_PILLARS = [
  'Teamwork and Leadership',
  'Digital Hygiene and Privacy Literacy',
  'Emotional Resilience and Mental Well-being',
  'Personal Safety, Consent, and Boundaries',
  'Civic Sense and Social Responsibility',
];

const COMPLEX_PILLARS = [
  'Emotional Resilience and Mental Well-being',
  'Personal Safety, Consent, and Boundaries',
];

const EDUCATOR_PERSONA = `You are an extraordinarily accomplished and empathetic senior educator. You have 60+ years of active experience, are now retired, and are considered a veteran holding profound wisdom in mentorship. You are not a strict disciplinarian, but a guide. Your academic specializations include Educational Psychology, Team Building & Leadership development, Digital and Privacy Literacy (very modern understanding), and crucial aspects of student well-being: Emotional Resilience, Mental Well-being, Personal Safety, Consent, Boundaries, Civic Sense, and Social Responsibility. In your long career, you have conducted seminal research across all these fields, personally taught over 3,000,000 students, and successfully empowered them across these diverse domains.

When given a student session input, you MUST respond with EXACTLY this JSON structure and nothing else:
{
  "strengths": ["item1", "item2", "item3", "item4"],
  "weaknesses": ["item1", "item2", "item3", "item4"],
  "approach": ["item1", "item2", "item3", "item4", "item5"],
  "tasks": ["item1", "item2", "item3", "item4", "item5", "item6"]
}

Each item must be a complete, actionable, and empathetic sentence. Provide 3-5 strengths, 3-5 weaknesses, 4-6 approach strategies, and 4-6 practical tasks. The Task List must contain highly specific, modern, and actionable items derived directly from the five operational observation areas provided.

STRICT RULES FOR TASK LIST GENERATION: All generated tasks MUST be designed for an individual student working alone. Tasks MUST be strictly online or home-based (e.g., watching a video, completing an online exercise, journaling, reading an article, practicing a skill independently at home). Do NOT generate any tasks that require the student to travel outside their home, attend a physical location, or coordinate with physical groups or other people in person. Every task must be completable by a single student using only a device with internet access or materials available at home. Return ONLY the JSON object, no markdown, no explanation.`;

interface StudentOption {
  id: string;
  name: string;
  avatar: string;
  sessions: number;
  avgScore: number;
}

/** Combine all 5 observation fields into a single string for cache key */
function combineObservations(vals: {
  obsOfflineClass: string;
  obsOnlineTask: string;
  obsGroupTask: string;
  obsMentorCall: string;
  obsComprehensive: string;
}): string {
  return [
    vals.obsOfflineClass,
    vals.obsOnlineTask,
    vals.obsGroupTask,
    vals.obsMentorCall,
    vals.obsComprehensive,
  ]
    .filter(Boolean)
    .join(' | ');
}

/** Persist a session to Supabase and return the new session id */
async function saveSessionToSupabase(params: {
  mentorId: string;
  studentId: string;
  topic: string;
  score: string;
  obsOfflineClass: string;
  obsOnlineTask: string;
  obsGroupTask: string;
  obsMentorCall: string;
  obsComprehensive: string;
  model: string;
  sessionDate: string;
  strengths: string[];
  weaknesses: string[];
  approach: string[];
  tasks: string[];
  geminiResponse?: string;
}): Promise<string | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('sessions')
    .insert({
      mentor_id: params.mentorId,
      student_id: params.studentId,
      topic: params.topic,
      score: params.score ? Number(params.score) : null,
      observations: combineObservations(params),
      obs_offline_class: params.obsOfflineClass,
      obs_online_task: params.obsOnlineTask,
      obs_group_task: params.obsGroupTask,
      obs_mentor_call: params.obsMentorCall,
      obs_comprehensive: params.obsComprehensive,
      model: params.model,
      session_date: params.sessionDate,
      strengths: params.strengths,
      weaknesses: params.weaknesses,
      approach: params.approach,
      tasks: params.tasks,
      gemini_response: params.geminiResponse ?? null,
    })
    .select('id')
    .single();

  if (error) {
    console.error('Failed to save session:', error.message);
    return null;
  }
  return data?.id ?? null;
}

const OBS_FIELDS = [
  {
    key: 'obsOfflineClass' as const,
    label: '1. Offline Class Observations',
    placeholder: 'Describe the student\'s engagement, participation, and behavior during in-person classes...',
  },
  {
    key: 'obsOnlineTask' as const,
    label: '2. Online Task Performance',
    placeholder: 'How did the student perform on digital assignments, online quizzes, or virtual tasks?...',
  },
  {
    key: 'obsGroupTask' as const,
    label: '3. Group Task Participation & Dynamics',
    placeholder: 'Describe the student\'s role in group activities — leadership, collaboration, conflict handling...',
  },
  {
    key: 'obsMentorCall' as const,
    label: '4. Mentor Call Notes',
    placeholder: 'Key takeaways from one-on-one mentor calls — emotional state, goals discussed, concerns raised...',
  },
  {
    key: 'obsComprehensive' as const,
    label: '5. Comprehensive Observation',
    placeholder: 'Overall holistic summary — patterns noticed, progress since last session, any alerts or highlights...',
  },
];

export default function NewSessionContent() {
  const router = useRouter();
  const { user } = useAuth();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [cacheHint, setCacheHint] = useState(false);
  const [cacheSimScore, setCacheSimScore] = useState(0);
  const [students, setStudents] = useState<StudentOption[]>([]);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<SessionFormValues>();

  const watchedStudent = watch('studentId');
  const watchedTopic = watch('topic');
  const watchedScore = watch('score', '');
  const watchedObs1 = watch('obsOfflineClass', '');
  const watchedObs2 = watch('obsOnlineTask', '');
  const watchedObs3 = watch('obsGroupTask', '');
  const watchedObs4 = watch('obsMentorCall', '');
  const watchedObs5 = watch('obsComprehensive', '');

  const combinedObs = combineObservations({
    obsOfflineClass: watchedObs1 ?? '',
    obsOnlineTask: watchedObs2 ?? '',
    obsGroupTask: watchedObs3 ?? '',
    obsMentorCall: watchedObs4 ?? '',
    obsComprehensive: watchedObs5 ?? '',
  });

  const selectedStudent = students.find((s) => s.id === watchedStudent) ?? null;

  // Fetch mentor's students from Supabase
  useEffect(() => {
    if (!user) return;
    const supabase = createClient();
    supabase
      .from('students')
      .select('id, name, avatar, sessions, avg_score')
      .eq('mentor_id', user.id)
      .order('name', { ascending: true })
      .then(({ data }) => {
        if (data) {
          setStudents(
            data.map((row) => ({
              id: row.id,
              name: row.name,
              avatar: row.avatar || row.name?.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase(),
              sessions: row.sessions ?? 0,
              avgScore: row.avg_score ?? 0,
            }))
          );
        }
      });
  }, [user]);

  const isComplexPillar = COMPLEX_PILLARS.includes(watchedTopic);
  const model = isComplexPillar ? 'gemini/gemini-2.5-pro' : 'gemini/gemini-2.5-flash';
  const { response, isLoading, error, sendMessage } = useChat('GEMINI', model, false);

  // Show toast on AI error
  useEffect(() => {
    if (error) {
      toast.error(error.message || 'AI analysis failed. Please try again.');
      setIsAnalyzing(false);
    }
  }, [error]);

  // When AI response arrives, parse, save to Supabase, and redirect
  useEffect(() => {
    if (response && isAnalyzing && !isLoading) {
      (async () => {
        try {
          const cleaned = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
          const parsed = JSON.parse(cleaned);

          if (parsed.strengths && parsed.weaknesses && parsed.approach && parsed.tasks) {
            const obsVals = {
              obsOfflineClass: watchedObs1 ?? '',
              obsOnlineTask: watchedObs2 ?? '',
              obsGroupTask: watchedObs3 ?? '',
              obsMentorCall: watchedObs4 ?? '',
              obsComprehensive: watchedObs5 ?? '',
            };

            cacheSessionAnalysis(
              watchedStudent,
              watchedTopic,
              watchedScore ?? '',
              combineObservations(obsVals),
              {
                strengths: parsed.strengths,
                weaknesses: parsed.weaknesses,
                approach: parsed.approach,
                tasks: parsed.tasks,
              }
            );

            const sessionDate = new Date().toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            });
            const modelLabel = isComplexPillar ? 'Gemini Pro' : 'Gemini Flash';

            if (!user) {
              toast.error('You must be logged in to save sessions.');
              setIsAnalyzing(false);
              return;
            }

            const sessionId = await saveSessionToSupabase({
              mentorId: user.id,
              studentId: watchedStudent,
              topic: watchedTopic,
              score: watchedScore ?? '',
              ...obsVals,
              model: modelLabel,
              sessionDate,
              strengths: parsed.strengths,
              weaknesses: parsed.weaknesses,
              approach: parsed.approach,
              tasks: parsed.tasks,
              geminiResponse: response,
            });

            toast.success('Analysis complete! Redirecting to student profile...');
            setIsAnalyzing(false);
            router.push(
              `/student-analysis-history?studentId=${watchedStudent}&newSession=true${sessionId ? `&sessionId=${sessionId}` : ''}`
            );
          } else {
            throw new Error('Incomplete analysis structure');
          }
        } catch {
          toast.error('Could not parse AI response. Please try again.');
          setIsAnalyzing(false);
        }
      })();
    }
  }, [response, isLoading, isAnalyzing]);

  // Check cache similarity whenever inputs change
  useEffect(() => {
    if (watchedStudent && watchedTopic) {
      const result = checkSessionCache(
        watchedStudent,
        watchedTopic,
        watchedScore ?? '',
        combinedObs
      );
      setCacheHint(result.hit);
      setCacheSimScore(result.score);
    } else {
      setCacheHint(false);
      setCacheSimScore(0);
    }
  }, [watchedStudent, watchedTopic, watchedScore, combinedObs]);

  const onSubmit = async (data: SessionFormValues) => {
    setIsAnalyzing(true);

    const obsVals = {
      obsOfflineClass: data.obsOfflineClass,
      obsOnlineTask: data.obsOnlineTask,
      obsGroupTask: data.obsGroupTask,
      obsMentorCall: data.obsMentorCall,
      obsComprehensive: data.obsComprehensive,
    };
    const combinedObsData = combineObservations(obsVals);

    // ── Cache-hit path ─────────────────────────────────────────────────────
    const cacheResult = checkSessionCache(
      data.studentId,
      data.topic,
      data.score ?? '',
      combinedObsData
    );

    if (cacheResult.hit && cacheResult.adaptedAnalysis) {
      const adapted = cacheResult.adaptedAnalysis;
      const sessionDate = new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
      const modelLabel = isComplexPillar ? 'Gemini Pro (Cached)' : 'Gemini Flash (Cached)';

      if (!user) {
        toast.error('You must be logged in to save sessions.');
        setIsAnalyzing(false);
        return;
      }

      const sessionId = await saveSessionToSupabase({
        mentorId: user.id,
        studentId: data.studentId,
        topic: data.topic,
        score: data.score ?? '',
        ...obsVals,
        model: modelLabel,
        sessionDate,
        strengths: adapted.strengths,
        weaknesses: adapted.weaknesses,
        approach: adapted.approach,
        tasks: adapted.tasks,
      });

      toast.success('Similar session found — analysis adapted from cache!');
      setIsAnalyzing(false);
      router.push(
        `/student-analysis-history?studentId=${data.studentId}&newSession=true${sessionId ? `&sessionId=${sessionId}` : ''}`
      );
      return;
    }

    // ── No cache hit: call Gemini ──────────────────────────────────────────
    const scoreText = data.score
      ? `Test Score: ${data.score}/100.`
      : 'No test score provided (observation-only session).';

    const userPrompt = `Student: ${selectedStudent?.name || data.studentId}
Educational Pillar: ${data.topic}
${scoreText}

--- MENTOR OBSERVATIONS (5 Areas) ---

1. Offline Class Observations:
${data.obsOfflineClass || 'Not provided.'}

2. Online Task Performance:
${data.obsOnlineTask || 'Not provided.'}

3. Group Task Participation & Dynamics:
${data.obsGroupTask || 'Not provided.'}

4. Mentor Call Notes:
${data.obsMentorCall || 'Not provided.'}

5. Comprehensive Observation:
${data.obsComprehensive || 'Not provided.'}

---

Please synthesize all five observation areas along with the test score to generate the four-part analysis (Strengths, Weaknesses, Approach Required, Task List). The Task List must contain highly specific, practical action items derived from these modern operational touchpoints.`;

    sendMessage(
      [
        { role: 'system', content: EDUCATOR_PERSONA },
        { role: 'user', content: userPrompt },
      ],
      {
        temperature: 0.7,
        max_tokens: 2048,
        response_format: { type: 'json_object' },
      }
    );
  };

  return (
    <div className="fade-in max-w-2xl mx-auto">
      {isAnalyzing && <AILoadingOverlay topic={watchedTopic} isComplex={isComplexPillar} />}

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-8 h-8 rounded-xl gradient-primary flex items-center justify-center">
            <Sparkles size={16} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>
            {selectedStudent ? `New Session — ${selectedStudent.name}` : 'Start New Session'}
          </h1>
        </div>
        <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
          Enter session details to generate a personalized AI analysis
        </p>
      </div>

      {/* Cache hint */}
      {cacheHint && (
        <div
          className="flex items-start gap-3 p-4 rounded-xl mb-5"
          style={{ background: 'var(--accent-light)', border: '1.5px solid var(--accent)' }}
        >
          <Zap size={16} style={{ color: '#F57F17', flexShrink: 0, marginTop: '2px' }} />
          <div>
            <p className="text-sm font-600" style={{ color: '#F57F17', fontWeight: 600 }}>
              Similar session detected
              {cacheSimScore > 0 && (
                <span className="ml-2 text-xs font-normal" style={{ color: '#F57F17', opacity: 0.8 }}>
                  ({Math.round(cacheSimScore * 100)}% match)
                </span>
              )}
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--foreground)' }}>
              A previous session for this student on <strong>{watchedTopic}</strong> closely matches the current inputs. The cached analysis will be adapted and reused.
            </p>
          </div>
        </div>
      )}

      {/* Complex pillar notice */}
      {isComplexPillar && (
        <div
          className="flex items-start gap-3 p-4 rounded-xl mb-5"
          style={{ background: 'var(--secondary)', border: '1.5px solid var(--primary-light)' }}
        >
          <AlertCircle size={16} style={{ color: 'var(--primary)', flexShrink: 0, marginTop: '2px' }} />
          <div>
            <p className="text-sm font-600" style={{ color: 'var(--primary-dark)', fontWeight: 600 }}>Sensitive pillar selected</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
              This pillar will be routed to the enhanced AI model for deeper, more nuanced guidance. Analysis may take slightly longer.
            </p>
          </div>
        </div>
      )}

      {/* Form card */}
      <div className="rounded-2xl p-6 card-glow" style={{ background: 'var(--card)', border: '1.5px solid var(--border)' }}>
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-6">

          {/* Student selection */}
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <User size={15} style={{ color: 'var(--primary)' }} />
              <label htmlFor="studentId" className="text-sm font-600" style={{ color: 'var(--foreground)', fontWeight: 600 }}>
                Select Student
              </label>
            </div>
            <p className="text-xs mb-2" style={{ color: 'var(--muted-foreground)' }}>
              Choose the student this session is for
            </p>
            <select
              id="studentId"
              className="input-mystic"
              {...register('studentId', { required: 'Please select a student' })}
            >
              <option value="">Choose a student...</option>
              {students.length === 0 ? (
                <option value="" disabled>No students registered yet</option>
              ) : (
                students.map((s) => (
                  <option key={`student-opt-${s.id}`} value={s.id}>
                    {s.name}
                  </option>
                ))
              )}
            </select>
            {errors.studentId && <p className="text-xs mt-1.5" style={{ color: '#C62828' }}>{errors.studentId.message}</p>}

            {selectedStudent && (
              <div
                className="flex items-center gap-3 mt-3 p-3 rounded-xl"
                style={{ background: 'var(--secondary)' }}
              >
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold flex-shrink-0"
                  style={{ background: 'var(--gradient-primary)', color: 'white' }}
                >
                  {selectedStudent.avatar}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-600" style={{ color: 'var(--foreground)', fontWeight: 600 }}>{selectedStudent.name}</p>
                  <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                    {selectedStudent.sessions} prior sessions · Avg score: {selectedStudent.avgScore}%
                  </p>
                </div>
                <CheckCircle2 size={16} style={{ color: '#2E7D32' }} />
              </div>
            )}
          </div>

          {/* Educational Pillar */}
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <BookOpen size={15} style={{ color: 'var(--primary)' }} />
              <label htmlFor="topic" className="text-sm font-600" style={{ color: 'var(--foreground)', fontWeight: 600 }}>
                Educational Pillar
              </label>
            </div>
            <p className="text-xs mb-2" style={{ color: 'var(--muted-foreground)' }}>
              Select the core pillar being assessed in this session
            </p>
            <select
              id="topic"
              className="input-mystic"
              {...register('topic', { required: 'Please select an educational pillar' })}
            >
              <option value="">Select a pillar...</option>
              {EDUCATIONAL_PILLARS.map((t) => (
                <option key={`pillar-opt-${t}`} value={t}>{t}</option>
              ))}
            </select>
            {errors.topic && <p className="text-xs mt-1.5" style={{ color: '#C62828' }}>{errors.topic.message}</p>}
          </div>

          {/* Test Score */}
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <BarChart2 size={15} style={{ color: 'var(--primary)' }} />
              <label htmlFor="score" className="text-sm font-600" style={{ color: 'var(--foreground)', fontWeight: 600 }}>
                Test Score
              </label>
            </div>
            <p className="text-xs mb-2" style={{ color: 'var(--muted-foreground)' }}>
              Enter a numeric score from 0 to 100, or leave blank for observation-only sessions
            </p>
            <div className="flex items-center gap-3">
              <input
                id="score"
                type="number"
                min="0"
                max="100"
                className="input-mystic"
                style={{ maxWidth: '160px' }}
                placeholder="e.g. 76"
                {...register('score', {
                  min: { value: 0, message: 'Score cannot be below 0' },
                  max: { value: 100, message: 'Score cannot exceed 100' },
                  pattern: { value: /^\d+$/, message: 'Enter a whole number' },
                })}
              />
              <span className="text-sm" style={{ color: 'var(--muted-foreground)' }}>out of 100</span>
            </div>
            {errors.score && <p className="text-xs mt-1.5" style={{ color: '#C62828' }}>{errors.score.message}</p>}
          </div>

          {/* 5 Observation Fields */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <FileText size={15} style={{ color: 'var(--primary)' }} />
              <span className="text-sm font-600" style={{ color: 'var(--foreground)', fontWeight: 600 }}>
                Mentor Observations
              </span>
            </div>
            <p className="text-xs mb-4" style={{ color: 'var(--muted-foreground)' }}>
              Fill in the five observation areas below. The AI will synthesize all inputs to generate a comprehensive, targeted analysis.
            </p>
            <div className="flex flex-col gap-5">
              {OBS_FIELDS.map((field) => (
                <div key={field.key}>
                  <label
                    htmlFor={field.key}
                    className="block text-sm font-600 mb-1.5"
                    style={{ color: 'var(--primary-dark)', fontWeight: 600 }}
                  >
                    {field.label}
                  </label>
                  <textarea
                    id={field.key}
                    className="input-mystic resize-none"
                    rows={3}
                    placeholder={field.placeholder}
                    {...register(field.key, {
                      required: field.key === 'obsComprehensive' ?'Comprehensive Observation is required for AI analysis'
                        : false,
                      minLength: field.key === 'obsComprehensive'
                        ? { value: 20, message: 'Please provide at least 20 characters' }
                        : undefined,
                    })}
                  />
                  {errors[field.key] && (
                    <p className="text-xs mt-1" style={{ color: '#C62828' }}>
                      {errors[field.key]?.message}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* AI engine info */}
          <div
            className="flex items-start gap-3 p-4 rounded-xl"
            style={{ background: 'var(--muted)', border: '1.5px dashed var(--border)' }}
          >
            <Sparkles size={15} style={{ color: 'var(--primary)', flexShrink: 0, marginTop: '2px' }} />
            <div>
              <p className="text-xs font-600" style={{ color: 'var(--primary-dark)', fontWeight: 600 }}>
                AI Engine: {isComplexPillar ? 'Gemini Pro (Sensitive Pillar Mode)' : 'Gemini Flash (Standard Mode)'}
              </p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                Analysis will be generated by a veteran educator AI persona with 60+ years of experience across educational psychology, well-being, and social development.
              </p>
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={isAnalyzing || isLoading}
            className="btn-primary w-full flex items-center justify-center gap-2 text-base"
            style={{ height: '50px', fontSize: '15px' }}
          >
            <Sparkles size={17} />
            {isAnalyzing ? 'Generating Analysis...' : 'Submit for AI Analysis'}
          </button>
        </form>
      </div>
    </div>
  );
}