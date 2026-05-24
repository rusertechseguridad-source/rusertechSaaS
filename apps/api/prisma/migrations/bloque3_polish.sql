-- Migration: Bloque 3 polish
-- Add category to avl_event_dictionary
-- Add event_dictionary_id to vehicles  
-- Add operation_id, is_authorized_stop to saved_locations

-- 1. AVL Event Dictionary: add category column
ALTER TABLE avl_event_dictionary ADD COLUMN IF NOT EXISTS category VARCHAR(100) DEFAULT 'event';

-- 2. Drop old unique constraint and create new one with category
ALTER TABLE avl_event_dictionary DROP CONSTRAINT IF EXISTS "avl_event_dictionary_avl_user_id_raw_code_key";
ALTER TABLE avl_event_dictionary ADD CONSTRAINT "avl_event_dictionary_avl_user_id_category_raw_code_key" UNIQUE (avl_user_id, category, raw_code);

-- 3. Vehicles: add event_dictionary_id
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS event_dictionary_id UUID REFERENCES avl_event_dictionary(id);

-- 4. Saved Locations: add operation_id and is_authorized_stop
ALTER TABLE saved_locations ADD COLUMN IF NOT EXISTS operation_id UUID REFERENCES operations(id);
ALTER TABLE saved_locations ADD COLUMN IF NOT EXISTS is_authorized_stop BOOLEAN DEFAULT false;
