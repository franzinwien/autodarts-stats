// Popup script
document.addEventListener('DOMContentLoaded', async () => {
    const countEl = document.getElementById('match-count');
    const statusEl = document.getElementById('status');
    
    try {
        statusEl.textContent = 'Loading...';
        statusEl.className = 'loading';
        
        // Get match count from Supabase
        const matches = await supabase.select('matches', 'select=id');
        countEl.textContent = matches.length;
        
        statusEl.textContent = '';
        statusEl.className = '';
    } catch (error) {
        console.error('Error loading stats:', error);
        countEl.textContent = '?';
        statusEl.textContent = 'Error connecting to database';
        statusEl.className = 'error';
    }
});
