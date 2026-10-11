import { createSignal, For, type JSX, Show } from "solid-js";

import { ApiError, type Kind, type KindSettings, type UnitGroup } from "@/api";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label, NativeSelect } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

/**
 * Settings fields (name, unit, forecast) for creating or editing a kind. `onSubmit` does the API
 * call; its error message is shown under the form.
 */
export default function KindSettingsForm(props: {
  initial?: Kind;
  units: UnitGroup[];
  submitLabel: string;
  pendingLabel: string;
  onSubmit: (settings: KindSettings) => Promise<void>;
  /** Rendered beside the submit button, e.g. a Cancel link. */
  secondaryAction?: JSX.Element;
}) {
  const [name, setName] = createSignal(props.initial?.name ?? "");
  const [unit, setUnit] = createSignal(props.initial?.unit ?? "");
  const [forecast, setForecast] = createSignal(
    props.initial?.forecast ?? false,
  );
  const [error, setError] = createSignal<string | null>(null);
  const [pending, setPending] = createSignal(false);

  const unitChanged = () =>
    !!props.initial && (props.initial.unit ?? "") !== unit();

  async function submit(e: SubmitEvent) {
    e.preventDefault();
    if (!name().trim()) {
      setError("Give the type a name.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      await props.onSubmit({
        name: name().trim(),
        unit: unit() || null,
        forecast: forecast(),
      });
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Couldn't save the type.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <form class="space-y-5" novalidate onSubmit={submit}>
      <div class="space-y-2">
        <Label for="kind-name">Name</Label>
        <Input
          id="kind-name"
          placeholder="e.g. Water meter reading"
          autocomplete="off"
          enterkeyhint="done"
          maxlength={100}
          value={name()}
          aria-invalid={!!error()}
          aria-describedby="kind-error"
          onInput={(e) => {
            setName(e.currentTarget.value);
            setError(null);
          }}
        />
      </div>

      <div class="space-y-2">
        <Label for="kind-unit">Unit</Label>
        <NativeSelect
          id="kind-unit"
          value={unit()}
          onChange={(e) => setUnit(e.currentTarget.value)}
        >
          <option value="">No unit</option>
          <For each={props.units}>
            {(group) => (
              <optgroup label={group.group}>
                <For each={group.units}>
                  {(u) => (
                    <option value={u.symbol}>
                      {u.symbol === u.label
                        ? u.symbol
                        : `${u.symbol} — ${u.label}`}
                    </option>
                  )}
                </For>
              </optgroup>
            )}
          </For>
        </NativeSelect>
        <Show when={unitChanged()}>
          <p class="text-sm text-muted-foreground">
            Existing samples keep their numbers; they aren't converted to the
            new unit.
          </p>
        </Show>
      </div>

      <div class="flex items-start justify-between gap-4 rounded-lg border border-border p-3">
        <div class="space-y-1">
          <p id="kind-forecast-label" class="text-sm font-medium leading-none">
            Forecast
          </p>
          <p id="kind-forecast-hint" class="text-sm text-muted-foreground">
            Adds a Forecast switch to the chart that projects the recent trend
            down to zero. Useful for things that run out, like a prepaid meter.
          </p>
        </div>
        <Switch
          checked={forecast()}
          onChange={setForecast}
          aria-labelledby="kind-forecast-label"
          aria-describedby="kind-forecast-hint"
        />
      </div>

      <FieldError id="kind-error" message={error()} />

      <div class="flex gap-2">
        <Button type="submit" class="h-11 flex-1" disabled={pending()}>
          {pending() ? props.pendingLabel : props.submitLabel}
        </Button>
        {props.secondaryAction}
      </div>
    </form>
  );
}
