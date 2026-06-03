import { useEffect, useState } from "react";

export function useDarkMode(): "light" | "dark" {
  const [mode, setMode] = useState<"light" | "dark">(() => {
    const saved = localStorage.getItem("theme");
    return saved === "light" ? "light" : "dark";
  });

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setMode(document.documentElement.classList.contains("dark") ? "dark" : "light");
    });

    observer.observe(document.documentElement, { attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  return mode;
}
