-- Migration: add_command_preferences
-- Adds commandPreferences JSONB column to User for persisting
-- the founder's default SP/PM toggle and agency filter selections.

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "commandPreferences" JSONB;
