// Progression rules. Proposals only: nothing changes the plan until you accept.
// All thresholds live in RULES so they can be tuned in one place.
export const RULES = {
  loadStepLb: 5,          // dumbbells go up 5 lb at a time
  maxDumbbellLb: 30,      // heaviest dumbbell in the set
  repsStep: 2,            // add this many reps per set when easy but below the top of the range
  holdStepS: 5,           // add this many seconds per session when a hold is easy
  holdCapS: 45,           // planks and side planks; carries use carryCapS
  carryCapS: 60,
  averageRunToEasy: 2,    // two "average, finished" results in a row count as easy
  backOffAfterHard: 2,    // two failed + hard results in a row: back off
  inclineRungs: [0.4, 0.55, 0.7], // bench steepness: steep, low, floor
} as const;

export type Rating = "easy" | "average" | "hard";

export type Ctx = {
  name: string;
  sets: number;
  repMin: number | null;
  repMax: number | null;
  hold: boolean;
  perSide: boolean;
  loadText: string;
  bwFactor: number | null;
  done: { reps: number; load: number | null }[]; // sets you checked off
  rating: Rating;
  prev: { rating: Rating; completedAll: boolean }[]; // earlier results, newest first
  pain: boolean;
};

export type Proposal = {
  kind: "reps" | "load" | "hold" | "variation" | "tempo" | "back_off" | "repeat";
  summary: string;
  reason: string;
  newReps?: number;
  newLoad?: number;
  newHold?: number;
  newLoadText?: string;
  newBwFactor?: number;
};

const fmtLoadText = (old: string, load: number): string => {
  if (/\d+(?:\.\d+)?\s*(?:to\s*\d+(?:\.\d+)?\s*)?lb/.test(old)) {
    return old.replace(/\d+(?:\.\d+)?(\s*to\s*\d+(?:\.\d+)?)?(\s*lb)/, `${load}$2`);
  }
  return `${load} lb each hand`;
};

export function propose(c: Ctx): Proposal {
  const completedAll = c.done.length >= c.sets;
  const repeat = (reason: string): Proposal => ({ kind: "repeat", summary: `${c.name}: repeat next time`, reason });
  if (c.done.length === 0) return repeat("No sets logged.");
  if (c.pain) return repeat("You flagged pain this session, so nothing goes up.");

  const prev = c.prev[0];
  let rating = c.rating;
  if (
    rating === "average" && completedAll && c.prev.length >= RULES.averageRunToEasy - 1 &&
    c.prev.slice(0, RULES.averageRunToEasy - 1).every((p) => p.rating === "average" && p.completedAll)
  ) {
    rating = "easy";
  }

  const load = Math.max(0, ...c.done.map((s) => s.load ?? 0));
  const repsDone = c.done.map((s) => s.reps);
  const minDone = Math.min(...repsDone);
  const maxDone = Math.max(...repsDone);

  // Not finished
  if (!completedAll) {
    if (rating === "hard" && prev && !prev.completedAll && prev.rating === "hard") {
      if (load > 0) {
        const newLoad = Math.max(RULES.loadStepLb, load - RULES.loadStepLb);
        return {
          kind: "back_off", newLoad, newLoadText: fmtLoadText(c.loadText, newLoad),
          summary: `${c.name}: drop to ${newLoad} lb`,
          reason: "Hard and unfinished two sessions in a row. Back off one dumbbell size.",
        };
      }
      const lo = c.hold ? Math.max(10, minDone - RULES.holdStepS) : Math.max(1, (c.repMin ?? 6) - 2);
      return {
        kind: "back_off", ...(c.hold ? { newHold: lo } : { newReps: lo }),
        summary: `${c.name}: ${c.hold ? `${lo} s` : `${lo} reps`} per set`,
        reason: "Hard and unfinished two sessions in a row. Lower the target.",
      };
    }
    return repeat(rating === "hard" ? "Unfinished and hard. Repeat once before changing." : "Unfinished. Repeat.");
  }

  if (rating !== "easy") {
    return repeat(rating === "hard" ? "Finished but hard. Repeat." : "Finished at average effort. Repeat; a second average in a row counts as easy.");
  }

  // Finished and easy
  if (c.hold) {
    const cap = /carry/i.test(c.name) ? RULES.carryCapS : RULES.holdCapS;
    if (maxDone >= cap) {
      return {
        kind: "variation", summary: `${c.name}: ready for a harder variation`,
        reason: `Held ${maxDone} s, easy. Tell me when you want the next step in the core ladder.`,
      };
    }
    const next = Math.min(cap, maxDone + RULES.holdStepS);
    return {
      kind: "hold", newHold: next, summary: `${c.name}: hold ${next} s per set`,
      reason: `Held ${maxDone} s and it felt easy. Add ${RULES.holdStepS} s.`,
    };
  }

  const top = c.repMax ?? maxDone;
  const allAtTop = repsDone.every((r) => r >= top);

  if (!allAtTop) {
    const next = Math.min(top, minDone + RULES.repsStep);
    return {
      kind: "reps", newReps: next, summary: `${c.name}: ${next} reps per set${c.perSide ? " per side" : ""}`,
      reason: `Easy, finished, below the top of the range (${c.repMin} to ${c.repMax}). Add reps.`,
    };
  }

  // At the top of the range and easy: move up one step, reps reset to the bottom.
  const resetReps = c.repMin ?? 6;
  if (load > 0) {
    if (load >= RULES.maxDumbbellLb) {
      return repeat(`At ${load} lb, the heaviest dumbbell. Try slower lowering (3 s) or a pause at the bottom.`);
    }
    const next = Math.min(RULES.maxDumbbellLb, load + RULES.loadStepLb);
    return {
      kind: "load", newLoad: next, newReps: resetReps, newLoadText: fmtLoadText(c.loadText, next),
      summary: `${c.name}: ${next} lb, ${resetReps} reps per set`,
      reason: `Easy at the top of the range with ${load} lb. Next dumbbell size, reps reset.`,
    };
  }

  // Bodyweight ladders
  if (/incline push-up/i.test(c.name) && c.bwFactor != null) {
    const next = RULES.inclineRungs.find((r) => r > c.bwFactor! + 0.001);
    if (next != null) {
      return {
        kind: "variation", newBwFactor: next, newReps: resetReps,
        summary: `${c.name}: lower the bench one notch`,
        reason: "Easy at the top of the range. A flatter bench carries more of your body weight; the app updates this move's factor to match.",
      };
    }
    return {
      kind: "tempo", newReps: resetReps, summary: `${c.name}: lower for 3 seconds`,
      reason: "Easy at the flattest bench. Slow the lowering to 3 s before moving to floor push-ups.",
    };
  }
  if (/squat/i.test(c.name)) {
    return {
      kind: "load", newLoad: 10, newReps: resetReps, newLoadText: "10 lb goblet (hold one dumbbell at your chest)",
      summary: `${c.name}: add a 10 lb dumbbell (goblet), ${resetReps} reps`,
      reason: "Easy at the top of the range. Add weight.",
    };
  }
  if (/glute bridge/i.test(c.name)) {
    return {
      kind: "load", newLoad: 10, newReps: resetReps, newLoadText: "10 lb dumbbell on your hips",
      summary: `${c.name}: add a 10 lb dumbbell on your hips, ${resetReps} reps`,
      reason: "Easy at the top of the range. Add weight.",
    };
  }
  if (/lunge|single-leg rdl/i.test(c.name)) {
    return {
      kind: "load", newLoad: 5, newReps: resetReps, newLoadText: "5 lb each hand",
      summary: `${c.name}: add 5 lb in each hand, ${resetReps} reps`,
      reason: "Easy at the top of the range. Add a little weight.",
    };
  }
  if (/decline crunch/i.test(c.name)) {
    return {
      kind: "variation", newReps: resetReps, summary: `${c.name}: steepen the bench a notch`,
      reason: "Easy at the top of the range. A steeper decline is harder. Change the bench, then log the new reps.",
    };
  }
  return {
    kind: "tempo", newReps: resetReps, summary: `${c.name}: lower for 3 seconds, ${resetReps} reps`,
    reason: "Easy at the top of the range. Slow the lowering to 3 s and start the reps over.",
  };
}
