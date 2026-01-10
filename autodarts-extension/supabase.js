// Supabase Configuration
const SUPABASE_URL = 'https://junwvrxugaeruahjsset.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp1bnd2cnh1Z2FlcnVhaGpzc2V0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU1Mzg2MDEsImV4cCI6MjA4MTExNDYwMX0.-0R0U0uKVRs6-Sov8tv80ip7fjkFVAHIngOVlWnjoNQ';

// Your Autodarts User ID
const MY_USER_ID = 'b81d2805-46e8-4daf-be6c-899e2d70bdfa';
const MY_USERNAME = 'franzinwien';

// Supabase REST API helper
class SupabaseClient {
    constructor(url, key) {
        this.url = url;
        this.key = key;
        this.headers = {
            'apikey': key,
            'Authorization': `Bearer ${key}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal'
        };
    }

    async insert(table, data) {
        const response = await fetch(`${this.url}/rest/v1/${table}`, {
            method: 'POST',
            headers: { ...this.headers, 'Prefer': 'return=representation,resolution=merge-duplicates' },
            body: JSON.stringify(data)
        });
        
        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Insert failed: ${error}`);
        }
        
        return response.json();
    }

    async upsert(table, data) {
        const response = await fetch(`${this.url}/rest/v1/${table}`, {
            method: 'POST',
            headers: { 
                ...this.headers, 
                'Prefer': 'return=representation,resolution=merge-duplicates'
            },
            body: JSON.stringify(data)
        });
        
        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Upsert failed: ${error}`);
        }
        
        return response.json();
    }

    async select(table, query = '') {
        const response = await fetch(`${this.url}/rest/v1/${table}?${query}`, {
            method: 'GET',
            headers: this.headers
        });
        
        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Select failed: ${error}`);
        }
        
        return response.json();
    }

    async rpc(functionName, params = {}) {
        const response = await fetch(`${this.url}/rest/v1/rpc/${functionName}`, {
            method: 'POST',
            headers: this.headers,
            body: JSON.stringify(params)
        });
        
        if (!response.ok) {
            const error = await response.text();
            throw new Error(`RPC failed: ${error}`);
        }
        
        return response.json();
    }
}

const supabase = new SupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY);
