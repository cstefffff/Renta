"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Bara Centrală de Căutare (`components/layout/SearchBar.tsx` — Client Component).
 *
 * Explicație pentru dezvoltatori C / Java:
 * - Gândește-te la `useRef<HTMLInputElement>(null)` ca la un pointer direct către
 *   elementul DOM `<input>` din browser.
 * - Prin `useEffect`, înregistrăm un `EventListener` global pe `window` pentru
 *   scurtătura de tastatură `Ctrl + K` (Windows/Linux) sau `⌘ + K` (macOS),
 *   care mută focusul direct în caseta de căutare fără să mai folosești mouse-ul.
 */
export function SearchBar() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [shortcutLabel, setShortcutLabel] = useState<string>("Ctrl K");

  useEffect(() => {
    // Detectăm dacă utilizatorul folosește macOS pentru a afișa simbolul `⌘ K`
    if (
      typeof navigator !== "undefined" &&
      /Mac|iPod|iPhone|iPad/i.test(navigator.platform || navigator.userAgent)
    ) {
      setShortcutLabel("⌘ K");
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return (
    <form
      action="/catalog"
      method="GET"
      className="hidden md:flex items-center w-full max-w-md bg-slate-100/90 hover:bg-slate-100 focus-within:bg-white focus-within:ring-2 focus-within:ring-ochre/20 border border-transparent focus-within:border-ochre rounded-full px-4 py-2 transition-all"
    >
      <svg
        className="w-4 h-4 text-ink-muted shrink-0 mr-2.5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
      <input
        ref={inputRef}
        type="search"
        name="q"
        placeholder="Caută echipamente, unelte, #OBJ..."
        aria-label="Caută produse în catalog"
        className="w-full bg-transparent text-sm text-ink placeholder:text-ink-muted focus:outline-none"
      />
      <kbd className="hidden lg:inline-flex items-center gap-0.5 px-2 py-0.5 text-[11px] font-mono font-medium text-ink-muted bg-white border border-slate-200 rounded-md shadow-2xs shrink-0">
        {shortcutLabel}
      </kbd>
    </form>
  );
}
