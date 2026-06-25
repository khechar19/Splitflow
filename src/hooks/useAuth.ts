import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Profile } from '../types';

export function useAuth() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session }, error: err }) => {
      if (err) {
        setError(err.message);
      }
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser) {
        fetchProfile(currentUser.id);
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser) {
        fetchProfile(currentUser.id);
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  async function fetchProfile(userId: string) {
    try {
      setLoading(true);
      setError(null);
      const { data, error: err } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (err) {
        throw err;
      }

      if (!data) {
        // Profile does not exist. Self-heal by inserting a fallback profile row
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (authUser) {
          const fallbackProfile = {
            id: authUser.id,
            full_name: authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || 'User',
            avatar_url: authUser.user_metadata?.avatar_url || `https://ui-avatars.com/api/?name=${authUser.email?.split('@')[0] || 'User'}&background=6366F1&color=fff`,
            currency: 'USD'
          };

          const { data: newProfile, error: insertErr } = await supabase
            .from('profiles')
            .insert(fallbackProfile)
            .select()
            .single();

          if (insertErr) throw insertErr;
          setProfile(newProfile);
        } else {
          setProfile(null);
        }
      } else {
        setProfile(data);
      }
    } catch (err: any) {
      console.error('Error fetching/healing profile:', err.message);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return {
    user,
    profile,
    loading,
    error,
    refreshProfile: () => profile && fetchProfile(profile.id),
  };
}
