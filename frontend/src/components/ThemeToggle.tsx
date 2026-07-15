import React from "react";
import { useTheme } from "../hooks/useTheme";

const ThemeToggle: React.FC = () => {
  const { theme, toggleTheme } = useTheme();
  return (
    <button
      onClick={toggleTheme}
      title={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
      style={{
        background: "none",
        border: "1px solid var(--border)",
        borderRadius: 8,
        cursor: "pointer",
        fontSize: 15,
        padding: "6px 9px",
        display: "flex",
        alignItems: "center",
        color: "var(--text-2)",
      }}
    >
      {theme === "light" ? "🌙" : "☀️"}
    </button>
  );
};

export default ThemeToggle;
