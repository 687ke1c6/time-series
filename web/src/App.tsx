import {
  type ErrorComponentProps,
  Link,
  Outlet,
  useRouter,
} from "@tanstack/solid-router";
import ArrowLeft from "lucide-solid/icons/arrow-left";

/** Root layout. Each page renders its own header. */
export default function App() {
  return (
    <main class="mx-auto max-w-md space-y-6 px-4 py-6 sm:max-w-2xl sm:py-10">
      <Outlet />
    </main>
  );
}

/** "← All types", back to the landing page. */
export function HomeLink() {
  return (
    <Link
      to="/"
      class="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft class="size-4" aria-hidden="true" />
      All types
    </Link>
  );
}

export function NotFound() {
  return (
    <div class="space-y-3">
      <h1 class="text-2xl font-bold sm:text-3xl">Not found</h1>
      <p>That page doesn't exist.</p>
      <HomeLink />
    </div>
  );
}

export function KindNotFound() {
  return (
    <div class="space-y-3">
      <h1 class="text-2xl font-bold sm:text-3xl">Not found</h1>
      <p>That type doesn't exist.</p>
      <HomeLink />
    </div>
  );
}

/** Shown when a route's loader fails, e.g. the server is unreachable. */
export function ErrorPage(props: ErrorComponentProps) {
  const router = useRouter();
  return (
    <div class="space-y-3">
      <h1 class="text-2xl font-bold sm:text-3xl">Something went wrong</h1>
      <p role="alert" class="text-sm text-destructive">
        {props.error instanceof Error
          ? props.error.message
          : String(props.error)}
      </p>
      <div class="flex items-center gap-4">
        <button
          type="button"
          class="text-sm underline underline-offset-4"
          onClick={() => void router.invalidate()}
        >
          Try again
        </button>
        <HomeLink />
      </div>
    </div>
  );
}
