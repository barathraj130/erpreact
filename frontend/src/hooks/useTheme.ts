import { useEffect, useState } from "react";

type Theme = "light" | "dark";

/**
 * Sets a `data-theme` attribute on <html>, which index.css's
 * `:root[data-theme="dark"]` block uses to override the app's real
 * CSS variables (--bg, --surface, --text-1/2/3, --border, ...).
 */
export const useTheme = () => {
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem("fluxora-theme") as Theme) || "light"
  );

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("fluxora-theme", theme);
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === "light" ? "dark" : "light"));

  return { theme, toggleTheme };
};
