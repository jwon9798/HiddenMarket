import { createClient } from '@supabase/supabase-js';

// ⚠️ 본인의 Supabase URL과 Anon Key를 여기에 넣으세요!
const supabaseUrl = 'https://zgpdtamadsktmubrxxda.supabase.co';
const supabaseAnonKey = 'sb_publishable_LtCfsDtUGgvTZGI6HX6Z2Q_5l8zIErT';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);