import { EVENT } from "@/lib/event";

export function SiteFooter() {
  return (
    <footer className="border-t border-border py-12">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 text-sm text-muted sm:flex-row sm:items-end sm:justify-between sm:px-6">
        <div>
          <p className="font-display text-base font-semibold text-fg">
            {EVENT.name} {EVENT.year}
          </p>
          <p className="mt-1">
            A launch night for{" "}
            <a
              href={EVENT.repo}
              className="text-fg underline-offset-4 hover:underline"
              target="_blank"
              rel="noreferrer"
            >
              {EVENT.repoLabel}
            </a>
          </p>
        </div>
        <p>ItsNotAILABS · Dallas</p>
      </div>
    </footer>
  );
}
