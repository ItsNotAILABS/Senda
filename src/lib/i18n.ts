import { useEffect, useState } from "react";

export type Lang = "en" | "es";

const DICT = {
  en: {
    title: "Global",
    line: "A rail runs only when its key answers. Nothing here is a balance.",
    off: "Not connected",
    on: "Key is set",
  },
  es: {
    title: "Global",
    line: "Un riel responde solo si su clave existe. Nada de esto es un saldo.",
    off: "Sin conexión",
    on: "La clave está puesta",
  },
} as const;

export function readLang(): Lang {
  if (typeof window === "undefined") return "en";
  return window.localStorage.getItem("senda.lang") === "es" ? "es" : "en";
}

export function writeLang(lang: Lang) {
  window.localStorage.setItem("senda.lang", lang);
  window.dispatchEvent(new Event("senda-lang"));
}

export function useLang() {
  const [lang, setLang] = useState<Lang>("en");
  useEffect(() => {
    const pull = () => setLang(readLang());
    pull();
    window.addEventListener("senda-lang", pull);
    return () => window.removeEventListener("senda-lang", pull);
  }, []);
  return { lang, t: DICT[lang], setLang: writeLang };
}
