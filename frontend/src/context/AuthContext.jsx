import { createContext, useState, useEffect } from "react";

export const AuthContext = createContext();

// helper: decode JWT and check if expired
const isTokenExpired = (token) => {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.exp * 1000 < Date.now();
  } catch {
    return true; // treat malformed tokens as expired
  }
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedUser = localStorage.getItem("user");
    const savedToken = localStorage.getItem("token");

    if (savedUser && savedToken && !isTokenExpired(savedToken)) {
      setUser(JSON.parse(savedUser));
      setToken(savedToken);
    } else {
      // token is missing or expired — clear everything
      localStorage.removeItem("user");
      localStorage.removeItem("token");
    }

    setLoading(false);
  }, []);

  // check every 60 seconds while the app is open
  useEffect(() => {
    if (!token) return;

    const interval = setInterval(() => {
      if (isTokenExpired(token)) {
        logoutUser();
      }
    }, 60_000);

    return () => clearInterval(interval);
  }, [token]);

  const loginUser = (userData, userToken) => {
    setUser(userData);
    setToken(userToken);
    localStorage.setItem("user", JSON.stringify(userData));
    localStorage.setItem("token", userToken);
  };

  const logoutUser = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem("user");
    localStorage.removeItem("token");
  };

  return (
    <AuthContext.Provider value={{ user, token, loginUser, logoutUser, loading }}>
      {children}
    </AuthContext.Provider>
  );
};