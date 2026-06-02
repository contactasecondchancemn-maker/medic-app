import { useEffect, useReducer, useCallback } from 'react';
import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import { makeRedirectUri } from 'expo-auth-session';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

// Required so the browser tab closes itself after an OAuth redirect on iOS/Android.
WebBrowser.maybeCompleteAuthSession();

// ─── State ────────────────────────────────────────────────────────────────────

type AuthState =
  | { status: 'loading'; session: null; user: null; error: null }
  | { status: 'authenticated'; session: Session; user: User; error: null }
  | { status: 'unauthenticated'; session: null; user: null; error: null }
  | { status: 'error'; session: null; user: null; error: string };

type AuthAction =
  | { type: 'SESSION_LOADED'; session: Session | null }
  | { type: 'SIGNED_OUT' }
  | { type: 'ERROR'; message: string };

function reducer(_: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'SESSION_LOADED':
      if (action.session) {
        return { status: 'authenticated', session: action.session, user: action.session.user, error: null };
      }
      return { status: 'unauthenticated', session: null, user: null, error: null };
    case 'SIGNED_OUT':
      return { status: 'unauthenticated', session: null, user: null, error: null };
    case 'ERROR':
      return { status: 'error', session: null, user: null, error: action.message };
  }
}

const initialState: AuthState = { status: 'loading', session: null, user: null, error: null };

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAuth() {
  const [state, dispatch] = useReducer(reducer, initialState);

  // Restore session on mount and subscribe to auth state changes.
  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (mounted) dispatch({ type: 'SESSION_LOADED', session });
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) dispatch({ type: 'SESSION_LOADED', session });
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // ─── OAuth helper ───────────────────────────────────────────────────────────────────

  const signInWithOAuth = useCallback(async (provider: 'google' | 'apple') => {
    try {
      // Use a universal link on native so Supabase can redirect back to the app.
      const redirectTo = makeRedirectUri({ scheme: 'medic-app' });

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo,
          skipBrowserRedirect: true,
        },
      });

      if (error) {
        dispatch({ type: 'ERROR', message: error.message });
        return;
      }

      // Open the provider's consent screen in an in-app browser.
      const result = await WebBrowser.openAuthSessionAsync(data.url ?? '', redirectTo);

      if (result.type === 'success') {
        // Extract the session from the callback URL that Supabase redirected to.
        const url = new URL(result.url);

        // Supabase puts tokens in the hash fragment on mobile redirects.
        const params = new URLSearchParams(
          url.hash ? url.hash.slice(1) : url.search.slice(1)
        );

        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');

        if (accessToken && refreshToken) {
          const { data: sessionData, error: sessionError } =
            await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });

          if (sessionError) {
            dispatch({ type: 'ERROR', message: sessionError.message });
          } else {
            dispatch({ type: 'SESSION_LOADED', session: sessionData.session });
          }
        }
      }
    } catch (err) {
      dispatch({ type: 'ERROR', message: err instanceof Error ? err.message : 'Sign in failed' });
    }
  }, []);

  const signInWithGoogle = useCallback(() => signInWithOAuth('google'), [signInWithOAuth]);

  // Apple Sign-In is only available on iOS 13+ and macOS; the button should be
  // hidden on Android. Supabase handles the PKCE flow the same way as Google.
  const signInWithApple = useCallback(() => signInWithOAuth('apple'), [signInWithOAuth]);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      dispatch({ type: 'ERROR', message: error.message });
    } else {
      dispatch({ type: 'SIGNED_OUT' });
    }
  }, []);

  return {
    ...state,
    isLoading: state.status === 'loading',
    isAuthenticated: state.status === 'authenticated',
    signInWithGoogle,
    signInWithApple,
    signOut,
  };
}
