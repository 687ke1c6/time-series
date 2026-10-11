import {
  getRouteApi,
  Link,
  useNavigate,
  useRouter,
} from "@tanstack/solid-router";

import { updateKind } from "@/api";
import { HomeLink } from "@/App";
import KindSettingsForm from "@/components/KindSettingsForm";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const route = getRouteApi("/kinds/$kindId/settings");

/** Edit one type's settings, then return to its chart. */
export default function KindSettingsPage() {
  const data = route.useLoaderData();
  const kind = () => data().kind;
  const navigate = useNavigate();
  const router = useRouter();

  return (
    <div class="space-y-6">
      <HomeLink />
      <header>
        <p class="text-sm text-muted-foreground">Type settings</p>
        <h1 class="truncate text-2xl font-bold sm:text-3xl">{kind().name}</h1>
      </header>
      <KindSettingsForm
        initial={kind()}
        units={data().units}
        submitLabel="Save"
        pendingLabel="Saving…"
        onSubmit={async (settings) => {
          await updateKind(kind().id, settings);
          // Drop cached route data so pages show the new settings.
          await router.invalidate();
          await navigate({
            to: "/kinds/$kindId",
            params: { kindId: kind().id },
          });
        }}
        secondaryAction={
          <Link
            to="/kinds/$kindId"
            params={{ kindId: kind().id }}
            class={cn(buttonVariants({ variant: "outline" }), "h-11 flex-1")}
          >
            Cancel
          </Link>
        }
      />
    </div>
  );
}
