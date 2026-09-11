import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { TIERS, type TierId } from "@/lib/event";
import { submitRsvp, type CapacityMap, type RsvpResult } from "@/lib/rsvp";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const schema = z.object({
  name: z.string().trim().min(2, "Name needs at least two characters").max(80),
  email: z.string().trim().email("Use a real email").max(120),
  affiliation: z.string().max(80).optional(),
  notes: z.string().max(280).optional(),
  tier: z.enum(["signal", "kernel", "core"]),
});

type FormValues = z.infer<typeof schema>;

export function RsvpForm({
  capacity,
  onSubmitted,
}: {
  capacity: CapacityMap | null;
  onSubmitted: () => void;
}) {
  const user = useCurrentUser();
  const [result, setResult] = useState<Extract<RsvpResult, { ok: true }> | null>(
    null,
  );

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      email: "",
      affiliation: "",
      notes: "",
      tier: "signal",
    },
  });

  useEffect(() => {
    if (!user) return;
    if (user.displayName) form.setValue("name", user.displayName);
    if (user.primaryEmail) form.setValue("email", user.primaryEmail);
  }, [user, form]);

  useEffect(() => {
    const onSelect = (e: Event) => {
      const id = (e as CustomEvent<TierId>).detail;
      if (id) form.setValue("tier", id);
    };
    window.addEventListener("summit:select-tier", onSelect);
    return () => window.removeEventListener("summit:select-tier", onSelect);
  }, [form]);

  async function onSubmit(values: FormValues) {
    try {
      const res = await submitRsvp({ data: values });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setResult(res);
      onSubmitted();
      toast.success(
        res.already
          ? "You were already on the list."
          : res.status === "waitlist"
            ? "Waitlist confirmed."
            : "Seat reserved.",
      );
    } catch {
      toast.error("Could not save the RSVP. Try again.");
    }
  }

  if (result) {
    const tier = TIERS.find((t) => t.id === result.tier);
    const wait = result.status === "waitlist";
    return (
      <section id="rsvp" className="scroll-mt-16 border-t border-border py-20 sm:py-28">
        <div className="mx-auto max-w-xl px-4 sm:px-6">
          <div className="rounded-2xl bg-surface p-8 shadow-panel">
            <CheckCircle2 className="size-10 text-success" />
            <h2 className="mt-4 font-display text-3xl font-semibold tracking-tight">
              {result.already
                ? "You're already on the list."
                : wait
                  ? "You're on the waitlist."
                  : "You're on the list."}
            </h2>
            <p className="mt-3 text-muted">
              {wait
                ? `We'll email ${result.email} if a ${tier?.name ?? "seat"} opens. Keep the night free.`
                : `Confirmation is headed to ${result.email}. Bring a photo ID to Vice Park.`}
            </p>
            <dl className="mt-6 grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-subtle">Name</dt>
                <dd className="mt-1 font-medium">{result.name}</dd>
              </div>
              <div>
                <dt className="text-subtle">Tier</dt>
                <dd className="mt-1 font-medium">{tier?.name}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-subtle">Status</dt>
                <dd className="mt-1 font-medium capitalize">{result.status}</dd>
              </div>
            </dl>
            <Button
              className="mt-8"
              variant="outline"
              onClick={() => {
                setResult(null);
                form.reset({
                  name: result.name,
                  email: result.email,
                  affiliation: "",
                  notes: "",
                  tier: result.tier,
                });
              }}
            >
              Submit another
            </Button>
          </div>
        </div>
      </section>
    );
  }

  const selected = form.watch("tier");

  return (
    <section id="rsvp" className="scroll-mt-16 border-t border-border py-20 sm:py-28">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 sm:px-6 lg:grid-cols-[1fr_1.1fr]">
        <header className="max-w-md">
          <p className="font-mono text-xs tracking-widest text-accent uppercase">
            RSVP
          </p>
          <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            Put your name on the kernel.
          </h2>
          <p className="mt-3 text-muted">
            One seat per email. If a tier is gone, we park you on the waitlist
            and write back if a spot opens.
          </p>
        </header>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="space-y-5 rounded-2xl bg-surface p-5 shadow-panel sm:p-8"
          noValidate
        >
          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              label="Name"
              error={form.formState.errors.name?.message}
            >
              <Input
                autoComplete="name"
                placeholder="Your name"
                {...form.register("name")}
              />
            </Field>
            <Field
              label="Email"
              error={form.formState.errors.email?.message}
            >
              <Input
                type="email"
                autoComplete="email"
                placeholder="you@lab.example"
                {...form.register("email")}
              />
            </Field>
          </div>
          <Field label="Affiliation (optional)">
            <Input
              placeholder="Studio, lab, or company"
              {...form.register("affiliation")}
            />
          </Field>
          <fieldset>
            <legend className="mb-3 text-sm font-medium">Ticket</legend>
            <div className="grid gap-2">
              {TIERS.map((tier) => {
                const cap = capacity?.[tier.id];
                const wait = cap?.waitlist ?? tier.seedClaimed >= tier.capacity;
                const remaining =
                  cap?.remaining ?? Math.max(0, tier.capacity - tier.seedClaimed);
                return (
                  <label
                    key={tier.id}
                    className={cn(
                      "flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-3 transition-colors duration-150",
                      selected === tier.id
                        ? "border-accent bg-elevated"
                        : "border-border hover:border-fg/20",
                    )}
                  >
                    <input
                      type="radio"
                      value={tier.id}
                      className="sr-only"
                      {...form.register("tier")}
                    />
                    <span
                      className={cn(
                        "grid size-4 shrink-0 place-items-center rounded-full border",
                        selected === tier.id
                          ? "border-accent"
                          : "border-muted",
                      )}
                      aria-hidden
                    >
                      {selected === tier.id ? (
                        <span className="size-2 rounded-full bg-accent" />
                      ) : null}
                    </span>
                    <span className="flex-1">
                      <span className="block text-sm font-medium">
                        {tier.name}
                      </span>
                      <span className="block text-xs text-muted">
                        {wait
                          ? "Waitlist only"
                          : `${remaining} seats left`}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>
          <Field label="Notes (optional)">
            <Textarea
              placeholder="Access needs, plus-ones, or a question for the kernel."
              {...form.register("notes")}
            />
          </Field>
          <Button
            type="submit"
            size="lg"
            className="w-full"
            disabled={form.formState.isSubmitting}
          >
            {form.formState.isSubmitting ? "Saving…" : "Confirm RSVP"}
          </Button>
        </form>
      </div>
    </section>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {error ? <p className="text-xs text-accent">{error}</p> : null}
    </div>
  );
}
