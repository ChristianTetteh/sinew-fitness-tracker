import { createContext, useCallback, useContext, useEffect, useState } from "react";
import api from "../api";
import { getItem, setItem, removeItem } from "../utils/storage";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const loadUser = useCallback(() => {
    const token = getItem("sinew_token");
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError("");
    api
      .get("/auth/me")
      .then((res) => setUser(res.data.user))
      .catch((err) => {
        // Only a 401 means the token is bad (api.js already clears it). A network error
        // or 5xx must not log the user out; keep the token and offer a retry.
        if (err.response?.status !== 401) {
          setLoadError("Couldn't reach Sinew. Check your connection and try again.");
        }
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  async function login(email, password) {
    const res = await api.post("/auth/login", { email, password });
    setItem("sinew_token", res.data.token);
    setUser(res.data.user);
  }

  async function signup(name, email, password) {
    const res = await api.post("/auth/signup", { name, email, password });
    setItem("sinew_token", res.data.token);
    setUser(res.data.user);
  }

  function logout() {
    removeItem("sinew_token");
    setUser(null);
  }

  function updateUser(patch) {
    setUser((prev) => ({ ...prev, ...patch }));
  }

  return (
    <AuthContext.Provider value={{ user, loading, loadError, retryLoad: loadUser, login, signup, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
