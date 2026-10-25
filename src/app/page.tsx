import { createClient } from "@/lib/supabase/server";

const TZ = "America/New_York";

export const dynamic = "force-dynamic";

export default async function TodayPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const dateLabel = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: TZ,
  }).format(new Date());

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 pb-[calc(env(safe-area-inset-bottom)+2rem)] pt-[max(env(safe-area-inset-top),1.5rem)]">
      <p className="text-sm font-medium text-muted">{dateLabel}</p>
      <h1 className="mt-1 text-4xl font-semibold tracking-tight">Today</h1>

      <section className="mt-8 rounded-2xl border border-line bg-card p-5">
        <h2 className="text-base font-semibold">No session planned yet</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-muted">
          Your 4-week plan loads in the next build step. This screen will show
          today&apos;s workout, your 10-minute daily minimum and anything still
          open from your check-in.
        </p>
      </section>

      <footer className="mt-auto pt-10">
        <p className="text-xs text-muted">Signed in as {user?.email}</p>
        <form action="/auth/signout" method="post" className="mt-1">
          <button
            type="submit"
            className="min-h-11 text-sm text-muted underline underline-offset-4"
          >
            Sign out
          </button>
        </form>
      </footer>
    </main>
  );
}
