import { useLang, type Lang } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function LanguageSwitch() {
  const { lang, setLang } = useLang();
  return (
    <div className="flex gap-1">
      {(["en", "es"] as const).map((id) => (
        <button
          key={id}
          type="button"
          onClick={() => setLang(id as Lang)}
          className={cn("min-h-9 rounded-full px-3 text-xs font-semibold uppercase", lang === id ? "bg-white text-black" : "bg-white/10 text-white/70")}
        >
          {id}
        </button>
      ))}
    </div>
  );
}
