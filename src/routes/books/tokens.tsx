import { createFileRoute } from "@tanstack/react-router";
import { BooksView } from "@/components/desk-views";
export const Route = createFileRoute("/books/tokens")({
  component: Page,
});

function Page() {
  return <BooksView view="tokens" />;
}
