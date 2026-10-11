import type { ComponentProps } from "solid-js";
import { splitProps } from "solid-js";

import { cn } from "@/lib/utils";

// text-base (16px) on phones stops iOS Safari zooming in on focus.
export const inputClass =
  "h-11 w-full min-w-0 rounded-md border border-input bg-background px-3 text-base shadow-xs outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 md:text-sm";

export function Input(props: ComponentProps<"input">) {
  const [local, others] = splitProps(props, ["class"]);
  return <input class={cn(inputClass, local.class)} {...others} />;
}

/** Native <select>, so phones open the OS picker. */
export function NativeSelect(props: ComponentProps<"select">) {
  const [local, others] = splitProps(props, ["class"]);
  return (
    <select
      class={cn(inputClass, "appearance-auto pr-2", local.class)}
      {...others}
    />
  );
}

export function Label(props: ComponentProps<"label">) {
  const [local, others] = splitProps(props, ["class"]);
  return (
    <label
      class={cn("text-sm font-medium leading-none", local.class)}
      {...others}
    />
  );
}

export function FieldError(props: { id?: string; message?: string | null }) {
  return (
    <p
      id={props.id}
      role="alert"
      class="text-sm text-destructive"
      hidden={!props.message}
    >
      {props.message}
    </p>
  );
}
