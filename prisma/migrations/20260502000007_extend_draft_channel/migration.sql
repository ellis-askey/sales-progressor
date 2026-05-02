-- Add twitter and instagram_reel_script to DraftChannel enum
ALTER TYPE "DraftChannel" ADD VALUE IF NOT EXISTS 'twitter';
ALTER TYPE "DraftChannel" ADD VALUE IF NOT EXISTS 'instagram_reel_script';
