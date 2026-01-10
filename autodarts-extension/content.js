// Content script for Autodarts Stats Tracker
// Runs on play.autodarts.io pages

const MY_USER_ID = 'b81d2805-46e8-4daf-be6c-899e2d70bdfa';

// Create and inject the sync button
function createSyncButton() {
    if (document.getElementById('autodarts-sync-btn')) return;
    
    const button = document.createElement('button');
    button.id = 'autodarts-sync-btn';
    button.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
            <path d="M9 12l2 2 4-4"/>
        </svg>
        <span>Sync Stats</span>
    `;
    button.onclick = handleSyncClick;
    
    document.body.appendChild(button);
}

// Create status popup
function showStatus(message, type = 'info') {
    let popup = document.getElementById('autodarts-status-popup');
    
    if (!popup) {
        popup = document.createElement('div');
        popup.id = 'autodarts-status-popup';
        document.body.appendChild(popup);
    }
    
    popup.className = `autodarts-status ${type}`;
    popup.innerHTML = message;
    popup.style.display = 'block';
    
    if (type !== 'loading') {
        setTimeout(() => {
            popup.style.display = 'none';
        }, 8000);
    }
}

// Handle sync button click
async function handleSyncClick() {
    const currentUrl = window.location.href;
    
    // Check if we're on a specific match page
    const matchPageMatch = currentUrl.match(/\/matches\/([a-f0-9-]+)/);
    
    if (matchPageMatch && !currentUrl.includes('/history')) {
        // Sync single match from detail page
        const matchId = matchPageMatch[1];
        await syncSingleMatch(matchId);
    } else if (currentUrl.includes('/history/matches')) {
        // On history page - extract match IDs from the visible rows
        await syncFromHistoryPage();
    } else {
        showStatus('📍 Gehe zu <b>Match History</b> um alle Matches zu syncen, oder öffne ein <b>einzelnes Match</b> um es zu syncen.', 'info');
    }
}

// Sync a single match
async function syncSingleMatch(matchId) {
    showStatus('🔄 Syncing match...', 'loading');
    
    try {
        const checkResponse = await new Promise(resolve => {
            chrome.runtime.sendMessage({ action: 'checkMatch', matchId }, resolve);
        });
        
        if (checkResponse.exists) {
            showStatus('✅ Match already synced!', 'success');
            return;
        }
        
        const response = await new Promise(resolve => {
            chrome.runtime.sendMessage({ action: 'syncSingleMatch', matchId }, resolve);
        });
        
        if (response.success) {
            showStatus('✅ Match synced successfully!', 'success');
        } else {
            showStatus(`❌ Error: ${response.error}`, 'error');
        }
    } catch (error) {
        showStatus(`❌ Error: ${error.message}`, 'error');
    }
}

// Extract match IDs from history page and sync them
async function syncFromHistoryPage() {
    showStatus('🔄 Extracting matches from page...', 'loading');
    
    try {
        // Extract match links from the page
        const matchLinks = document.querySelectorAll('a[href*="/history/matches/"]');
        const matchIds = [];
        
        matchLinks.forEach(link => {
            const match = link.href.match(/\/history\/matches\/([a-f0-9-]+)/);
            if (match && !matchIds.includes(match[1])) {
                matchIds.push(match[1]);
            }
        });
        
        if (matchIds.length === 0) {
            showStatus('⚠️ Keine Matches auf dieser Seite gefunden. Scrolle oder blättere durch deine Match History.', 'info');
            return;
        }
        
        showStatus(`🔄 Syncing ${matchIds.length} matches from this page...`, 'loading');
        
        // Sync all matches via background script
        const response = await new Promise(resolve => {
            chrome.runtime.sendMessage({ action: 'syncMatches', matches: matchIds }, resolve);
        });
        
        if (response.success) {
            const synced = response.result.filter(r => r.status === 'synced').length;
            const skipped = response.result.filter(r => r.status === 'skipped').length;
            const errors = response.result.filter(r => r.status === 'error').length;
            
            showStatus(`✅ Done! Synced: ${synced}, Skipped: ${skipped}, Errors: ${errors}<br><br>📄 Für mehr Matches: Blättere zur nächsten Seite und klicke erneut Sync.`, 'success');
        } else {
            showStatus(`❌ Error: ${response.error}`, 'error');
        }
    } catch (error) {
        showStatus(`❌ Error: ${error.message}`, 'error');
    }
}

// Initialize
function init() {
    createSyncButton();
    
    const observer = new MutationObserver(() => {
        if (!document.getElementById('autodarts-sync-btn')) {
            createSyncButton();
        }
    });
    
    observer.observe(document.body, { childList: true, subtree: true });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
