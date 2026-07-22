import { createClient } from '@supabase/supabase-js';

// Vars are extracted to locals first (a different shape than the inline
// example), but there's still no guard before they're used.
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const supabase = createClient(url!, key!);
