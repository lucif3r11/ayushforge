# Ironclad Detailed Block Format

This document specifies the JSON format Claude should generate for **detailed
training blocks** that can be imported into Ironclad's Train tab → Detailed
Blocks view. Unlike the simple workout-plan import (sets/reps only), this
format preserves rich per-exercise detail — tempo, RPE, form cues, load
progression, supersets, weekly schedules, global instructions, and
week-by-week progression tables for main lifts.

## Top-level shape

```json
{
  "type": "detailed_block",
  "name": "Hyrox Strength Block",
  "period": "8 weeks · Jan 5 – Feb 28",
  "focus": "Build a strength base for compounds while maintaining Hyrox engine work.",
  "targets": ["Squat +10kg", "Deadlift +15kg", "Sub-75min Hyrox"],
  "weeklySchedule": [
    { "day": "Monday", "label": "Lower Body — Squat Focus" },
    { "day": "Tuesday", "label": "Upper Body — Push" },
    { "day": "Wednesday", "label": "Conditioning / Hyrox" },
    { "day": "Thursday", "label": "Lower Body — Deadlift Focus" },
    { "day": "Friday", "label": "Upper Body — Pull" },
    { "day": "Saturday", "label": "Hyrox Simulation" },
    { "day": "Sunday", "label": "Rest" }
  ],
  "globalInstructions": {
    "beforeEverySession": [
      "10 min general warm-up (bike or row, easy pace)",
      "Joint prep: hips, ankles, shoulders",
      "Log bodyweight before the first set"
    ],
    "dayAddOns": {
      "Monday": ["Add 10 min sled push/pull after main lifts"],
      "Saturday": ["Finish with 1km easy jog cooldown"]
    }
  },
  "days": [
    {
      "name": "Monday",
      "label": "Lower Body — Squat Focus",
      "estimatedTime": "75 min",
      "warmup": [
        { "name": "Bike", "sets": "1", "reps": "5 min", "notes": "easy pace, build a sweat" },
        { "name": "Bodyweight Squat", "sets": "2", "reps": "10", "notes": "full depth, pause at bottom" }
      ],
      "heavyCompounds": [
        {
          "name": "Back Squat",
          "sets": "5",
          "reps": "5",
          "load": "80% 1RM",
          "rpe": "8",
          "tempo": "31X1",
          "rest": "3 min",
          "notes": "Brace hard, drive through mid-foot",
          "formCues": ["Knees track over toes", "Chest up through the hole"],
          "loadProgression": "Add 2.5kg per week if all reps hit at RPE ≤8"
        }
      ],
      "unilateral": [
        {
          "name": "Bulgarian Split Squat",
          "sets": "3",
          "reps": "8 each leg",
          "load": "moderate DBs",
          "rpe": "7",
          "rest": "90 sec",
          "notes": "Keep torso upright"
        }
      ],
      "supersets": [
        {
          "label": "A",
          "exercises": [
            { "name": "Walking Lunge", "sets": "3", "reps": "12 each leg", "rest": "0" },
            { "name": "Hanging Leg Raise", "sets": "3", "reps": "15", "rest": "60 sec" }
          ]
        }
      ],
      "core": [
        { "name": "Pallof Press", "sets": "3", "reps": "12 each side", "rest": "45 sec" }
      ],
      "hyroxFinisher": [
        { "name": "Sled Push", "sets": "4", "reps": "20m", "rest": "60 sec", "notes": "Heavy load, short bursts" }
      ]
    },
    {
      "name": "Thursday",
      "label": "Lower Body — Deadlift Focus",
      "estimatedTime": "70 min",
      "warmup": [
        { "name": "Row Erg", "sets": "1", "reps": "5 min", "notes": "easy pace" }
      ],
      "heavyCompounds": [
        {
          "name": "Conventional Deadlift",
          "sets": "5",
          "reps": "3",
          "load": "82% 1RM",
          "rpe": "8",
          "tempo": "controlled",
          "rest": "3 min",
          "notes": "Reset each rep, neutral spine",
          "formCues": ["Lats tight before the pull", "Push the floor away"],
          "loadProgression": "Add 2.5kg per week if RPE ≤8 for all sets"
        }
      ],
      "supersets": [
        {
          "label": "A",
          "exercises": [
            { "name": "Romanian Deadlift", "sets": "3", "reps": "10", "load": "moderate", "rest": "0" },
            { "name": "Cable Row", "sets": "3", "reps": "12", "rest": "75 sec" }
          ]
        }
      ],
      "core": [
        { "name": "Weighted Plank", "sets": "3", "reps": "45 sec", "rest": "45 sec" }
      ],
      "hyroxFinisher": [
        { "name": "Farmer's Carry", "sets": "4", "reps": "40m", "load": "heavy", "rest": "60 sec" }
      ]
    }
  ],
  "progressionTables": {
    "Squat": [
      { "week": 1, "load": "75% 1RM", "sets": "5", "reps": "5", "rpe": "7", "notes": "Establish baseline" },
      { "week": 2, "load": "77.5% 1RM", "sets": "5", "reps": "5", "rpe": "7.5" },
      { "week": 3, "load": "80% 1RM", "sets": "5", "reps": "5", "rpe": "8" },
      { "week": 4, "load": "82.5% 1RM", "sets": "5", "reps": "4", "rpe": "8", "notes": "Deload if RPE > 9" }
    ],
    "Deadlift": [
      { "week": 1, "load": "77% 1RM", "sets": "5", "reps": "3", "rpe": "7" },
      { "week": 2, "load": "80% 1RM", "sets": "5", "reps": "3", "rpe": "7.5" },
      { "week": 3, "load": "82% 1RM", "sets": "5", "reps": "3", "rpe": "8" },
      { "week": 4, "load": "85% 1RM", "sets": "4", "reps": "2", "rpe": "8.5", "notes": "Deload if RPE > 9" }
    ]
  }
}
```

## Field reference

### Root
| Field                | Type           | Required | Notes                                                                 |
|----------------------|----------------|----------|------------------------------------------------------------------------|
| `type`               | string         | yes      | Must be `"detailed_block"`                                             |
| `name`               | string         | no       | Block name (aliases: `blockName`, `title`). Defaults to "Untitled Block" |
| `period`             | string         | no       | Free-form duration/date range (aliases: `duration`, `dates`)          |
| `focus`              | string         | no       | One-line summary of the block's purpose (alias: `goal`)               |
| `targets`            | array/string   | no       | Goals/targets shown as badges (aliases: `target`, `goals`)            |
| `weeklySchedule`     | array/object   | no       | Master weekly schedule (see below)                                     |
| `globalInstructions` | object         | no       | `{ beforeEverySession, dayAddOns }` (alias: `instructions`)            |
| `days`               | array          | yes      | One entry per training day (must be non-empty)                        |
| `progressionTables`  | array/object   | no       | Week-by-week progression for main lifts (aliases: `progression`, `progressions`) |

### Weekly schedule
Either an array of `{ "day": "Monday", "label": "..." }` objects (aliases for
`label`: `focus`, `workout`, `session`), an array of strings like
`"Monday: Lower Body"` (split on `:`/`—`/`-`), or an object map
`{ "Monday": "Lower Body", ... }`.

### Global instructions
| Field                | Type            | Notes                                                          |
|----------------------|-----------------|------------------------------------------------------------------|
| `beforeEverySession` | array of string | Shown as a checklist above every day (aliases: `beforeEvery`, `before`) |
| `dayAddOns`          | object          | Map of day name → array of extra instructions for that day (aliases: `addOns`, `dayAddOn`). Keys are matched against a day's `name`, `label`, or its weekly-schedule day name (case-insensitive). |

### Day entry
| Field           | Type   | Required | Notes                                                                 |
|-----------------|--------|----------|--------------------------------------------------------------------|
| `name`          | string | no       | Day name, e.g. "Monday" (aliases: `day`, `title`). Defaults to "Day N" |
| `label`         | string | no       | Short focus tag, e.g. "Squat Focus" (alias: `focus`)                |
| `estimatedTime` | string | no       | Lifting time estimate, e.g. "75 min" (aliases: `liftingTime`, `duration`, `time`) |

A day's exercises can be provided **either** as a generic `sections` array
**or** via named top-level keys — both are supported and may be mixed:

```json
{ "sections": [ { "name": "Warm-up", "exercises": [ ... ] } ] }
```

```json
{ "warmup": [ ... ], "heavyCompounds": [ ... ], "core": [ ... ] }
```

Recognised named keys (and their display section name):

| JSON key(s)                                          | Display section    |
|-------------------------------------------------------|---------------------|
| `warmup`, `warmUp`, `warm_up`                          | Warm-up             |
| `heavyCompounds`, `heavy_compounds`, `compounds`       | Heavy Compounds     |
| `unilateral`                                           | Unilateral          |
| `supersets`, `supersetGroups`, `superset_groups`       | Superset Groups     |
| `accessories`, `accessory`                             | Accessories         |
| `core`                                                  | Core                |
| `hyroxFinisher`, `hyrox_finisher`, `finisher`          | Hyrox Finisher      |
| `cooldown`, `cool_down`                                | Cool-down           |

Sections are always displayed in the order above, regardless of the order
they appear in the JSON.

### Exercise / superset group entry
Each item in a section's exercise list can be either a plain exercise object,
or a group object containing a nested `exercises` (or `pair`/`items`) array —
the nested form is rendered as a **superset** (lettered A/B/C…) when it
contains more than one exercise:

```json
{
  "label": "A",
  "groupName": "Push/Pull Superset",
  "rounds": "3",
  "restAfterPair": "90 sec",
  "exercises": [ { "name": "..." }, { "name": "..." } ]
}
```

| Field           | Type          | Notes                                                                 |
|-----------------|---------------|------------------------------------------------------------------------|
| `label`         | string        | Short letter shown as "Superset A" (aliases: `group`, `supersetGroup`) |
| `groupName`     | string        | Descriptive name shown next to the label (aliases: `name`, `title`, `group_name`) |
| `rounds`        | string/number | Number of times the pair is repeated (aliases: `round`, `numRounds`)  |
| `restAfterPair` | string/number | Shared rest taken after completing one round of the superset (aliases: `restAfterRound`, `restAfterSuperset`, `restAfter`, `pairRest`, `groupRest`) |
| `exercises`     | array         | The exercises performed back-to-back (aliases: `pair`, `items`)        |

Alternatively, a flat list of exercises can be paired into a superset by
giving consecutive items the same `supersetGroup` (or `group`/`pairGroup`)
value.

### Exercise fields
| Field             | Type            | Notes                                                                 |
|-------------------|-----------------|--------------------------------------------------------------------|
| `name`            | string          | Required (aliases: `exercise`, `exerciseName`)                       |
| `sets`            | string/number   | Alias: `targetSets`                                                  |
| `reps`            | string/number   | Alias: `targetReps`                                                  |
| `load`            | string/number   | Aliases: `weight`, `targetWeight`, `intensity`, `percent1RM`, `%1RM`  |
| `rpe`             | string/number   | Rate of perceived exertion                                            |
| `tempo`           | string          | e.g. "31X1"                                                          |
| `rest`            | string/number   | Aliases: `restSeconds`, `restTime`                                   |
| `notes`           | string          | Alias: `note`                                                        |
| `formCues`        | array/string    | Aliases: `cues`, `formCue`, `cue`                                     |
| `loadProgression` | string          | Aliases: `progression`, `progressionScheme`                          |

All values are displayed **exactly as provided** — no unit conversion or
recalculation is performed.

### Progression tables
Either an array of `{ "lift": "Squat", "rows": [...] }` objects (aliases for
`lift`: `exercise`, `name`; aliases for `rows`: `weeks`), or an object map
`{ "Squat": [...], "Deadlift": [...] }`. Each row:

| Field   | Type          | Notes                                                                 |
|---------|---------------|------------------------------------------------------------------------|
| `week`  | string/number | Numeric values become "Week N"; non-numeric strings are used as-is. Falls back to `label`, then "Week N" by position |
| `load`  | string/number | Aliases: `weight`, `intensity`                                        |
| `sets`  | string/number |                                                                          |
| `reps`  | string/number |                                                                          |
| `rpe`   | string/number |                                                                          |
| `notes` | string        |                                                                          |

## Importing

Drop the generated JSON file onto the importer in Train → Detailed Blocks.
Ironclad will preview the block name, targets, and per-day section/exercise
counts before saving it locally — imported blocks persist alongside (and
independently of) your simple routines, and you can switch between the two
views with the toggle at the top of the Train tab.

You can also drop a `detailed_block` file onto the "Import Plan" importer in
the Routines tab — Ironclad detects the type, imports it, and automatically
switches you to the Detailed Blocks tab.
