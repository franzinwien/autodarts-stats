// =====================================================
// CONFIGURATION - Autodarts Stats Dashboard
// =====================================================

const CONFIG = {
    // Supabase Configuration
    SUPABASE_URL: 'https://znjiemoatvezhquukbvd.supabase.co',
    SUPABASE_ANON_KEY: 'sb_publishable_o0cAwiHv7KsuKAYgSDCePw_jpmDOX-S',
    
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
