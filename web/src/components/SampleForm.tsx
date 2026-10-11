import { Link, useNavigate, useRouter } from "@tanstack/solid-router";
import { createSignal, Show } from "solid-js";

import { ApiError, createSample, type Kind } from "@/api";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/** Parses user input like "72.4", "-3", "1,5" or "1e3". Returns null if it isn't a number. */
export function parseValue(text: string): number | null {
  const normalized = text.replace(/\s+/g, "").replace(",", ".");
  if (!/^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(normalized)) return null;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

/** Current local time as a `datetime-local` value (minute precision). */
function localNow(): string {
  const now = new Date();
  now.setSeconds(0, 0);
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);
}

/** Value + time for one sample of `kind`; on save, goes to the kind's chart. */
export default function SampleForm(props: { kind: Kind }) {
  const navigate = useNavigate();
  const router = useRouter();

  const [valueText, setValueText] = createSignal("");
  // null means "Now": the server stamps the time when the sample arrives.
  const [when, setWhen] = createSignal<string | null>(null);

  const [valueError, setValueError] = createSignal<string | null>(null);
  const [whenError, setWhenError] = createSignal<string | null>(null);
  const [submitError, setSubmitError] = createSignal<string | null>(null);
  const [pending, setPending] = createSignal(false);

  async function submit(e: SubmitEvent) {
    e.preventDefault();
    setSubmitError(null);

    const value = parseValue(valueText());
    const whenDate = when() ? new Date(when()!) : null;
    const whenInvalid = !!whenDate && Number.isNaN(whenDate.getTime());

    setValueError(
      value !== null
        ? null
        : valueText().trim()
          ? "That isn't a number."
          : "Enter a value.",
    );
    setWhenError(whenInvalid ? "Pick a valid date and time." : null);
    if (value === null || whenInvalid) return;

    setPending(true);
    try {
      const sample = await createSample({
        kind_id: props.kind.id,
        value,
        ...(whenDate && { recorded_at: whenDate.toISOString() }),
      });
      // Drop cached route data so the chart includes the new sample, which
      // it then confirms and highlights.
      await router.invalidate();
      await navigate({
        to: "/kinds/$kindId",
        params: { kindId: props.kind.id },
        search: { saved: sample.id },
      });
    } catch (err) {
      setSubmitError(
        err instanceof ApiError ? err.message : "Couldn't save the sample.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <form class="space-y-5" novalidate onSubmit={submit}>
      <div class="space-y-2">
        <Label for="value">Value</Label>
        <div
          class={cn(
            "flex h-11 items-center rounded-md border border-input bg-background shadow-xs transition-[color,box-shadow] focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50",
            valueError() && "border-destructive ring-destructive/20",
          )}
        >
          <input
            id="value"
            type="text"
            inputmode="decimal"
            autocomplete="off"
            enterkeyhint="done"
            placeholder="0"
            class="h-full min-w-0 flex-1 bg-transparent px-3 text-lg tabular-nums outline-none placeholder:text-muted-foreground"
            value={valueText()}
            aria-invalid={!!valueError()}
            aria-describedby="value-error"
            onInput={(e) => {
              setValueText(e.currentTarget.value);
              setValueError(null);
            }}
          />
          <Show when={props.kind.unit}>
            {(unit) => (
              <span class="shrink-0 border-l border-input px-3 text-sm text-muted-foreground">
                {unit()}
              </span>
            )}
          </Show>
        </div>
        <FieldError id="value-error" message={valueError()} />
      </div>

      <div class="space-y-2">
        <Label for="when">When</Label>
        <Show
          when={when() !== null}
          fallback={
            <button
              id="when"
              type="button"
              class="flex h-11 w-full items-center justify-between rounded-md border border-input bg-background px-3 text-left text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 md:text-sm"
              onClick={() => setWhen(localNow())}
            >
              <span>Now</span>
              <span class="text-sm text-muted-foreground">Change</span>
            </button>
          }
        >
          <Input
            id="when"
            type="datetime-local"
            value={when()!}
            aria-invalid={!!whenError()}
            aria-describedby="when-error"
            onInput={(e) => {
              setWhen(e.currentTarget.value);
              setWhenError(null);
            }}
          />
          <button
            type="button"
            class="text-sm text-muted-foreground underline underline-offset-4"
            onClick={() => {
              setWhen(null);
              setWhenError(null);
            }}
          >
            Reset to now
          </button>
        </Show>
        <FieldError id="when-error" message={whenError()} />
      </div>

      <div class="space-y-2">
        <Button
          type="submit"
          class="h-12 w-full text-base"
          disabled={pending()}
        >
          {pending() ? "Saving…" : "Save"}
        </Button>
        <FieldError message={submitError()} />
      </div>

      {/* View the chart without saving a sample first. */}
      <Link
        to="/kinds/$kindId"
        params={{ kindId: props.kind.id }}
        class="block text-center text-sm text-muted-foreground underline underline-offset-4"
      >
        View {props.kind.name} chart →
      </Link>
    </form>
  );
}
