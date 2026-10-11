import { cn } from "@/lib/utils";

/** On/off toggle (a button with role="switch"). Label it via `aria-labelledby` or `aria-label`. */
export function Switch(props: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  id?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
  class?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      id={props.id}
      aria-checked={props.checked}
      aria-label={props["aria-label"]}
      aria-labelledby={props["aria-labelledby"]}
      aria-describedby={props["aria-describedby"]}
      onClick={() => props.onChange(!props.checked)}
      class={cn(
        "inline-flex h-6 w-11 shrink-0 items-center rounded-full border-2 border-transparent transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
        props.checked ? "bg-primary" : "bg-input",
        props.class,
      )}
    >
      <span
        aria-hidden="true"
        class={cn(
          "size-5 rounded-full bg-background shadow-sm transition-transform",
          props.checked ? "translate-x-5" : "translate-x-0",
        )}
      />
    </button>
  );
}
