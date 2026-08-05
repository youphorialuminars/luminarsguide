'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

const AuthContext = createContext<any>({});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<any>(null);
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);
  const supabase = createClient();

  const fetchUserRole = async (userId: string) => {
    try {
      const { data } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', userId)
        .single();
      return data?.role || 'mentor';
    } catch {
      return 'mentor';
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        const role = await fetchUserRole(session.user.id);
        setUserRole(role);
      }
      setLoading(false);
    });

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        const role = await fetchUserRole(session.user.id);
        setUserRole(role);
      } else {
        setUserRole(null);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, metadata: any = {}) => {
    const role = metadata?.role || 'mentor';

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: metadata?.fullName || '',
          role,
        },
      },
    });
    if (error) throw error;
    return data;
  };

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    if (error) throw error;
    if (data.user) {
      const role = await fetchUserRole(data.user.id);
      setUserRole(role);
    }
    return data;
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setUserRole(null);
  };

  const getCurrentUser = async () => {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) throw error;
    return user;
  };

  const isEmailVerified = () => {
    return user?.email_confirmed_at !== null;
  };

  const getUserProfile = async () => {
    if (!user) return null;
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', user.id)
      .single();
    if (error) throw error;
    return data;
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback?next=/sign-up-login-screen`,
    });
    if (error) throw error;
  };

  const value = {
    user,
    session,
    loading,
    userRole,
    signUp,
    signIn,
    signOut,
    getCurrentUser,
    isEmailVerified,
    getUserProfile,
    resetPassword,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
