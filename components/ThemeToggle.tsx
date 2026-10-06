"use client";
import { useEffect, useState } from "react";
import { SunMoon } from "lucide-react";
export default function ThemeToggle() {
  const [light, setLight] = useState(false);
  useEffect(() => {
    try {
      const next = localStorage.getItem("rifatrack-theme") === "light";
      document.documentElement.classList.toggle("theme-light", next);
      setLight(next);
    } catch {}
  }, []);
  return (
    <button
      type="button"
      className="ui-button ui-button-secondary"
      aria-label={light ? "Ativar tema escuro" : "Ativar tema claro"}
      aria-pressed={light}
      onClick={() => {
        document.documentElement.classList.toggle("theme-light", !light);
        setLight(!light);
        try {
          localStorage.setItem("rifatrack-theme", !light ? "light" : "dark");
        } catch {}
      }}
    >
      <SunMoon size={18} aria-hidden="true" />
      <span className="sr-only">Alternar tema</span>
    </button>
  );
}
