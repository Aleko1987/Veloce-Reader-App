import { createClient } from "@supabase/supabase-js";

// Placeholder values — replace with your Supabase project URL and anon key.
const SUPABASE_URL = "https://placeholder.supabase.co";
const SUPABASE_ANON_KEY = "placeholder-anon-key";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
