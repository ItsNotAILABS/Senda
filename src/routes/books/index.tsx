import { createFileRoute } from "@tanstack/react-router";
import { BooksView } from "@/components/desk-views";
export const Route = createFileRoute("/books/")({
  component: Page,
});

function Page() {
  return <BooksView view="journal" />;
}
