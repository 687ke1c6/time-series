import { cn } from "@/lib/utils";

/** A pulsing placeholder block, sized by `class`. */
export function Skeleton(props: { class?: string }) {
  return (
    <div
      aria-hidden="true"
      class={cn("animate-pulse rounded-md bg-muted", props.class)}
    />
  );
}
