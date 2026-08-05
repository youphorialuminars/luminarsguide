import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Server-side admin client using service role key — bypasses RLS entirely
function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured');
  }
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { type, ...payload } = body;

    const adminClient = getAdminClient();

    if (type === 'create_mentor') {
      const { email, password, full_name, pillars } = payload;

      // 1. Create auth user via admin API (no session hijack, no email confirmation needed)
      const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name, role: 'mentor' },
      });
      if (authError) throw authError;

      const userId = authData.user.id;

      // 2. Upsert user_profile (admin client bypasses RLS)
      const { error: profileError } = await adminClient
        .from('user_profiles')
        .upsert({
          id: userId,
          email,
          full_name,
          role: 'mentor',
          mentor_pillars: pillars || [],
          student_id: null,
        }, { onConflict: 'id' });
      if (profileError) throw profileError;

      return NextResponse.json({ success: true, userId });
    }

    if (type === 'create_student') {
      const {
        student_name, student_email, student_password,
        student_age, student_gender, grade, primary_topics,
        parent_name, parent_email,
      } = payload;

      // 1. Create auth user via admin API
      const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
        email: student_email,
        password: student_password,
        email_confirm: true,
        user_metadata: { full_name: student_name, role: 'student_parent' },
      });
      if (authError) throw authError;

      const userId = authData.user.id;

      // 2. Upsert user_profile
      const { error: profileError } = await adminClient
        .from('user_profiles')
        .upsert({
          id: userId,
          email: student_email,
          full_name: student_name,
          role: 'student_parent',
          mentor_pillars: [],
          student_id: null,
        }, { onConflict: 'id' });
      if (profileError) throw profileError;

      // 3. Create student record
      const avatar = student_name
        .split(' ')
        .map((w: string) => w[0])
        .join('')
        .slice(0, 2)
        .toUpperCase();

      const topicsArray: string[] = Array.isArray(primary_topics)
        ? primary_topics
        : primary_topics
        ? [primary_topics]
        : [];

      const { data: stuData, error: stuError } = await adminClient
        .from('students')
        .insert({
          name: student_name,
          student_code: `STU-${Date.now().toString().slice(-6)}`,
          grade: grade || 'Grade 6',
          primary_topic: topicsArray[0] || '',
          age: student_age ? Number(student_age) : null,
          gender: student_gender || '',
          parent_name: parent_name || '',
          parent_email: parent_email || '',
          student_email,
          student_user_id: userId,
          avatar,
          avg_score: 0,
          sessions: 0,
          topics: topicsArray,
          trend: 'stable',
          alert_level: null,
          last_session: null,
        })
        .select('id')
        .single();
      if (stuError) throw stuError;

      // 4. Link student_id back to user_profile
      const { error: linkError } = await adminClient
        .from('user_profiles')
        .update({ student_id: stuData.id })
        .eq('id', userId);
      if (linkError) throw linkError;

      return NextResponse.json({ success: true, userId, studentId: stuData.id });
    }

    return NextResponse.json({ error: 'Unknown type' }, { status: 400 });
  } catch (err: any) {
    console.error('[admin/create-user]', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
