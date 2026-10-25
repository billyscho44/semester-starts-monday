# Semester Starts Monday: handoff

Read this first, then AGENTS.md (this Next.js version has breaking changes; check `node_modules/next/dist/docs/` before writing code).

## Owner and working rules
- Owner: Billy. Not a coder. Claude writes all code and runs all commands. Windows 11 machine, iPhone with the app on the Home Screen.
- Style: direct, no filler, no praise, no encouragement, practical steps only, state assumptions instead of guessing, do not soften criticism. When a file Billy must edit changes, give the whole file, not snippets.
- Workflow: `main` is the live app (every push auto-deploys to Vercel). Work on `dev`; each push to `dev` builds a Vercel preview URL (find it with Vercel list_deployments, project below). Billy tests the preview, then approves, then fast-forward merge `dev` into `main`.
- The preview and live app share one database. Migrations must be additive only (add tables/columns; never drop or rename).
- Commit trailer: `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` and `Claude-Session: <current session URL>`.
- Build check before every push: `rm -rf .next; npm run build`.

## What the app is
Personal accountability PWA for Billy's iPhone. Plan started Sun Oct 25, 2026 (4 weeks x 7 days, "cardio every day" structure). Tracks health and activity: workouts with check-offs and set logging, weight, Strava rides with heart-rate zone times, a progression engine, and KPIs measured as getting stronger (not raw volume).

## Where things live
- Code: https://github.com/billyscho44/semester-starts-monday (branches `main`, `dev`)
- Live app: https://semester-starts-monday.vercel.app
- Vercel: project prj_xhVVnzY9nXvK2YNV2SSscTov6TCT, team team_iZRYXBFrgxvpGacZLENAtLcJ (Hobby plan). Vercel MCP cannot list env vars (403).
- Supabase project: maubxrmvqsxeixwubsnu (Postgres, RLS on, own-row policies). Migrations in `supabase/migrations/` 0001 to 0008, all applied (0008 = activity_log, activity_set).
- Env vars (set in Vercel by Billy): Supabase URL and keys, SUPABASE_SERVICE_ROLE_KEY, STRAVA client id and secret, STRAVA_VERIFY_TOKEN, optional APP_URL.
- Spec doc: https://claude.ai/artifact/A8WQC1iFVV5aSB8bsEFyoV (Claude Docs id 49ee9296-f621-4aa9-bd66-6f446c31d1a8). Behind the code: does not yet cover the progression engine, effective-load KPIs, exercise guides, or Strava specifics. This file is the more current source.
- Strava app: Billy created it with an orange bike-wheel icon. Webhook callback: `/api/webhooks/strava`.
- Not on Billy's computer. No local copy is needed.

## Stack
Next.js 16 (App Router, Turbopack, `src/proxy.ts` instead of middleware, `PageProps<>` helpers, `after()` for post-response work), Tailwind v4, Supabase, Vercel. Route group `src/app/(app)/` holds Today, Schedule, Progress, History, Settings, day/[date]. Nav tabs: Today, Schedule, Progress, History, Settings. Timezone for "today": America/New_York.

## Decisions and rules (do not change without asking Billy)
- Equipment: Wahoo Kickr Core with stock Zwift workouts. Power is measured (Strava flags device_watts true). Apple Watch gives heart rate.
- Progress means getting stronger: more weight, more reps, longer holds, harder variations, bodyweight work. Volume is not a headline KPI.
- Effective load = body weight x exercise `bw_factor` + added weight. The factor is snapshotted on each check_log set. Factors are editable in Settings. Seeds: standard push-up about 0.69 up, knee push-up about 0.54, incline push-up 0.40, reverse lunge 0.60, chair squat and balance-board squat 0.88 (estimate). Changes under 2% are ignored when comparing sets.
- Progression engine (`src/lib/progression.ts`, RULES): dumbbell step 5 lb, max 30, +2 reps, +5 s holds, hold caps 45/60 s, two "average" sessions in a row means ready to progress, two failed-hard sessions means back off, incline rungs 0.40/0.55/0.70. It only proposes; Billy accepts, edits or dismisses. Accepting updates later plan_items for that exercise.
- Heart-rate zones: resting 53, max 166 (auto-raises if a ride exceeds it). Method is heart-rate reserve by default (bounds 109.5, 132.1, 143.4, 154.7) or percent of max (60/70/80/90). Zone seconds come from the HR stream with a 30 s gap cap. Plan text "Z3 to 142 bpm" and "Z4 from 143" are consistent.
- Exercise how-to popups use free photos (yuhonas/free-exercise-db, Unlicense) in `public/exercises/`, with written cues in `src/lib/exercise-guide.ts`. Some moves have no photo (single-leg RDL, bird dog, figure-4, thoracic extension). Chair squat uses the bodyweight squat photos.
- Strava: OAuth scope activity:read_all; tokens in `strava_link` (RLS on, no policies, service role only). Webhook answers within 2 s and processes in `after()`. Rides match the day's cardio/recovery plan_day, set session status (rank planned/skipped < minimum < partial < done) and auto-check ride steps.
- Feedback loop: Billy's own feedback per session (session_feedback), the app's feedback, and periodic reports.

## Off-plan activity logging (built Oct 25, on `dev`, awaiting Billy's test)
- "Other activity" card on every day (Today and past days): Log an activity with type Walk, Run, Ride, Strength, Other. Cardio entries need minutes (distance optional). Strength entries are one exercise per entry with sets of reps (or seconds) and optional added weight; the bodyweight factor is snapshotted per set (`activity_set.bw_factor`).
- Extra exercises auto-added per user by `ensureExtraExercises` (src/lib/activity.ts): Push-up 0.69, Knee push-up 0.54, Sit-up, Plank (seconds).
- Counts as an active day (streak, active days per week): any entry with sets, any manual cardio of 15+ minutes, or any Strava activity of 15+ minutes (MIN_ACTIVE_MIN in src/lib/activity.ts). Active minutes add manual minutes and unmatched Strava minutes (matched rides are already counted through the plan's checked steps).
- Manual strength sets feed strength sets, effective-volume and the Lifts table (merged by exercise name with plan sets). They do NOT feed the progression engine.
- Plan day badge shows "Swapped" when the plan is planned or skipped but something else was logged (Today, Schedule). History lists activity-only days.
- Progress has a "Totals by exercise" card (last 7 days and block total, plan and logged sets together; push-up variations summed with the split shown).
- Billy records rides, walks and runs on his Watch and imports them into Strava afterward; the Strava app is used live only for the indoor bike. Imported activities carry their original date.
- ActivityCard shows Strava's Relative Effort (`raw->>suffer_score`).
- Not built: editing an entry (delete and re-add), manual walk/run duplicate detection against Strava (Billy logs by hand only what Strava lacks).

## Verified working (Oct 25, 2026)
- Login, Today, check-offs, set logging, ratings, feedback form with injury note, weight entry (204 lb saved), Schedule, History, Progress.
- Strava connect, Sync now, live-update subscription (Settings shows "Live updates: on"), a real Zwift ride arriving with zone minutes, avg and max HR, power, and ride steps auto-checked.
- Status-bar fix on the phone (slight see-through at the top, accepted).

## Not verified yet
- Strava webhook delivery of a NEW ride without pressing Sync now. The first ride arrived, but confirm whether it came via webhook or sync.
- Strava `perceived_exertion`: field exists in the raw JSON but was null for the first ride (Billy had not set it). ActivityCard shows "effort N/10" only if present.
- Progression proposals and the Progress page on real data (very little data exists yet).
- Whether Vercel preview URLs require a Vercel sign-in (first preview built fine for Billy).

## Known gaps and backlog (build order)
1. Step 6: reminders. Push at set times, second reminder, quiet hours, check-ins with reasons.
2. Step 7: Pushover backstop.
3. Step 8: weekly review.
4. Weekly resting-HR entry; CSV export (also the only backup path for the data).
5. Progression: "two skips in a row means step back" is not built.
6. Optional: swap the app's own Home Screen icons (icon-192/512/maskable, apple-touch-icon) to the orange wheel; Billy must delete and re-add the Home Screen shortcut to see it. Ask first.
7. Update the spec doc.
8. Supabase advisor: leaked-password protection is off (dashboard setting, optional).
9. A Hell's Kitchen Golf Supabase project was paused earlier; its state is unverified. The free tier probably allows only two active projects.

## First-ride feedback worth acting on
The first ride (Zwift Flat Route, 18 min, avg HR 133, max 153, 147 W) was planned Z2 to Z3 but averaged at the Z3 floor with 4 min in Z4. The app's own feedback logic should flag rides that run hotter than the plan's zone.
