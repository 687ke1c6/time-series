import { Select as KSelect } from "@kobalte/core/select";
import Check from "lucide-solid/icons/check";
import ChevronDown from "lucide-solid/icons/chevron-down";
import {
  children,
  createSignal,
  For,
  type JSX,
  Match,
  Show,
  Switch,
} from "solid-js";

import { inputClass, NativeSelect } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Value = string | number;
export type SelectOption<T extends Value> = { value: T; label: string };
export type SelectGroup<T extends Value> = {
  label: string;
  options: SelectOption<T>[];
};
type Entry<T extends Value> = SelectOption<T> | SelectGroup<T>;

const isGroup = <T extends Value>(e: Entry<T>): e is SelectGroup<T> =>
  "options" in e;

// Touch devices get the OS picker; a mouse gets the styled listbox.
const coarse = window.matchMedia("(pointer: coarse)");
const [isTouch, setIsTouch] = createSignal(coarse.matches);
coarse.addEventListener("change", (e) => setIsTouch(e.matches));

/**
 * A dropdown: the native <select> on touch devices (so phones open the OS
 * picker), a shadcn-style listbox elsewhere. Options may be grouped.
 * `trigger` replaces the button's content (e.g. an icon), with `triggerClass`
 * styling it; the native select is then stretched invisibly over it.
 */
export function Select<T extends Value>(props: {
  value: T;
  onChange: (value: T) => void;
  options: Entry<T>[];
  id?: string;
  class?: string;
  trigger?: JSX.Element;
  triggerClass?: string;
  title?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
}) {
  // Resolved once: reading `props.trigger` directly would rebuild the JSX.
  const trigger = children(() => props.trigger);
  const flat = () => props.options.flatMap((e) => (isGroup(e) ? e.options : e));
  const selected = () => flat().find((o) => o.value === props.value);
  const aria = () => ({
    "aria-label": props["aria-label"],
    "aria-labelledby": props["aria-labelledby"],
    "aria-describedby": props["aria-describedby"],
  });

  const native = (cls: string) => (
    <NativeSelect
      id={props.id}
      class={cls}
      {...aria()}
      value={String(props.value)}
      onChange={(e) => {
        const option = flat().find(
          (o) => String(o.value) === e.currentTarget.value,
        );
        if (option) props.onChange(option.value);
        // Keep the DOM in step if the caller didn't adopt the new value.
        e.currentTarget.value = String(props.value);
      }}
    >
      <For each={props.options}>
        {(entry) =>
          isGroup(entry) ? (
            <optgroup label={entry.label}>
              <For each={entry.options}>
                {(o) => <option value={String(o.value)}>{o.label}</option>}
              </For>
            </optgroup>
          ) : (
            <option value={String(entry.value)}>{entry.label}</option>
          )
        }
      </For>
    </NativeSelect>
  );

  return (
    <Switch>
      <Match when={isTouch() && !!trigger()}>
        <div
          title={props.title}
          class={cn(
            props.triggerClass,
            "relative focus-within:ring-2 focus-within:ring-ring",
          )}
        >
          {trigger()}
          {native("absolute inset-0 h-full cursor-pointer opacity-0")}
        </div>
      </Match>
      <Match when={isTouch()}>{native(props.class ?? "")}</Match>
      <Match when={!isTouch()}>
        <KSelect<SelectOption<T>, SelectGroup<T>>
          options={props.options}
          optionValue="value"
          optionTextValue="label"
          optionGroupChildren="options"
          value={selected() ?? null}
          onChange={(o) => o && props.onChange(o.value)}
          disallowEmptySelection
          gutter={4}
          // An icon trigger sits at the row's end; open the list leftward.
          placement={trigger() ? "bottom-end" : "bottom-start"}
          itemComponent={(p) => (
            <KSelect.Item
              item={p.item}
              class="relative flex w-full cursor-default items-center gap-2 rounded-sm py-1.5 pr-8 pl-2 text-sm outline-none select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground"
            >
              <KSelect.ItemLabel>{p.item.rawValue.label}</KSelect.ItemLabel>
              <KSelect.ItemIndicator class="absolute right-2 flex size-3.5 items-center justify-center">
                <Check class="size-4" aria-hidden="true" />
              </KSelect.ItemIndicator>
            </KSelect.Item>
          )}
          sectionComponent={(p) => (
            <KSelect.Section class="px-2 pt-2 pb-1 text-xs font-medium text-muted-foreground">
              {p.section.rawValue.label}
            </KSelect.Section>
          )}
        >
          <KSelect.Trigger
            id={props.id}
            title={props.title}
            {...aria()}
            class={cn(
              trigger()
                ? props.triggerClass
                : cn(
                    inputClass,
                    "flex items-center justify-between gap-2 text-left data-[expanded]:border-ring",
                    props.class,
                  ),
            )}
          >
            <Show
              when={trigger()}
              fallback={
                <>
                  <KSelect.Value<SelectOption<T>> class="truncate">
                    {(state) => state.selectedOption()?.label}
                  </KSelect.Value>
                  <KSelect.Icon class="shrink-0 text-muted-foreground">
                    <ChevronDown class="size-4" aria-hidden="true" />
                  </KSelect.Icon>
                </>
              }
            >
              {/* Still a value for the accessible name; the icon shows instead. */}
              <KSelect.Value<SelectOption<T>> class="sr-only">
                {(state) => state.selectedOption()?.label}
              </KSelect.Value>
              {trigger()}
            </Show>
          </KSelect.Trigger>
          <KSelect.Portal>
            <KSelect.Content class="z-50 min-w-(--kb-popper-anchor-width) overflow-hidden rounded-md border bg-background text-foreground shadow-md data-[expanded]:animate-in data-[expanded]:fade-in-0 data-[expanded]:zoom-in-95 data-[closed]:animate-out data-[closed]:fade-out-0 data-[closed]:zoom-out-95">
              <KSelect.Listbox class="max-h-80 overflow-y-auto p-1" />
            </KSelect.Content>
          </KSelect.Portal>
        </KSelect>
      </Match>
    </Switch>
  );
}
