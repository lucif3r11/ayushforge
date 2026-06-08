# Ironclad Nutrition Format

This document specifies the JSON format Claude should generate for **structured
nutrition plans** that can be imported into Ironclad's Nutrition tab. Plans built in
this format display real per-item macros (calories, protein, carbs, fat) as clean
meal tables with automatic per-meal and per-day totals — unlike the older free-text
diet plan format.

## Top-level shape

```json
{
  "type": "nutrition_only",
  "dayTypes": [
    {
      "dayType": "vegetarian",
      "label": "Veg Training Day",
      "meals": [
        {
          "name": "Breakfast",
          "foods": [
            {
              "name": "Rolled Oats",
              "quantity": "80 g",
              "kcal": 300,
              "protein": 10,
              "carbs": 54,
              "fat": 6
            },
            {
              "name": "Whey Protein",
              "quantity": "1 scoop (30 g)",
              "kcal": 120,
              "protein": 24,
              "carbs": 3,
              "fat": 1
            }
          ]
        }
      ]
    },
    {
      "dayType": "eggetarian",
      "label": "Egg Training Day",
      "meals": [
        {
          "name": "Breakfast",
          "foods": [
            {
              "name": "Whole Eggs",
              "quantity": "3 eggs",
              "kcal": 234,
              "protein": 18,
              "carbs": 1,
              "fat": 17
            }
          ]
        }
      ]
    }
  ]
}
```

## Field reference

### Root
| Field      | Type     | Required | Notes                                            |
|------------|----------|----------|--------------------------------------------------|
| `type`     | string   | yes      | Must be `"nutrition_only"`                       |
| `dayTypes` | array    | yes      | One entry per day type (see below)               |

### Day type entry
| Field     | Type    | Required | Notes                                                                                          |
|-----------|---------|----------|------------------------------------------------------------------------------------------------|
| `dayType` | string  | yes      | One of `"vegetarian"`, `"eggetarian"`, `"refeed"`, `"sunday"` (common aliases also accepted)   |
| `label`   | string  | no       | Optional human-readable name shown in the UI, e.g. "Veg Training Day"                          |
| `meals`   | array   | yes      | Ordered list of meals for that day type                                                       |

Provide **at most one entry per `dayType`**. Importing a new plan for a day type that
already exists replaces it; other day types are left untouched.

### Meal
| Field   | Type   | Required | Notes                                                  |
|---------|--------|----------|--------------------------------------------------------|
| `name`  | string | yes      | e.g. "Breakfast", "Pre-Workout", "Lunch", "Dinner"     |
| `foods` | array  | yes      | Food items that make up the meal (can be empty)       |

### Food item
| Field      | Type           | Required | Notes                                              |
|------------|----------------|----------|----------------------------------------------------|
| `name`     | string         | yes      | Food/ingredient name                               |
| `quantity` | string         | yes      | Free-form portion text, e.g. "100 g", "1 cup"      |
| `kcal`     | number         | yes      | Calories for that quantity                         |
| `protein`  | number (grams) | yes      | Protein in grams                                   |
| `carbs`    | number (grams) | yes      | Carbohydrates in grams                             |
| `fat`      | number (grams) | yes      | Fat in grams                                       |

All numeric fields should reflect the macros for the **stated quantity**, not per
100 g — Ironclad sums them as-is to produce per-meal and per-day totals, displayed in
a clean `Food | Quantity | Kcal | P | C | F` table per meal.

## Generation guidelines for Claude

- Use **realistic, internally consistent macros**: `kcal ≈ protein*4 + carbs*4 + fat*9`
  (small rounding differences are fine).
- Keep meal `name`s short and consistent across day types where possible (e.g. always
  "Breakfast", "Lunch", "Dinner", "Snack") so plans are easy to compare.
- `"vegetarian"` plans must contain no meat, fish, or eggs. `"eggetarian"` plans may
  include eggs but no meat or fish. `"refeed"` is a higher-carb day; `"sunday"` covers
  the weekend training/recovery split.
- Quantities should be precise enough to reproduce the stated macros (grams, scoops,
  pieces, cups, etc).

## Minimal example (single meal, single day type)

```json
{
  "type": "nutrition_only",
  "dayTypes": [
    {
      "dayType": "vegetarian",
      "meals": [
        {
          "name": "Lunch",
          "foods": [
            { "name": "Brown Rice", "quantity": "150 g cooked", "kcal": 170, "protein": 4, "carbs": 36, "fat": 1 },
            { "name": "Paneer", "quantity": "100 g", "kcal": 265, "protein": 18, "carbs": 4, "fat": 20 },
            { "name": "Mixed Vegetables", "quantity": "1 cup", "kcal": 80, "protein": 3, "carbs": 15, "fat": 1 }
          ]
        }
      ]
    }
  ]
}
```

## Importing

Drop the generated JSON file onto the nutrition importer in the Nutrition tab (or use
the file picker). Ironclad will preview the detected day types, meals, and item counts
before merging — your existing plans for other day types are preserved.
