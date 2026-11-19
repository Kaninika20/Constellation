import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem('campusgraph_user');
    return savedUser ? JSON.parse(savedUser) : null;
  });
  const [token, setToken] = useState(() => localStorage.getItem('campusgraph_token') || null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const verifyUser = async () => {
      const storedToken = localStorage.getItem('campusgraph_token');
      if (storedToken) {
        try {
          const res = await api.get('/auth/me');
          if (res.data?.data) {
            setUser(res.data.data);
            localStorage.setItem('campusgraph_user', JSON.stringify(res.data.data));
          }
        } catch (err) {
          console.warn('[AuthContext] Session expired or server unavailable');
        }
      }
      setLoading(false);
    };

    verifyUser();
  }, []);

  const login = async (email, password) => {
    const response = await api.post('/auth/login', { email, password });
    const { student, token: newToken } = response.data.data;
    setUser(student);
    setToken(newToken);
    localStorage.setItem('campusgraph_token', newToken);
    localStorage.setItem('campusgraph_user', JSON.stringify(student));
    return student;
  };

  const register = async (studentData) => {
    const response = await api.post('/auth/register', studentData);
    const { student, token: newToken } = response.data.data;
    setUser(student);
    setToken(newToken);
    localStorage.setItem('campusgraph_token', newToken);
    localStorage.setItem('campusgraph_user', JSON.stringify(student));
    return student;
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('campusgraph_token');
    localStorage.removeItem('campusgraph_user');
  };

  const updateUser = (updatedStudent) => {
    setUser(prev => {
      const merged = { ...prev, ...updatedStudent };
      localStorage.setItem('campusgraph_user', JSON.stringify(merged));
      return merged;
    });
  };

  // Helper for demo quick-login with seeded users
  const demoLogin = (email = 'aarav.sharma@campus.edu') => {
    return login(email, 'Password123!');
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, updateUser, demoLogin, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

