export type Guide = {
  title: string;
  /** Lower-case phrases that identify this move inside a step note (core stations). */
  aliases?: string[];
  setup: string;
  move: string;
  watch: string;
  /** Folder names under /exercises/ (free-exercise-db stills, public domain). */
  photo?: string;
  /** Short note when the photo shows a different version of the move. */
  photoNote?: string;
};

const G: Record<string, Guide> = {
  "Chair squat": {
    title: "Chair squat",
    setup: "Stand in front of a chair, feet shoulder width apart, toes slightly out. Reach your arms forward.",
    move: "Sit back and down until you lightly touch the seat, then push the floor away to stand. Lower for 3 seconds when it gets easy.",
    watch: "Knees caving inward. Do not drop onto the chair; if you do, slow the lowering.",
    photo: "Bodyweight_Squat",
    photoNote: "The photo shows a squat without a chair; the chair sits behind you as a depth guide.",
  },
  "DB Romanian deadlift": {
    title: "DB Romanian deadlift",
    setup: "Stand tall with a dumbbell in each hand in front of your thighs. Soft knees.",
    move: "Push your hips back and slide the weights down your thighs until you feel a hamstring stretch, around knee height. Drive the hips forward to stand.",
    watch: "Rounding the lower back. Stop the lowering where your back starts to flatten out of position.",
    photo: "Stiff-Legged_Dumbbell_Deadlift",
    photoNote: "The photo shows a straighter-leg version; keep a soft knee.",
  },
  "Reverse lunge, hand on chair": {
    title: "Reverse lunge, hand on chair",
    setup: "Stand beside a chair with one hand on the back for balance.",
    move: "Step one foot back and lower the back knee toward the floor. Push through the front foot to return.",
    watch: "Front knee drifting inward, front heel lifting. Take a shorter step if unsteady.",
    photo: "Dumbbell_Rear_Lunge",
    photoNote: "The photo holds dumbbells; you use bodyweight and a chair.",
  },
  "Glute bridge": {
    title: "Glute bridge",
    setup: "Lie on your back, knees bent, feet flat and hip width apart.",
    move: "Push through your heels and lift your hips until your body is straight from knees to shoulders. Squeeze the glutes, then lower slowly.",
    watch: "Arching the lower back at the top. Keep your ribs down.",
    photo: "Butt_Lift_Bridge",
  },
  "Dead bug": {
    title: "Dead bug",
    aliases: ["dead bug"],
    setup: "Lie on your back, arms pointing at the ceiling, hips and knees bent to 90 degrees.",
    move: "Slowly lower the opposite arm and leg toward the floor while pressing your lower back flat. Return and switch sides.",
    watch: "Lower back lifting off the floor. If it does, shorten the range.",
    photo: "Dead_Bug",
  },
  "Side plank, knees down": {
    title: "Side plank, knees down",
    aliases: ["side plank"],
    setup: "Lie on your side, forearm under your shoulder, knees bent.",
    move: "Lift your hips until shoulders, hips and knees form a line. Hold, breathing steadily.",
    watch: "Hips sagging or rolling forward or back.",
    photo: "Side_Bridge",
    photoNote: "The photo shows the start position; lift the hips up from here.",
  },
  "Flat bench DB press": {
    title: "Flat bench DB press",
    setup: "Lie on the flat bench, feet on the floor, dumbbells above your chest.",
    move: "Lower to chest level with elbows about 45 degrees from your body, then press up. Take 2 to 3 seconds to lower.",
    watch: "Elbows flared straight out, bouncing at the bottom. Choose a weight you can control.",
    photo: "Dumbbell_Bench_Press",
  },
  "One-arm DB row, hand on bench": {
    title: "One-arm DB row, hand on bench",
    setup: "Place one hand on the bench, back flat, other arm hanging with a dumbbell.",
    move: "Pull the dumbbell toward your hip, elbow close to your side. Lower slowly.",
    watch: "Twisting the torso or shrugging. Pull with the elbow, not the wrist.",
    photo: "One-Arm_Dumbbell_Row",
  },
  "Incline DB press, bench near 30°": {
    title: "Incline DB press",
    setup: "Set the bench near 30 degrees. Dumbbells at shoulder height, back against the pad.",
    move: "Press up and slightly together, then lower slowly to the start.",
    watch: "Arching your back off the bench. Keep wrists stacked over elbows.",
    photo: "Incline_Dumbbell_Press",
  },
  "Band pull-apart": {
    title: "Band pull-apart",
    setup: "Hold a band at chest height with straight arms, hands shoulder width apart.",
    move: "Pull the band apart by squeezing your shoulder blades until your arms form a T. Return slowly.",
    watch: "Shrugging, ribs flaring out.",
    photo: "Band_Pull_Apart",
  },
  "Seated DB shoulder press, bench near 72°": {
    title: "Seated DB shoulder press",
    setup: "Set the bench near upright (72 degrees). Dumbbells at shoulder height, palms forward, back supported.",
    move: "Press overhead, then lower to ear level with control.",
    watch: "Arching the lower back. If it arches, use lighter weights.",
    photo: "Dumbbell_Shoulder_Press",
  },
  "Incline plank on bench": {
    title: "Incline plank on bench",
    setup: "Forearms or hands on the bench, body in a straight line from head to heels. A steeper bench is easier.",
    move: "Hold, squeezing your glutes and keeping your ribs down. Breathe.",
    watch: "Hips sagging or piking up.",
    photo: "Plank",
    photoNote: "The photo shows a floor plank; yours is on the bench.",
  },
  "Band Pallof press": {
    title: "Band Pallof press",
    setup: "Anchor a band at chest height. Stand sideways to it, holding the band at your chest.",
    move: "Press the band straight out, hold a second, and return. Resist the band's pull to rotate you.",
    watch: "Torso twisting toward the anchor. Stay square.",
    photo: "Pallof_Press",
    photoNote: "The photo uses a cable machine; your band does the same job.",
  },
  "Incline push-up on bench": {
    title: "Incline push-up on bench",
    setup: "Hands on the bench, shoulder width, body in a straight line. Lower the bench as it gets easier.",
    move: "Lower your chest toward the bench with elbows about 45 degrees, then press up.",
    watch: "Hips sagging, elbows flaring.",
    photo: "Incline_Push-Up",
  },
  "Band row or pulldown": {
    title: "Band row or pulldown",
    setup: "Anchor the band in front of you (row) or above you (pulldown). Sit or stand tall.",
    move: "Pull to your ribs (row) or to your chest (pulldown), squeezing your shoulder blades. Return slowly.",
    watch: "Shrugging and leaning back.",
    photo: "Seated_Cable_Rows",
    photoNote: "The photo uses a cable machine; your band does the same job.",
  },
  "Balance board squat": {
    title: "Balance board squat",
    setup: "Stand on the board, feet shoulder width apart, one hand on a wall or chair.",
    move: "Squat a short way down with control, then stand. Keep the board level.",
    watch: "Rocking onto the edges. Make the squat shallower.",
    photo: "Balance_Board",
  },
  "Single-leg RDL, hand on chair": {
    title: "Single-leg RDL, hand on chair",
    setup: "One hand on a chair back. Stand on one leg with a soft knee.",
    move: "Hinge your hips back as the free leg extends behind you, then return upright.",
    watch: "Opening your hips toward the side, rounding the back. A small range is fine.",
  },
  "Decline crunch, bench near -15°": {
    title: "Decline crunch",
    setup: "Lie on the bench set near -15 degrees, feet higher than your head, arms crossed on your chest.",
    move: "Curl your shoulders up, then lower slowly.",
    watch: "Pulling on your neck or swinging. Stop if your back hurts.",
    photo: "Decline_Crunch",
  },
  "Farmer carry": {
    title: "Farmer carry",
    setup: "Dumbbells at your sides, standing tall.",
    move: "Walk with small steady steps for the time given.",
    watch: "Leaning or shrugging. Keep shoulders back and down.",
    photo: "Farmers_Walk",
  },
  "Bird dog": {
    title: "Bird dog",
    aliases: ["bird dog"],
    setup: "Hands under shoulders, knees under hips.",
    move: "Extend the opposite arm and leg until level with your torso. Hold 2 seconds, then return and switch.",
    watch: "Arching the lower back or twisting the hips.",
  },
  "Forearm plank on knees": {
    title: "Forearm plank on knees",
    aliases: ["forearm plank"],
    setup: "Forearms on the floor, knees down, hips in line with shoulders and knees.",
    move: "Hold, squeezing your abs and glutes. Breathe.",
    watch: "Hips sagging, holding your breath.",
    photo: "Plank",
    photoNote: "The photo shows the toes-down version; yours is on the knees.",
  },
  "Balance board hold": {
    title: "Balance board hold near a wall",
    aliases: ["balance board hold"],
    setup: "Stand on the board, feet shoulder width, fingertips on a wall.",
    move: "Level the board and hold for the time given.",
    watch: "Locked knees; look ahead, not down.",
    photo: "Balance_Board",
  },
  // Flexibility moves
  "Hip flexor lunge": {
    title: "Hip flexor lunge",
    setup: "Half kneeling, back knee on a cushion, front foot flat.",
    move: "Tuck your pelvis under and shift forward until you feel the front of the back hip stretch.",
    watch: "Arching the lower back.",
    photo: "Kneeling_Hip_Flexor",
  },
  "Seated hamstring on a chair": {
    title: "Seated hamstring on a chair",
    setup: "Sit at the edge of a chair, one leg extended, heel on the floor, toes up.",
    move: "Hinge forward from the hips with a flat back until a mild stretch shows up behind the thigh.",
    watch: "Rounding the back; a mild stretch is enough.",
    photo: "Hamstring_Stretch",
  },
  "Figure-4 glute on a chair": {
    title: "Figure-4 glute on a chair",
    setup: "Sit tall, rest one ankle on the opposite knee.",
    move: "Hinge forward until the glute of the crossed leg stretches.",
    watch: "Pain in the knee. If it hurts, stop.",
  },
  "Thoracic extension over the bench": {
    title: "Thoracic extension over the bench",
    setup: "Kneel in front of the bench with your elbows on it.",
    move: "Sink your chest toward the floor, keeping your hips over your knees.",
    watch: "Pinching in the shoulders; back sagging. Reduce the range.",
  },
  "Cat-cow": {
    title: "Cat-cow",
    setup: "On hands and knees.",
    move: "Round your back up while exhaling, then drop the belly and lift your chest while inhaling. Move slowly.",
    watch: "Rushing the movement.",
    photo: "Cat_Stretch",
  },
  "Child's pose": {
    title: "Child's pose",
    setup: "Kneel, then sit back toward your heels.",
    move: "Reach your arms forward and rest your forehead down.",
    watch: "Knee discomfort. Place a pillow between hips and heels.",
    photo: "Childs_Pose",
  },
  "Wall calf stretch": {
    title: "Wall calf stretch",
    setup: "Hands on a wall, one leg back with the heel down.",
    move: "Lean forward until the calf of the back leg stretches. Keep the back knee straight.",
    watch: "Back heel lifting.",
    photo: "Calf_Stretch_Hands_Against_Wall",
  },
  "Doorway chest stretch": {
    title: "Doorway chest stretch",
    setup: "Forearms on a door frame, elbows at shoulder height.",
    move: "Step through until you feel a stretch across the chest.",
    watch: "Shoulder pain or arching your lower back.",
    photo: "Chest_And_Front_Of_Shoulder_Stretch",
  },
};

export const FLEX_MOVES = [
  "Hip flexor lunge", "Seated hamstring on a chair", "Figure-4 glute on a chair", "Thoracic extension over the bench",
  "Cat-cow", "Child's pose", "Wall calf stretch", "Doorway chest stretch",
];

export function guideFor(name: string): Guide | null {
  return G[name] ?? null;
}

/** Guides to show for a non-round step: flexibility lists all eight; stations match moves named in the note. */
export function guidesForStep(label: string, note: string): string[] {
  if (label === "Flexibility") return FLEX_MOVES;
  const text = note.toLowerCase();
  const out: string[] = [];
  for (const [key, g] of Object.entries(G)) {
    if (g.aliases?.some((a) => text.includes(a))) out.push(key);
  }
  return out;
}
