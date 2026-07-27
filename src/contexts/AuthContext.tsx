import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured, AVATARS_BUCKET } from '../lib/supabase';
import { Profile } from '../types';

interface AuthContextValue {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string, username: string) => Promise<{ error: string | null }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateAvatar: (file: File) => Promise<{ error: string | null }>;
  updateBio: (bio: string) => Promise<{ error: string | null }>;
  sendPasswordResetEmail: (email: string) => Promise<{ error: string | null }>;
  updatePassword: (newPassword: string) => Promise<{ error: string | null }>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function mapProfile(row: any): Profile {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    bio: row.bio || '',
    credits: typeof row.credits === 'number' ? row.credits : 0,
    createdAt: row.created_at,
  };
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    if (!error && data) {
      setProfile(mapProfile(data));
    }
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      if (data.session?.user) {
        loadProfile(data.session.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      if (newSession?.user) {
        loadProfile(newSession.user.id);
      } else {
        setProfile(null);
      }
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const signUp = async (email: string, password: string, username: string) => {
    const cleanUsername = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
    if (!cleanUsername) {
      return { error: 'Please choose a username using letters, numbers, or underscores.' };
    }

    // Check username availability up-front. Without this, a duplicate
    // username would only surface as a unique-constraint failure deep
    // inside the database trigger that creates the profile row — which
    // happens inside the same transaction as account creation, so it comes
    // back as an opaque "Database error saving new user" instead of a
    // clear message. Profiles are publicly readable, so this works even
    // before the person is signed in.
    const { data: existingUsername } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', cleanUsername)
      .maybeSingle();
    if (existingUsername) {
      return { error: 'That username is already taken. Please choose another.' };
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username: cleanUsername } },
    });

    if (error) {
      const message = error.message.toLowerCase();
      if (message.includes('already registered') || message.includes('already exists')) {
        return { error: 'An account with that email already exists. Try signing in instead.' };
      }
      if (message.includes('duplicate') || message.includes('unique')) {
        // Rare race condition: someone else claimed this username between
        // our check above and the signup completing.
        return { error: 'That username was just taken by someone else. Please choose another.' };
      }
      return { error: error.message };
    }

    // Supabase deliberately returns a "success" response with no error for
    // signups against an email that's already registered and confirmed
    // (to avoid leaking which emails exist) — the only signal is an empty
    // identities array.
    if (data?.user && data.user.identities && data.user.identities.length === 0) {
      return { error: 'An account with that email already exists. Try signing in instead.' };
    }

    return { error: null };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    return { error: null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  // Re-fetches the current user's profile row — used after actions that
  // change server-side state we display (e.g. spending or earning credits).
  const refreshProfile = async () => {
    if (user) {
      await loadProfile(user.id);
    }
  };

  // Uploads a new profile photo, points the profile row at it, and cleans
  // up the previous avatar file (best-effort — non-fatal if it fails).
  const updateAvatar = async (file: File): Promise<{ error: string | null }> => {
    if (!user) {
      return { error: 'Please sign in first.' };
    }
    if (!file.type.startsWith('image/')) {
      return { error: 'Please choose a valid image file.' };
    }

    const previousAvatarUrl = profile?.avatarUrl || null;
    const ext = file.name.split('.').pop() || 'jpg';
    const path = `${user.id}/avatar-${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage.from(AVATARS_BUCKET).upload(path, file, {
      upsert: false,
    });
    if (uploadError) {
      return { error: `Upload failed: ${uploadError.message}` };
    }

    const { data: publicUrlData } = supabase.storage.from(AVATARS_BUCKET).getPublicUrl(path);

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ avatar_url: publicUrlData.publicUrl })
      .eq('id', user.id);
    if (updateError) {
      return { error: updateError.message };
    }

    // Best-effort cleanup of the previous avatar file, if it lived in our
    // own avatars bucket (skip default/external avatar URLs).
    if (previousAvatarUrl && previousAvatarUrl.includes(`/${AVATARS_BUCKET}/`)) {
      const previousPath = previousAvatarUrl.split(`/${AVATARS_BUCKET}/`)[1];
      if (previousPath) {
        await supabase.storage.from(AVATARS_BUCKET).remove([previousPath]).catch(() => {});
      }
    }

    await refreshProfile();
    return { error: null };
  };

  // Updates the current user's bio text on their profile row.
  const updateBio = async (bio: string): Promise<{ error: string | null }> => {
    if (!user) {
      return { error: 'Please sign in first.' };
    }
    const { error } = await supabase.from('profiles').update({ bio: bio.trim() }).eq('id', user.id);
    if (error) {
      return { error: error.message };
    }
    await refreshProfile();
    return { error: null };
  };

  // Sends a password-reset email with a link back to /reset-password.
  // Supabase's client automatically establishes a temporary "recovery"
  // session when the person opens that link, which is what lets
  // updatePassword below work once they land on that page.
  const sendPasswordResetEmail = async (email: string): Promise<{ error: string | null }> => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) return { error: error.message };
    return { error: null };
  };

  // Sets a new password for whoever's session is currently active — only
  // meaningful right after following a reset-password email link, which
  // establishes exactly that kind of temporary session.
  const updatePassword = async (newPassword: string): Promise<{ error: string | null }> => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) return { error: error.message };
    return { error: null };
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        session,
        loading,
        signUp,
        signIn,
        signOut,
        refreshProfile,
        updateAvatar,
        updateBio,
        sendPasswordResetEmail,
        updatePassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
