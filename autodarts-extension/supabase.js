// Supabase Configuration
const SUPABASE_URL = 'https://znjiemoatvezhquukbvd.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_o0cAwiHv7KsuKAYgSDCePw_jpmDOX-S';

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
