// =====================================================
// AUTODARTS STATS DASHBOARD - Main Application
// =====================================================

class AutodartsStats {
    constructor() {
        this.user = null;
        this.autodartsUserId = null;
        this.isAdmin = false;
        this.matchesCache = [];
        this.currentPage = 0;
        
        this.init();
    }
    
    async init() {
        // Check for existing session
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session) {
            await this.handleAuthSuccess(session.user);
        } else {
            // Check for magic link callback
            const hashParams = new URLSearchParams(window.location.hash.substring(1));
            if (hashParams.get('access_token')) {
                // Let Supabase handle the callback
                const { data: { session: newSession } } = await supabase.auth.getSession();
                if (newSession) {
                    await this.handleAuthSuccess(newSession.user);
                    // Clean up URL
                    window.history.replaceState({}, document.title, window.location.pathname);
                }
            }
        }
        
        // Listen for auth changes
        supabase.auth.onAuthStateChange(async (event, session) => {
            if (event === 'SIGNED_IN' && session) {
                await this.handleAuthSuccess(session.user);
            } else if (event === 'SIGNED_OUT') {
                this.showLoginScreen();
            }
        });
        
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        // Login form
        document.getElementById('send-magic-link')?.addEventListener('click', () => this.sendMagicLink());
        document.getElementById('email-input')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.sendMagicLink();
        });
        
        // Logout
        document.getElementById('logout-btn')?.addEventListener('click', () => this.logout());
        
        // Navigation
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', () => this.navigateTo(btn.dataset.page));
        });
        
        // Filters
        document.getElementById('filter-type')?.addEventListener('change', () => this.loadMatchesPage());
        document.getElementById('filter-variant')?.addEventListener('change', () => this.loadMatchesPage());
    }
    
    async sendMagicLink() {
        const email = document.getElementById('email-input').value.trim();
        const messageEl = document.getElementById('login-message');
        const button = document.getElementById('send-magic-link');
        
        if (!email) {
            messageEl.textContent = 'Bitte Email-Adresse eingeben';
            messageEl.className = 'login-message error';
            return;
        }
        
        button.disabled = true;
        button.innerHTML = '<span>Sende...</span>';
        
        try {
            const { error } = await supabase.auth.signInWithOtp({
                email: email,
                options: {
                    emailRedirectTo: window.location.origin + window.location.pathname
                }
            });
            
            if (error) throw error;
            
            messageEl.textContent = '✅ Magic Link gesendet! Prüfe deine Emails.';
            messageEl.className = 'login-message success';
        } catch (error) {
            console.error('Login error:', error);
            messageEl.textContent = '❌ ' + error.message;
            messageEl.className = 'login-message error';
        } finally {
            button.disabled = false;
            button.innerHTML = '<span>Magic Link senden</span><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>';
        }
    }
    
    async handleAuthSuccess(user) {
        this.user = user;
        
        // Get user's autodarts info from allowed_users
        try {
            const { data: allowedUser, error } = await supabase
                .from('allowed_users')
                .select('*')
                .eq('email', user.email)
                .single();
            
            if (error || !allowedUser) {
                alert('Zugang nicht erlaubt. Kontaktiere den Admin.');
                await this.logout();
                return;
            }
            
            this.autodartsUserId = allowedUser.autodarts_user_id;
            this.isAdmin = allowedUser.is_admin;
            
            document.getElementById('user-name').textContent = allowedUser.autodarts_username || user.email;
            
            this.showDashboard();
            this.loadOverviewData();
        } catch (error) {
            console.error('Error fetching user info:', error);
            alert('Fehler beim Laden der Benutzerdaten');
        }
    }
    
    async logout() {
        await supabase.auth.signOut();
        this.user = null;
        this.autodartsUserId = null;
        this.showLoginScreen();
    }
    
    showLoginScreen() {
        document.getElementById('login-screen').classList.remove('hidden');
        document.getElementById('dashboard-screen').classList.add('hidden');
    }
    
    showDashboard() {
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('dashboard-screen').classList.remove('hidden');
    }
    
    showLoading() {
        document.getElementById('loading-overlay').classList.remove('hidden');
    }
    
    hideLoading() {
        document.getElementById('loading-overlay').classList.add('hidden');
    }
    
    navigateTo(page) {
        // Update nav buttons
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.page === page);
        });
        
        // Show page
        document.querySelectorAll('.page').forEach(p => {
            p.classList.toggle('active', p.id === `page-${page}`);
        });
        
        // Load page data
        switch (page) {
            case 'overview':
                this.loadOverviewData();
                break;
            case 'matches':
                this.loadMatchesPage();
                break;
            case 'heatmap':
                this.loadHeatmapData();
                break;
            case 'opponents':
                this.loadOpponentsData();
                break;
        }
    }
    
    // =====================================================
    // OVERVIEW PAGE
    // =====================================================
    
    async loadOverviewData() {
        this.showLoading();
        
        try {
            // Get all matches where user participated, with all players for opponent info
            const { data: matchPlayers, error } = await supabase
                .from('match_players')
                .select(`
                    *,
                    match:matches (*)
                `)
                .eq('user_id', this.autodartsUserId);
            
            if (error) throw error;
            
            // Get all match IDs to fetch opponent info
            const matchIds = matchPlayers.map(mp => mp.match_id);
            
            // Get all players for these matches (to find opponents)
            const { data: allPlayers } = await supabase
                .from('match_players')
                .select('*')
                .in('match_id', matchIds);
            
            // Create opponent lookup
            this.opponentMap = {};
            allPlayers?.forEach(p => {
                if (p.user_id !== this.autodartsUserId) {
                    if (!this.opponentMap[p.match_id]) {
                        this.opponentMap[p.match_id] = p;
                    }
                }
            });
            
            // Sort matches by date (newest first)
            const matches = matchPlayers
                .filter(mp => mp.match)
                .sort((a, b) => new Date(b.match.finished_at) - new Date(a.match.finished_at));
            
            const totalMatches = matches.length;
            
            let wins = 0;
            let totalAverage = 0;
            let avgCount = 0;
            let totalCheckout = 0;
            let checkoutCount = 0;
            
            matches.forEach(mp => {
                if (mp.match.winner === mp.player_index) {
                    wins++;
                }
                // Calculate averages from legs data - use match-specific stats
                if (mp.average && mp.average > 0) {
                    totalAverage += mp.average;
                    avgCount++;
                }
                if (mp.checkout_rate && mp.checkout_rate > 0) {
                    totalCheckout += mp.checkout_rate;
                    checkoutCount++;
                }
            });
            
            const winRate = totalMatches > 0 ? ((wins / totalMatches) * 100).toFixed(1) : 0;
            const avgAverage = avgCount > 0 ? (totalAverage / avgCount).toFixed(1) : '-';
            const avgCheckout = checkoutCount > 0 ? ((totalCheckout / checkoutCount) * 100).toFixed(1) : '-';
            
            // Update stats cards
            document.getElementById('stat-matches').textContent = totalMatches;
            document.getElementById('stat-winrate').textContent = winRate + '%';
            document.getElementById('stat-average').textContent = avgAverage;
            document.getElementById('stat-checkout').textContent = avgCheckout !== '-' ? avgCheckout + '%' : '-';
            
            // Load charts
            await this.renderAverageChart(matches);
            this.renderResultsChart(wins, totalMatches - wins);
            
            // Load recent matches table
            this.renderRecentMatches(matches.slice(0, 10));
            
        } catch (error) {
            console.error('Error loading overview:', error);
        } finally {
            this.hideLoading();
        }
    }
    
    async renderAverageChart(matches) {
        const ctx = document.getElementById('chart-average');
        if (!ctx) return;
        
        // Get last 30 matches, sorted oldest to newest for the chart
        const recentMatches = matches.slice(0, 30).reverse();
        
        // For each match, we need to calculate the actual average from turns
        const matchIds = recentMatches.map(m => m.match_id);
        
        // Get legs for these matches
        const { data: legs } = await supabase
            .from('legs')
            .select('id, match_id')
            .in('match_id', matchIds);
        
        if (!legs || legs.length === 0) {
            // Fallback: use the stored average if no leg data
            const labels = recentMatches.map(m => {
                const date = new Date(m.match.finished_at);
                return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
            });
            const data = recentMatches.map(m => m.average || 0);
            
            if (this.averageChart) this.averageChart.destroy();
            this.averageChart = new Chart(ctx, {
                type: 'line',
                data: { labels, datasets: [{ label: '3-Dart Average', data, borderColor: CONFIG.COLORS.green, backgroundColor: 'rgba(16, 185, 129, 0.1)', fill: true, tension: 0.3 }] },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { color: 'rgba(255,255,255,0.1)' }, ticks: { color: '#94a3b8' } }, y: { grid: { color: 'rgba(255,255,255,0.1)' }, ticks: { color: '#94a3b8' } } } }
            });
            return;
        }
        
        const legIds = legs.map(l => l.id);
        
        // Get turns for user's legs
        const { data: turns } = await supabase
            .from('turns')
            .select('leg_id, points, match_player_id')
            .in('leg_id', legIds);
        
        // Get user's match_player_ids
        const userMpIds = recentMatches.map(m => m.id);
        
        // Calculate average per match
        const matchAverages = {};
        recentMatches.forEach(m => {
            const matchLegs = legs.filter(l => l.match_id === m.match_id);
            const matchLegIds = matchLegs.map(l => l.id);
            const userTurns = turns?.filter(t => 
                matchLegIds.includes(t.leg_id) && t.match_player_id === m.id
            ) || [];
            
            if (userTurns.length > 0) {
                const totalPoints = userTurns.reduce((sum, t) => sum + (t.points || 0), 0);
                matchAverages[m.match_id] = totalPoints / userTurns.length;
            } else {
                matchAverages[m.match_id] = m.average || 0;
            }
        });
        
        const labels = recentMatches.map(m => {
            const date = new Date(m.match.finished_at);
            return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
        });
        
        const data = recentMatches.map(m => matchAverages[m.match_id]?.toFixed(1) || 0);
        
        if (this.averageChart) {
            this.averageChart.destroy();
        }
        
        this.averageChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: '3-Dart Average',
                    data: data,
                    borderColor: CONFIG.COLORS.green,
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    fill: true,
                    tension: 0.3,
                    pointRadius: 4,
                    pointHoverRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    x: {
                        grid: {
                            color: 'rgba(255,255,255,0.1)'
                        },
                        ticks: {
                            color: '#94a3b8',
                            maxRotation: 45
                        }
                    },
                    y: {
                        grid: {
                            color: 'rgba(255,255,255,0.1)'
                        },
                        ticks: {
                            color: '#94a3b8'
                        },
                        beginAtZero: false,
                        suggestedMin: 30,
                        suggestedMax: 60
                    }
                }
            }
        });
    }
    
    renderResultsChart(wins, losses) {
        const ctx = document.getElementById('chart-results');
        if (!ctx) return;
        
        if (this.resultsChart) {
            this.resultsChart.destroy();
        }
        
        this.resultsChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Siege', 'Niederlagen'],
                datasets: [{
                    data: [wins, losses],
                    backgroundColor: [CONFIG.COLORS.green, CONFIG.COLORS.red],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: '#94a3b8',
                            padding: 20
                        }
                    }
                },
                cutout: '60%'
            }
        });
    }
    
    renderRecentMatches(matches) {
        const tbody = document.querySelector('#recent-matches-table tbody');
        if (!tbody) return;
        
        tbody.innerHTML = matches.map(mp => {
            const match = mp.match;
            const date = new Date(match.finished_at);
            const isWin = match.winner === mp.player_index;
            
            // Find opponent from our lookup
            const opponent = this.opponentMap[mp.match_id];
            let opponentName = 'Unbekannt';
            
            if (opponent) {
                if (opponent.is_bot) {
                    const level = Math.round((opponent.cpu_ppr || 40) / 10);
                    opponentName = `🤖 Bot Lvl ${level}`;
                } else {
                    opponentName = opponent.name || 'Gegner';
                }
            }
            
            return `
                <tr>
                    <td>${date.toLocaleDateString('de-DE')}</td>
                    <td>${opponentName}</td>
                    <td class="${isWin ? 'result-win' : 'result-loss'}">
                        ${isWin ? '✅ Sieg' : '❌ Niederlage'}
                    </td>
                    <td><span class="badge badge-${match.type?.toLowerCase() || 'online'}">${match.type || 'Online'}</span></td>
                </tr>
            `;
        }).join('');
    }
    
    // =====================================================
    // MATCHES PAGE
    // =====================================================
    
    async loadMatchesPage() {
        this.showLoading();
        
        try {
            const { data: matchPlayers, error } = await supabase
                .from('match_players')
                .select(`
                    *,
                    match:matches (*)
                `)
                .eq('user_id', this.autodartsUserId);
            
            if (error) throw error;
            
            // Fetch opponent info if not already loaded
            if (!this.opponentMap || Object.keys(this.opponentMap).length === 0) {
                const matchIds = matchPlayers.map(mp => mp.match_id);
                const { data: allPlayers } = await supabase
                    .from('match_players')
                    .select('*')
                    .in('match_id', matchIds);
                
                this.opponentMap = {};
                allPlayers?.forEach(p => {
                    if (p.user_id !== this.autodartsUserId) {
                        if (!this.opponentMap[p.match_id]) {
                            this.opponentMap[p.match_id] = p;
                        }
                    }
                });
            }
            
            // Sort by date (newest first)
            let filtered = matchPlayers
                .filter(mp => mp.match)
                .sort((a, b) => new Date(b.match.finished_at) - new Date(a.match.finished_at));
            
            // Apply filters
            const typeFilter = document.getElementById('filter-type').value;
            const variantFilter = document.getElementById('filter-variant').value;
            
            if (typeFilter) {
                filtered = filtered.filter(mp => mp.match.type === typeFilter);
            }
            if (variantFilter) {
                filtered = filtered.filter(mp => mp.match.variant === variantFilter);
            }
            
            this.renderAllMatches(filtered);
            
        } catch (error) {
            console.error('Error loading matches:', error);
        } finally {
            this.hideLoading();
        }
    }
    
    renderAllMatches(matches) {
        const tbody = document.querySelector('#all-matches-table tbody');
        if (!tbody) return;
        
        tbody.innerHTML = matches.map(mp => {
            const match = mp.match;
            const date = new Date(match.finished_at);
            const isWin = match.winner === mp.player_index;
            
            // Find opponent
            const opponent = this.opponentMap?.[mp.match_id];
            let opponentName = 'Unbekannt';
            
            if (opponent) {
                if (opponent.is_bot) {
                    const level = Math.round((opponent.cpu_ppr || 40) / 10);
                    opponentName = `🤖 Bot Lvl ${level}`;
                } else {
                    opponentName = opponent.name || 'Gegner';
                }
            }
            
            return `
                <tr>
                    <td>${date.toLocaleDateString('de-DE')} ${date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</td>
                    <td>${opponentName}</td>
                    <td class="${isWin ? 'result-win' : 'result-loss'}">
                        ${isWin ? '✅ Sieg' : '❌ Niederlage'}
                    </td>
                    <td>${match.variant || '-'}</td>
                    <td><span class="badge badge-${(match.type || 'online').toLowerCase()}">${match.type || 'Online'}</span></td>
                    <td>${mp.legs_won || 0}</td>
                </tr>
            `;
        }).join('');
    }
    
    // =====================================================
    // HEATMAP PAGE
    // =====================================================
    
    async loadHeatmapData() {
        this.showLoading();
        
        try {
            // Get all throws for this user
            const { data: throws, error } = await supabase
                .from('throws')
                .select(`
                    *,
                    turn:turns!inner (
                        match_player:match_players!inner (
                            user_id
                        )
                    )
                `)
                .eq('turn.match_player.user_id', this.autodartsUserId)
                .not('coord_x', 'is', null)
                .limit(5000);
            
            if (error) {
                console.error('Heatmap query error:', error);
                // Fallback: get segment stats only
                await this.loadSegmentStats();
                this.drawEmptyDartboard();
                return;
            }
            
            this.renderDartboard(throws || []);
            await this.loadSegmentStats();
            
        } catch (error) {
            console.error('Error loading heatmap:', error);
            this.drawEmptyDartboard();
        } finally {
            this.hideLoading();
        }
    }
    
    async loadSegmentStats() {
        try {
            const { data: throws, error } = await supabase
                .from('throws')
                .select('segment_name')
                .not('segment_name', 'is', null);
            
            if (error || !throws) return;
            
            // Count segments
            const counts = {};
            throws.forEach(t => {
                if (t.segment_name && t.segment_name !== 'Miss') {
                    counts[t.segment_name] = (counts[t.segment_name] || 0) + 1;
                }
            });
            
            // Sort and get top 10
            const sorted = Object.entries(counts)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 10);
            
            const maxCount = sorted[0]?.[1] || 1;
            
            const container = document.getElementById('segment-stats');
            container.innerHTML = sorted.map(([name, count]) => `
                <div class="segment-stat">
                    <span class="segment-name">${name}</span>
                    <div class="segment-bar">
                        <div class="segment-bar-fill" style="width: ${(count / maxCount) * 100}%"></div>
                    </div>
                    <span class="segment-count">${count}x</span>
                </div>
            `).join('');
            
        } catch (error) {
            console.error('Error loading segment stats:', error);
        }
    }
    
    drawEmptyDartboard() {
        const canvas = document.getElementById('dartboard-canvas');
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const radius = 200;
        
        // Clear canvas
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Draw dartboard rings
        const rings = [
            { r: radius, color: '#1a1a1a' },
            { r: radius * 0.9, color: '#2a2a2a' },
            { r: radius * 0.6, color: '#1a1a1a' },
            { r: radius * 0.4, color: '#2a2a2a' },
            { r: radius * 0.1, color: '#10b981' },
            { r: radius * 0.04, color: '#ef4444' }
        ];
        
        rings.forEach(ring => {
            ctx.beginPath();
            ctx.arc(centerX, centerY, ring.r, 0, Math.PI * 2);
            ctx.fillStyle = ring.color;
            ctx.fill();
        });
        
        // Draw message
        ctx.fillStyle = '#64748b';
        ctx.font = '14px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Keine Wurfdaten verfügbar', centerX, centerY + radius + 30);
    }
    
    renderDartboard(throws) {
        const canvas = document.getElementById('dartboard-canvas');
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const scale = 200; // Scale factor for coordinates
        
        // Clear and draw dartboard background
        this.drawEmptyDartboard();
        
        // Draw throw points as heatmap
        throws.forEach(t => {
            if (t.coord_x != null && t.coord_y != null) {
                const x = centerX + (t.coord_x * scale);
                const y = centerY - (t.coord_y * scale); // Invert Y
                
                ctx.beginPath();
                ctx.arc(x, y, 4, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(16, 185, 129, 0.5)';
                ctx.fill();
            }
        });
    }
    
    // =====================================================
    // OPPONENTS PAGE
    // =====================================================
    
    async loadOpponentsData() {
        this.showLoading();
        
        try {
            // Get all matches
            const { data: myMatches, error } = await supabase
                .from('match_players')
                .select(`
                    *,
                    match:matches (*)
                `)
                .eq('user_id', this.autodartsUserId);
            
            if (error) throw error;
            
            // Get opponent data for each match
            const matchIds = myMatches.map(m => m.match_id);
            
            const { data: allPlayers } = await supabase
                .from('match_players')
                .select('*')
                .in('match_id', matchIds)
                .neq('user_id', this.autodartsUserId);
            
            // Group by opponent
            const opponents = {};
            
            myMatches.forEach(mp => {
                const match = mp.match;
                if (!match) return;
                
                // Find opponent in this match
                const opponent = allPlayers?.find(p => 
                    p.match_id === match.id && p.user_id !== this.autodartsUserId
                );
                
                const opponentName = opponent?.name || (opponent?.is_bot ? `Bot Level ${opponent.cpu_ppr / 10}` : 'Unbekannt');
                const opponentKey = opponent?.user_id || opponentName;
                
                if (!opponents[opponentKey]) {
                    opponents[opponentKey] = {
                        name: opponentName,
                        matches: 0,
                        wins: 0,
                        lastMatch: null
                    };
                }
                
                opponents[opponentKey].matches++;
                if (match.winner === mp.player_index) {
                    opponents[opponentKey].wins++;
                }
                
                const matchDate = new Date(match.finished_at);
                if (!opponents[opponentKey].lastMatch || matchDate > opponents[opponentKey].lastMatch) {
                    opponents[opponentKey].lastMatch = matchDate;
                }
            });
            
            this.renderOpponents(Object.values(opponents));
            
        } catch (error) {
            console.error('Error loading opponents:', error);
        } finally {
            this.hideLoading();
        }
    }
    
    renderOpponents(opponents) {
        const tbody = document.querySelector('#opponents-table tbody');
        if (!tbody) return;
        
        // Sort by number of matches
        opponents.sort((a, b) => b.matches - a.matches);
        
        tbody.innerHTML = opponents.map(opp => {
            const winRate = ((opp.wins / opp.matches) * 100).toFixed(1);
            
            return `
                <tr>
                    <td>${opp.name}</td>
                    <td>${opp.matches}</td>
                    <td>${opp.wins}</td>
                    <td class="${parseFloat(winRate) >= 50 ? 'result-win' : 'result-loss'}">${winRate}%</td>
                    <td>${opp.lastMatch?.toLocaleDateString('de-DE') || '-'}</td>
                </tr>
            `;
        }).join('');
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = new AutodartsStats();
});
