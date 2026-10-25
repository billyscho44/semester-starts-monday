import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { zoneBounds } from "@/lib/strava";
import SettingsClient from "@/components/SettingsClient";

export const dynamic = "force-dynamic";

export default async function SettingsPage({ searchParams }: PageProps<"/settings">) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const sp = await searchParams;
  const flash = typeof sp.strava === "string" ? sp.strava : null;

  const { data: s } = await supabase.from("settings").select("max_hr,resting_hr,zone_method").maybeSingle();
  const { count } = await supabase.from("strava_activity").select("id", { count: "exact", head: true });

  let connected: boolean | null = null;
  let lastSync: string | null = null;
  try {
    const admin = createAdminClient();
    const { data: link } = await admin.from("strava_link").select("last_sync_at").eq("user_id", user.id).maybeSingle();
    connected = !!link;
    if (link?.last_sync_at) {
      lastSync = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
        .format(new Date(link.last_sync_at));
    }
  } catch { connected = null; }

  const settings = { max_hr: s?.max_hr ?? 166, resting_hr: s?.resting_hr ?? 53, zone_method: (s?.zone_method ?? "reserve") as "reserve" | "max" };
  return (
    <main className="mx-auto w-full max-w-md px-5 pt-[max(env(safe-area-inset-top),1.5rem)]">
      <h1 className="text-4xl font-semibold tracking-tight">Settings</h1>
      <SettingsClient
        userId={user.id} maxHr={settings.max_hr} restingHr={settings.resting_hr} zoneMethod={settings.zone_method}
        stravaConnected={connected} activityCount={count ?? 0} lastSync={lastSync} stravaFlash={flash} bounds={zoneBounds(settings)}
      />
    </main>
  );
}
