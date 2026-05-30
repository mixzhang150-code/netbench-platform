import { create } from 'zustand';

interface User {
  id: string;
  username: string;
  email: string;
  role: 'admin' | 'sponsor' | 'user';
}

interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  token: string | null;
  login: (user: User, token: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: !!localStorage.getItem('netbench_token'),
  user: JSON.parse(localStorage.getItem('netbench_user') || 'null'),
  token: localStorage.getItem('netbench_token'),
  login: (user, token) => {
    localStorage.setItem('netbench_token', token);
    localStorage.setItem('netbench_user', JSON.stringify(user));
    set({ isAuthenticated: true, user, token });
  },
  logout: () => {
    localStorage.removeItem('netbench_token');
    localStorage.removeItem('netbench_user');
    set({ isAuthenticated: false, user: null, token: null });
  },
}));
