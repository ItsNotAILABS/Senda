import { createFileRoute } from "@tanstack/react-router";
import { BorrowPage } from "@/components/trade-pages";
export const Route = createFileRoute("/invest/borrow")({
  component: Page,
});

function Page() {
  return <BorrowPage />;
}
