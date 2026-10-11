import {
  getRouteApi,
  Link,
  useNavigate,
  useRouter,
} from "@tanstack/solid-router";

import { createKind } from "@/api";
import KindSettingsForm from "@/components/KindSettingsForm";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const route = getRouteApi("/kinds/new");

/** Create a type, then go straight to adding its first sample. */
export default function NewKindPage() {
  const data = route.useLoaderData();
  const navigate = useNavigate();
  const router = useRouter();

  return (
    <div class="space-y-6">
      <header>
        <h1 class="text-2xl font-bold sm:text-3xl">New type</h1>
        <p class="mt-1 text-sm text-muted-foreground">
          What are you measuring? You can change these settings later.
        </p>
      </header>
      <KindSettingsForm
        units={data().units}
        submitLabel="Add type"
        pendingLabel="Adding…"
        onSubmit={async (settings) => {
          // An existing name (any case) returns that type instead of failing.
          const kind = await createKind(settings);
          // Drop cached route data so the landing page lists the new type.
          await router.invalidate();
          await navigate({
            to: "/kinds/$kindId/samples/new",
            params: { kindId: kind.id },
          });
        }}
        secondaryAction={
          <Link
            to="/"
            class={cn(buttonVariants({ variant: "outline" }), "h-11 flex-1")}
          >
            Cancel
          </Link>
        }
      />
    </div>
  );
}
