-- Add asset_class column to vaults table
-- Run this in Supabase SQL Editor before deploying vault asset class features
ALTER TABLE vaults ADD COLUMN IF NOT EXISTS asset_class TEXT DEFAULT 'SINKING_FUND';
