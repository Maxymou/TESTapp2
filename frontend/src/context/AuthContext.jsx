import { createContext } from 'react';

export const AuthContext = createContext({
  user: null,
  authLoading: true,
  adminMode: false,
  setUser: () => {},
  setAdminMode: () => {},
  refreshCurrentUser: async () => {},
});
