import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Supabase Credentials
const SUPABASE_URL = 'https://hjpbeajuvbnilfettyai.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhqcGJlYWp1dmJuaWxmZXR0eWFpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwODM4MTUsImV4cCI6MjA4MTY1OTgxNX0.e2vF4s62CspABqbqYb88-L6XSVWU0qP_PMCH3XaHJzM';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
    },
});

