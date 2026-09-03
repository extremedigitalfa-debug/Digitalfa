import { createContext, useContext, useEffect, useState } from "react";
import { api, tokenStore } from "./api.js";

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);

  async function login(email, password) {
    const { token, user } = await api.login(email, password);
    tokenStore.set(token);
    setUser(user);
    return user;
  }

  // Set the token without flipping into the app yet (used during signup,
  // so authenticated calls work while we finish the checkout flow).
  function primeToken(token) { tokenStore.set(token); }
  // Finalise auth: token + user are set, app switches to the authed view.
  function authenticate(token, user) { tokenStore.set(token); setUser(user); }
  // Update the in-memory user (e.g., after onboarding) without changing token.
  function updateUser(u) { setUser(u); }

  function logout() {
    tokenStore.clear();
    setUser(null);
  }

  return (
    <AuthCtx.Provider value={{ user, loading, login, logout, primeToken, authenticate, updateUser }}>
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);
