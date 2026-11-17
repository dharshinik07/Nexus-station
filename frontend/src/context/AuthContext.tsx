import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types';
import { apiRequest, setAccessToken, getAccessToken } from '../api/client';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string, totpCode?: string) => Promise<{ require2FA?: boolean }>;
  register: (email: string, password: string, fullName: string) => Promise<void>;
  logout: () => Promise<void>;
  logoutAllDevices: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchCurrentUser = async () => {
    const token = getAccessToken();
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }

    try {
      const res = await apiRequest<{ success: boolean; data: User }>('/auth/me');
      setUser(res.data);
    } catch {
      setAccessToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  const login = async (email: string, password: string, totpCode?: string) => {
    const res = await apiRequest<{
      success: boolean;
      require2FA?: boolean;
      data?: { user: User; accessToken: string };
    }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password, totpCode }),
    });

    if (res.require2FA) {
      return { require2FA: true };
    }

    if (res.data?.accessToken) {
      setAccessToken(res.data.accessToken);
      setUser(res.data.user);
    }

    return { require2FA: false };
  };

  const register = async (email: string, password: string, fullName: string) => {
    const res = await apiRequest<{
      success: boolean;
      data: { user: User; accessToken: string };
    }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, fullName }),
    });

    if (res.data?.accessToken) {
      setAccessToken(res.data.accessToken);
      setUser(res.data.user);
    }
  };

  const logout = async () => {
    try {
      await apiRequest('/auth/logout', { method: 'POST' });
    } catch (e) {
      console.error(e);
    } finally {
      setAccessToken(null);
      setUser(null);
    }
  };

  const logoutAllDevices = async () => {
    try {
      await apiRequest('/auth/logout-all', { method: 'POST' });
    } catch (e) {
      console.error(e);
    } finally {
      setAccessToken(null);
      setUser(null);
    }
  };

  const refreshProfile = async () => {
    await fetchCurrentUser();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        register,
        logout,
        logoutAllDevices,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
