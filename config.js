// =====================================================
// CONFIGURATION - Autodarts Stats Dashboard
// =====================================================

const CONFIG = {
    // Supabase Configuration
    SUPABASE_URL: 'https://junwvrxugaeruahjsset.supabase.co',
    SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp1bnd2cnh1Z2FlcnVhaGpzc2V0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU1Mzg2MDEsImV4cCI6MjA4MTExNDYwMX0.-0R0U0uKVRs6-Sov8tv80ip7fjkFVAHIngOVlWnjoNQ',
    
    // App Settings
    MATCHES_PER_PAGE: 20,
    
    // Chart Colors
    COLORS: {
        green: '#10b981',
        red: '#ef4444',
        blue: '#3b82f6',
        yellow: '#f59e0b',
        gray: '#64748b'
    }
};

// Initialize Supabase client
window.db = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
