import { useState, useEffect, createContext, useContext, ReactNode, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getCurrentUserProfile, getCurrentUserRole } from '@/lib/user-role';
import { logger } from '@/lib/logger';
import { waitForSession } from '@/lib/session-utils';
import type { UserRole, UserProfile } from '@/lib/supabase-types';
import type { User } from '@supabase/supabase-js';

interface UserRoleContextType {
  user: User | null;
  profile: UserProfile | null;
  role: UserRole;
  loading: boolean;
  refresh: () => Promise<void>;
}

const UserRoleContext = createContext<UserRoleContextType | undefined>(undefined);

export function UserRoleProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [role, setRole] = useState<UserRole>('user');
  const [loading, setLoading] = useState(true);
  const isRefreshingRef = useRef(false);
  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const refresh = async () => {
    // Prevent multiple simultaneous refresh calls
    if (isRefreshingRef.current) {
      logger.debug('UserRole: Refresh already in progress, skipping');
      return;
    }

    isRefreshingRef.current = true;
    
    try {
      logger.debug('UserRole: Refreshing user role');
      
      // Wait a bit for session to be restored from localStorage (especially after refresh)
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        logger.error('UserRole: Error getting session:', sessionError);
        setUser(null);
        setProfile(null);
        setRole('user');
        setLoading(false);
        return;
      }
      
      logger.debug('UserRole: Session', { hasSession: !!session, userId: session?.user?.id });
      setUser(session?.user ?? null);

      if (session?.user) {
        try {
          logger.debug('UserRole: Fetching profile for user', session.user.id);
          const userProfile = await getCurrentUserProfile();
          logger.debug('UserRole: Profile fetched', { hasProfile: !!userProfile, role: userProfile?.role });
          setProfile(userProfile);
          setRole(userProfile?.role || 'user');
        } catch (error) {
          logger.error('UserRole: Error fetching user profile:', error);
          setProfile(null);
          setRole('user');
        }
      } else {
        setProfile(null);
        setRole('user');
      }
    } catch (error) {
      logger.error('UserRole: Error in refresh:', error);
      setUser(null);
      setProfile(null);
      setRole('user');
    } finally {
      setLoading(false);
      isRefreshingRef.current = false;
      logger.debug('UserRole: Refresh complete');
    }
  };

  useEffect(() => {
    let mounted = true;
    
    // Initial refresh - wait for session to be restored from localStorage
    const initialRefresh = async () => {
      // Wait for Supabase to restore session from localStorage (especially after refresh)
      const sessionReady = await waitForSession(1500);
      if (!sessionReady) {
        logger.warn('UserRole: Session not ready after wait, proceeding anyway');
      }
      
      if (mounted) {
        await refresh();
      }
    };
    
    initialRefresh();

    // Set up auth state change listener with debouncing
    let debounceTimeout: NodeJS.Timeout | null = null;
    let hasHandledInitialSession = false;
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      logger.debug('UserRole: Auth state changed', event, { hasSession: !!session });
      
      // Skip INITIAL_SESSION if we already handled it in initialRefresh
      if (event === 'INITIAL_SESSION' && hasHandledInitialSession) {
        logger.debug('UserRole: Skipping duplicate INITIAL_SESSION');
        return;
      }
      
      if (event === 'INITIAL_SESSION') {
        hasHandledInitialSession = true;
      }
      
      // Clear any pending refresh
      if (debounceTimeout) {
        clearTimeout(debounceTimeout);
      }
      
      // Debounce rapid auth state changes (especially INITIAL_SESSION)
      debounceTimeout = setTimeout(async () => {
        if (mounted) {
          // For INITIAL_SESSION, wait a bit more for session to be fully ready
          if (event === 'INITIAL_SESSION') {
            await waitForSession(300);
          }
          await refresh();
        }
      }, event === 'INITIAL_SESSION' ? 200 : 100);
    });

    return () => {
      mounted = false;
      if (debounceTimeout) {
        clearTimeout(debounceTimeout);
      }
      subscription.unsubscribe();
    };
  }, []);

  return (
    <UserRoleContext.Provider value={{ user, profile, role, loading, refresh }}>
      {children}
    </UserRoleContext.Provider>
  );
}

export function useUserRole() {
  const context = useContext(UserRoleContext);
  if (context === undefined) {
    throw new Error('useUserRole must be used within a UserRoleProvider');
  }
  return context;
}
