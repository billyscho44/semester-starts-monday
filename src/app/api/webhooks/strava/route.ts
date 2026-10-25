import { NextResponse, after, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { processActivity } from "@/lib/strava";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Strava calls this once when the subscription is created.
export function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const verify = process.env.STRAVA_VERIFY_TOKEN;
  if (sp.get("hub.mode") === "subscribe" && verify && sp.get("hub.verify_token") === verify) {
    return NextResponse.json({ "hub.challenge": sp.get("hub.challenge") });
  }
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

type Event = {
  object_type: string; object_id: number; aspect_type: string; owner_id: number;
  updates?: Record<string, string>;
};

// Strava needs a 200 within two seconds, so the work runs after the response.
export async function POST(req: NextRequest) {
  const ev = (await req.json().catch(() => null)) as Event | null;
  if (!ev) return new NextResponse(null, { status: 200 });
  after(async () => {
    try {
      const admin = createAdminClient();
      const { data: link } = await admin.from("strava_link").select("*").eq("athlete_id", ev.owner_id).maybeSingle();
      if (!link) return; // unknown athlete: ignore
      if (ev.object_type === "athlete" && ev.updates?.authorized === "false") {
        await admin.from("strava_link").delete().eq("user_id", link.user_id);
        return;
      }
      if (ev.object_type !== "activity") return;
      if (ev.aspect_type === "delete") {
        await admin.from("strava_activity").delete().eq("id", ev.object_id);
        return;
      }
      await processActivity(admin, link, ev.object_id);
    } catch (e) {
      console.error("strava webhook failed", e instanceof Error ? e.message : e);
    }
  });
  return new NextResponse(null, { status: 200 });
}
