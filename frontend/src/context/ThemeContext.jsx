import { createContext, useContext, useEffect, useState } from "react";
import { getItem, setItem } from "../utils/storage";

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => getItem("sinew_theme") || "dark");

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    setItem("sinew_theme", theme);
  }, [theme]);

  function toggleTheme() {
    setTheme((t) => (t === "dark" ? "light" : "dark"));
  }

  return <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
