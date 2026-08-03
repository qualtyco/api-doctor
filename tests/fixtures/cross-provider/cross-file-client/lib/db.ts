// The dominant production layout: the client is created once, exported under
// a neutral name, and no consumer file ever says the word "supabase".
import { createClient } from '@supabase/supabase-js';

export const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_KEY!);
