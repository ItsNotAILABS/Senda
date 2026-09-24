import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { BooksDesk } from "@/components/books-desk";

export const Route = createFileRoute("/books")({
  component: BooksPage,
});

function BooksPage() {
  return (
    <AppShell>
      <BooksDesk />
    </AppShell>
  );
}
