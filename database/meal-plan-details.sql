-- Optional per-meal availability and timing for the owner listing wizard.
ALTER TABLE meal_plans ADD COLUMN breakfast_enabled INTEGER NOT NULL DEFAULT 1;
ALTER TABLE meal_plans ADD COLUMN lunch_enabled INTEGER NOT NULL DEFAULT 1;
ALTER TABLE meal_plans ADD COLUMN snacks_enabled INTEGER NOT NULL DEFAULT 0;
ALTER TABLE meal_plans ADD COLUMN dinner_enabled INTEGER NOT NULL DEFAULT 1;
ALTER TABLE meal_plans ADD COLUMN breakfast_time TEXT;
ALTER TABLE meal_plans ADD COLUMN lunch_time TEXT;
ALTER TABLE meal_plans ADD COLUMN snacks_time TEXT;
ALTER TABLE meal_plans ADD COLUMN dinner_time TEXT;
