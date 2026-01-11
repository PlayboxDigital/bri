
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://rlrbxhvprgzdqnjavxqh.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJscmJ4aHZwcmd6ZHFuamF2eHFoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgxNjI5MzgsImV4cCI6MjA4MzczODkzOH0.7ij-Uug8mQz6z_PjgbrKPFAxyKnnyANQYGEbI3TtzCQ';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
