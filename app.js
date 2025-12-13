// =====================================================
// AUTODARTS STATS PRO v3.0 - Full Feature Edition
// =====================================================

class AutodartsStats {
    constructor() {
        this.user = null;
        this.currentPlayerId = null;
        this.allPlayers = [];
        this.allMatchPlayers = [];
        this.allMatches = [];
        this.opponentMap = {};
        this.turnsCache = {};
        this.throwsCache = {};
        this.overallAverage = 0;
        this.filters = { player: '', time: 'all', type: '', variant: 'X01' };
        this.init();
    }
    
    async init() {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
            await this.handleAuthSuccess(session.user);
        } else {
            const hashParams = new URLSearchParams(window.location.hash.substring(1));
            if (hashParams.get('access_token')) {
                const { data: { session: newSession } } = await supabase.auth.getSession();
                if (newSession) {
                    await this.handleAuthSuccess(newSession.user);
                    window.history.replaceState({}, document.title, window.location.pathname);
                }
            }
        }
        supabase.auth.onAuthStateChange(async (event, session) => {
            if (event === 'SIGNED_IN' && session) await this.handleAuthSuccess(session.user);
            else if (event === 'SIGNED_OUT') this.showLoginScreen();
        });
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        document.getElementById('send-magic-link')?.addEventListener('click', () => this.sendMagicLink());
        document.getElementById('email-input')?.addEventListener('keypress', (e) => { if (e.key === 'Enter') this.sendMagicLink(); });
        document.getElementById('logout-btn')?.addEventListener('click', () => this.logout());
        document.querySelectorAll('.nav-btn').forEach(btn => btn.addEventListener('click', () => this.navigateTo(btn.dataset.page)));
        document.getElementById('apply-filters')?.addEventListener('click', () => this.applyFilters());
        document.getElementById('heatmap-target')?.addEventListener('change', () => this.loadHeatmapData());
        document.getElementById('global-filter-player')?.addEventListener('change', (e) => this.switchPlayer(e.target.value));
    }
    
    async switchPlayer(playerId) {
        if (playerId === this.currentPlayerId) return;
        this.currentPlayerId = playerId;
        this.turnsCache = {};
        this.throwsCache = {};
        await this.loadPlayerData(playerId);
        this.applyFilters();
    }
    
    applyFilters() {
        this.filters.time = document.getElementById('global-filter-time').value;
        this.filters.type = document.getElementById('global-filter-type').value;
        this.filters.variant = document.getElementById('global-filter-variant').value;
        const activePage = document.querySelector('.nav-btn.active')?.dataset.page || 'overview';
        this.navigateTo(activePage);
    }
    
    getFilteredData() {
        let data = this.allMatchPlayers.map(mp => ({
            ...mp,
            match: this.allMatches.find(m => m.id === mp.match_id)
        })).filter(mp => mp.match);
        
        if (this.filters.time !== 'all') {
            const days = parseInt(this.filters.time);
            const cutoff = new Date();
            cutoff.setDate(cutoff.getDate() - days);
            data = data.filter(mp => new Date(mp.match.finished_at) >= cutoff);
        }
        if (this.filters.type) data = data.filter(mp => mp.match.type === this.filters.type);
        if (this.filters.variant) data = data.filter(mp => mp.match.variant === this.filters.variant);
        
        return data.sort((a, b) => new Date(b.match.finished_at) - new Date(a.match.finished_at));
    }
    
    async sendMagicLink() {
        const email = document.getElementById('email-input').value.trim();
        const messageEl = document.getElementById('login-message');
        const button = document.getElementById('send-magic-link');
        if (!email) { messageEl.textContent = 'Bitte Email-Adresse eingeben'; messageEl.className = 'login-message error'; return; }
        button.disabled = true;
        try {
            const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin + window.location.pathname } });
            if (error) throw error;
            messageEl.textContent = '✅ Magic Link gesendet!'; messageEl.className = 'login-message success';
        } catch (error) { messageEl.textContent = '❌ ' + error.message; messageEl.className = 'login-message error'; }
        finally { button.disabled = false; button.innerHTML = '<span>Magic Link senden</span><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>'; }
    }
    
    async handleAuthSuccess(user) {
        this.user = user;
        this.showLoading();
        try {
            // Load all allowed users for player selector
            const { data: players } = await supabase.from('allowed_users').select('*');
            this.allPlayers = players || [];
            
            // Find current user
            const currentUser = this.allPlayers.find(p => p.email === user.email);
            if (!currentUser) { alert('Zugang nicht erlaubt.'); await this.logout(); return; }
            
            this.currentPlayerId = currentUser.autodarts_user_id;
            document.getElementById('user-name').textContent = currentUser.autodarts_username || user.email;
            
            // Populate player selector
            this.populatePlayerSelector(currentUser.autodarts_user_id);
            
            // Set default filter
            document.getElementById('global-filter-variant').value = 'X01';
            this.filters.variant = 'X01';
            
            await this.loadPlayerData(this.currentPlayerId);
            this.showDashboard();
            this.navigateTo('overview');
        } catch (error) { 
            console.error('Auth error:', error); 
            alert('Fehler: ' + error.message);
        }
        finally { this.hideLoading(); }
    }
    
    populatePlayerSelector(defaultPlayerId) {
        const select = document.getElementById('global-filter-player');
        if (!select) return;
        select.innerHTML = this.allPlayers.map(p => 
            `<option value="${p.autodarts_user_id}" ${p.autodarts_user_id === defaultPlayerId ? 'selected' : ''}>${p.autodarts_username || p.email}</option>`
        ).join('');
    }
    
    async loadPlayerData(playerId) {
        console.log('Loading data for player:', playerId);
        
        const { data: matchPlayers } = await supabase.from('match_players').select('*').eq('user_id', playerId);
        this.allMatchPlayers = matchPlayers || [];
        
        if (this.allMatchPlayers.length === 0) { console.log('No matches found'); return; }
        
        const matchIds = [...new Set(this.allMatchPlayers.map(mp => mp.match_id))];
        
        // Load matches in batches
        this.allMatches = [];
        for (let i = 0; i < matchIds.length; i += 50) {
            const batch = matchIds.slice(i, i + 50);
            const { data } = await supabase.from('matches').select('*').in('id', batch);
            if (data) this.allMatches.push(...data);
        }
        
        // Load opponents
        this.opponentMap = {};
        for (let i = 0; i < matchIds.length; i += 50) {
            const batch = matchIds.slice(i, i + 50);
            const { data } = await supabase.from('match_players').select('*').in('match_id', batch);
            data?.forEach(p => {
                if (p.user_id !== playerId && !this.opponentMap[p.match_id]) this.opponentMap[p.match_id] = p;
            });
        }
        
        // Calculate overall average for comparison
        const avgs = this.allMatchPlayers.filter(mp => mp.average > 0).map(mp => mp.average);
        this.overallAverage = avgs.length > 0 ? avgs.reduce((a,b) => a+b, 0) / avgs.length : 0;
        
        console.log('Loaded:', this.allMatchPlayers.length, 'match_players,', this.allMatches.length, 'matches');
    }
    
    async loadTurnsForMatches(mpIds) {
        if (mpIds.length === 0) return [];
        const cacheKey = mpIds.slice(0, 5).join('-');
        if (this.turnsCache[cacheKey]) return this.turnsCache[cacheKey];
        
        let allTurns = [];
        for (let i = 0; i < mpIds.length; i += 50) {
            const batch = mpIds.slice(i, i + 50);
            const { data } = await supabase.from('turns').select('id, points, round, match_player_id, created_at, score_remaining').in('match_player_id', batch);
            if (data) allTurns.push(...data);
        }
        this.turnsCache[cacheKey] = allTurns;
        return allTurns;
    }
    
    async loadThrowsForTurns(turnIds, limit = 5000) {
        if (turnIds.length === 0) return [];
        const limitedIds = turnIds.slice(0, limit);
        
        let allThrows = [];
        for (let i = 0; i < limitedIds.length; i += 100) {
            const batch = limitedIds.slice(i, i + 100);
            const { data } = await supabase.from('throws').select('*').in('turn_id', batch);
            if (data) allThrows.push(...data);
        }
        return allThrows;
    }
    
    async logout() { await supabase.auth.signOut(); this.showLoginScreen(); }
    showLoginScreen() { document.getElementById('login-screen').classList.remove('hidden'); document.getElementById('dashboard-screen').classList.add('hidden'); }
    showDashboard() { document.getElementById('login-screen').classList.add('hidden'); document.getElementById('dashboard-screen').classList.remove('hidden'); }
    showLoading() { document.getElementById('loading-overlay')?.classList.remove('hidden'); }
    hideLoading() { document.getElementById('loading-overlay')?.classList.add('hidden'); }
    
    navigateTo(page) {
        document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.page === page));
        document.querySelectorAll('.page').forEach(p => p.classList.toggle('active', p.id === 'page-' + page));
        switch (page) {
            case 'overview': this.loadOverviewData(); break;
            case 'scoring': this.loadScoringData(); break;
            case 'checkout': this.loadCheckoutData(); break;
            case 'matches': this.loadMatchesPage(); break;
            case 'heatmap': this.loadHeatmapData(); break;
            case 'opponents': this.loadOpponentsData(); break;
            case 'advanced': this.loadAdvancedData(); break;
        }
    }

    // =====================================================
    // OVERVIEW PAGE
    // =====================================================
    
    async loadOverviewData() {
        this.showLoading();
        try {
            const matches = this.getFilteredData();
            const mpIds = matches.map(m => m.id);
            
            // Basic stats
            const totalMatches = matches.length;
            let wins = 0, totalCheckoutRate = 0, checkoutCount = 0;
            let bestMatchAvg = 0, bestLegDarts = 999, highestFinish = 0;
            
            matches.forEach(mp => {
                if (mp.match.winner === mp.player_index) wins++;
                if (mp.checkout_rate > 0) { totalCheckoutRate += mp.checkout_rate; checkoutCount++; }
                if (mp.average > bestMatchAvg) bestMatchAvg = mp.average;
            });
            
            // Load turns
            const allTurns = await this.loadTurnsForMatches(mpIds);
            
            // Calculate stats from turns
            let totalPoints = 0, totalTurns = 0, first9Points = 0, first9Turns = 0;
            let count180 = 0, scoringPoints = 0, scoringTurns = 0;
            const avgByMatch = {};
            
            allTurns.forEach(t => {
                if (t.points !== null) {
                    totalPoints += t.points;
                    totalTurns++;
                    if (t.points === 180) count180++;
                    if (t.round <= 3) { first9Points += t.points; first9Turns++; }
                    // Avg bis 100 (score_remaining > 100 bedeutet Scoring-Phase)
                    if (t.score_remaining === null || t.score_remaining > 100) {
                        scoringPoints += t.points;
                        scoringTurns++;
                    }
                    // Per match average
                    if (!avgByMatch[t.match_player_id]) avgByMatch[t.match_player_id] = [];
                    avgByMatch[t.match_player_id].push(t.points);
                }
            });
            
            // Find highest finish from checkout turns
            const checkoutTurns = allTurns.filter(t => t.score_remaining === 0);
            checkoutTurns.forEach(t => { if (t.points > highestFinish) highestFinish = t.points; });
            
            // Calculate consistency (standard deviation)
            const matchAvgs = Object.values(avgByMatch).map(turns => turns.reduce((a,b) => a+b, 0) / turns.length);
            const avgOfAvgs = matchAvgs.reduce((a,b) => a+b, 0) / (matchAvgs.length || 1);
            const variance = matchAvgs.reduce((sum, avg) => sum + Math.pow(avg - avgOfAvgs, 2), 0) / (matchAvgs.length || 1);
            const stdDev = Math.sqrt(variance);
            
            // Calculate trend (last 7 days vs previous 7 days)
            const now = new Date();
            const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
            const twoWeeksAgo = new Date(now - 14 * 24 * 60 * 60 * 1000);
            
            const recentMatches = matches.filter(mp => new Date(mp.match.finished_at) >= weekAgo);
            const previousMatches = matches.filter(mp => {
                const d = new Date(mp.match.finished_at);
                return d >= twoWeeksAgo && d < weekAgo;
            });
            
            const recentAvg = recentMatches.length > 0 ? recentMatches.reduce((s, mp) => s + (mp.average || 0), 0) / recentMatches.length : 0;
            const previousAvg = previousMatches.length > 0 ? previousMatches.reduce((s, mp) => s + (mp.average || 0), 0) / previousMatches.length : 0;
            const trend = previousAvg > 0 ? recentAvg - previousAvg : 0;
            
            // Update UI - Row 1
            const winRate = totalMatches > 0 ? ((wins / totalMatches) * 100).toFixed(1) : 0;
            const avgCheckout = checkoutCount > 0 ? ((totalCheckoutRate / checkoutCount) * 100).toFixed(1) : '-';
            const avgPoints = totalTurns > 0 ? (totalPoints / totalTurns).toFixed(1) : '-';
            const first9Avg = first9Turns > 0 ? (first9Points / first9Turns).toFixed(1) : '-';
            
            document.getElementById('stat-matches').textContent = totalMatches;
            document.getElementById('stat-winrate').textContent = winRate + '%';
            document.getElementById('stat-average').textContent = avgPoints;
            document.getElementById('stat-first9').textContent = first9Avg;
            document.getElementById('stat-checkout').textContent = avgCheckout !== '-' ? avgCheckout + '%' : '-';
            document.getElementById('stat-180s').textContent = count180;
            
            // Update UI - Row 2
            const avgTo100 = scoringTurns > 0 ? (scoringPoints / scoringTurns).toFixed(1) : '-';
            document.getElementById('stat-avg-to-100').textContent = avgTo100;
            document.getElementById('stat-best-leg').textContent = bestLegDarts < 999 ? bestLegDarts + ' Darts' : '-';
            document.getElementById('stat-highest-finish').textContent = highestFinish > 0 ? highestFinish : '-';
            document.getElementById('stat-best-match-avg').textContent = bestMatchAvg > 0 ? bestMatchAvg.toFixed(1) : '-';
            
            const trendEl = document.getElementById('stat-trend');
            if (trend > 0) {
                trendEl.textContent = '↑ +' + trend.toFixed(1);
                trendEl.className = 'stat-value trend-up';
            } else if (trend < 0) {
                trendEl.textContent = '↓ ' + trend.toFixed(1);
                trendEl.className = 'stat-value trend-down';
            } else {
                trendEl.textContent = '→ 0';
                trendEl.className = 'stat-value';
            }
            
            // Consistency: lower is better, show as rating
            const consistencyRating = stdDev < 3 ? 'A+' : stdDev < 5 ? 'A' : stdDev < 7 ? 'B' : stdDev < 10 ? 'C' : 'D';
            document.getElementById('stat-consistency').textContent = consistencyRating + ' (±' + stdDev.toFixed(1) + ')';
            
            // Render charts
            this.renderAvgComparisonChart(matches, allTurns);
            this.renderResultsChart(wins, totalMatches - wins);
            this.renderFirst9ComparisonChart(allTurns);
            this.renderScoringDistributionChart(allTurns);
            this.renderHighScoresChart(allTurns);
            this.renderRecentMatches(matches.slice(0, 10));
            
        } catch (error) {
            console.error('Overview error:', error);
        } finally {
            this.hideLoading();
        }
    }
    
    renderAvgComparisonChart(matches, turns) {
        const ctx = document.getElementById('chart-avg-comparison');
        if (!ctx) return;
        
        // Group turns by match_player_id
        const turnsByMp = {};
        turns.forEach(t => {
            if (t.points !== null) {
                if (!turnsByMp[t.match_player_id]) turnsByMp[t.match_player_id] = { all: [], scoring: [] };
                turnsByMp[t.match_player_id].all.push(t.points);
                if (t.score_remaining === null || t.score_remaining > 100) {
                    turnsByMp[t.match_player_id].scoring.push(t.points);
                }
            }
        });
        
        // Calculate per-match averages
        const matchData = matches.map(mp => {
            const mpData = turnsByMp[mp.id] || { all: [], scoring: [] };
            return {
                date: new Date(mp.match.finished_at),
                avgAll: mpData.all.length > 0 ? mpData.all.reduce((a, b) => a + b, 0) / mpData.all.length : null,
                avgScoring: mpData.scoring.length > 0 ? mpData.scoring.reduce((a, b) => a + b, 0) / mpData.scoring.length : null
            };
        }).filter(m => m.avgAll !== null).sort((a, b) => a.date - b.date);
        
        // Aggregate by month if > 6 months of data
        const firstDate = matchData[0]?.date || new Date();
        const lastDate = matchData[matchData.length - 1]?.date || new Date();
        const daysDiff = Math.ceil((lastDate - firstDate) / (1000 * 60 * 60 * 24));
        
        let dataPoints = [];
        if (daysDiff > 180) {
            const byMonth = {};
            matchData.forEach(m => {
                const key = m.date.toISOString().substring(0, 7);
                if (!byMonth[key]) byMonth[key] = { all: [], scoring: [] };
                byMonth[key].all.push(m.avgAll);
                if (m.avgScoring) byMonth[key].scoring.push(m.avgScoring);
            });
            dataPoints = Object.entries(byMonth).sort((a,b) => a[0].localeCompare(b[0])).map(([month, data]) => ({
                label: new Date(month + '-01').toLocaleDateString('de-DE', { month: 'short', year: '2-digit' }),
                avgAll: data.all.reduce((a, b) => a + b, 0) / data.all.length,
                avgScoring: data.scoring.length > 0 ? data.scoring.reduce((a, b) => a + b, 0) / data.scoring.length : null
            }));
        } else if (daysDiff > 60) {
            const byWeek = {};
            matchData.forEach(m => {
                const weekStart = new Date(m.date);
                weekStart.setDate(weekStart.getDate() - weekStart.getDay());
                const key = weekStart.toISOString().split('T')[0];
                if (!byWeek[key]) byWeek[key] = { all: [], scoring: [] };
                byWeek[key].all.push(m.avgAll);
                if (m.avgScoring) byWeek[key].scoring.push(m.avgScoring);
            });
            dataPoints = Object.entries(byWeek).sort((a,b) => a[0].localeCompare(b[0])).map(([week, data]) => ({
                label: new Date(week).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }),
                avgAll: data.all.reduce((a, b) => a + b, 0) / data.all.length,
                avgScoring: data.scoring.length > 0 ? data.scoring.reduce((a, b) => a + b, 0) / data.scoring.length : null
            }));
        } else {
            dataPoints = matchData.slice(-30).map(m => ({
                label: m.date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }),
                avgAll: m.avgAll,
                avgScoring: m.avgScoring
            }));
        }
        
        if (this.avgCompChart) this.avgCompChart.destroy();
        this.avgCompChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: dataPoints.map(d => d.label),
                datasets: [
                    {
                        label: 'Avg bis 100 (Scoring)',
                        data: dataPoints.map(d => d.avgScoring?.toFixed(1)),
                        borderColor: CONFIG.COLORS.blue,
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        fill: false,
                        tension: 0.3,
                        pointRadius: 3
                    },
                    {
                        label: 'Match Average',
                        data: dataPoints.map(d => d.avgAll.toFixed(1)),
                        borderColor: CONFIG.COLORS.green,
                        backgroundColor: 'rgba(16, 185, 129, 0.1)',
                        fill: true,
                        tension: 0.3,
                        pointRadius: 3
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'top', labels: { color: '#94a3b8' } } },
                scales: {
                    x: { grid: { color: 'rgba(255,255,255,0.1)' }, ticks: { color: '#94a3b8', maxRotation: 45, font: { size: 10 } } },
                    y: { grid: { color: 'rgba(255,255,255,0.1)' }, ticks: { color: '#94a3b8' }, suggestedMin: 30, suggestedMax: 55 }
                }
            }
        });
    }
    
    renderResultsChart(wins, losses) {
        const ctx = document.getElementById('chart-results');
        if (!ctx) return;
        if (this.resultsChart) this.resultsChart.destroy();
        this.resultsChart = new Chart(ctx, {
            type: 'doughnut',
            data: { labels: ['Siege', 'Niederlagen'], datasets: [{ data: [wins, losses], backgroundColor: [CONFIG.COLORS.green, CONFIG.COLORS.red], borderWidth: 0 }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: '#94a3b8' } } }, cutout: '65%' }
        });
    }
    
    renderFirst9ComparisonChart(turns) {
        const ctx = document.getElementById('chart-first9-comparison');
        if (!ctx) return;
        
        let first9Total = 0, first9Count = 0, restTotal = 0, restCount = 0;
        turns.forEach(t => {
            if (t.points !== null) {
                if (t.round <= 3) { first9Total += t.points; first9Count++; }
                else { restTotal += t.points; restCount++; }
            }
        });
        
        if (this.first9Chart) this.first9Chart.destroy();
        this.first9Chart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['First 9', 'Rest of Leg'],
                datasets: [{ data: [first9Count > 0 ? (first9Total/first9Count).toFixed(1) : 0, restCount > 0 ? (restTotal/restCount).toFixed(1) : 0], backgroundColor: [CONFIG.COLORS.green, CONFIG.COLORS.blue], borderRadius: 8 }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { display: false }, ticks: { color: '#94a3b8' } }, y: { grid: { color: 'rgba(255,255,255,0.1)' }, ticks: { color: '#94a3b8' }, suggestedMin: 30, suggestedMax: 50 } } }
        });
    }
    
    renderScoringDistributionChart(turns) {
        const ctx = document.getElementById('chart-scoring-distribution');
        if (!ctx) return;
        let u40 = 0, s40 = 0, s60 = 0, s100 = 0, s140 = 0, s180 = 0;
        turns.forEach(t => { if (t.points === null) return; if (t.points === 180) s180++; else if (t.points >= 140) s140++; else if (t.points >= 100) s100++; else if (t.points >= 60) s60++; else if (t.points >= 40) s40++; else u40++; });
        if (this.scoringChart) this.scoringChart.destroy();
        this.scoringChart = new Chart(ctx, {
            type: 'doughnut',
            data: { labels: ['<40', '40-59', '60-99', '100-139', '140-179', '180'], datasets: [{ data: [u40, s40, s60, s100, s140, s180], backgroundColor: ['#64748b', '#94a3b8', '#3b82f6', '#8b5cf6', '#f59e0b', '#10b981'], borderWidth: 0 }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { color: '#94a3b8', font: { size: 11 } } } }, cutout: '50%' }
        });
    }
    
    renderHighScoresChart(turns) {
        const ctx = document.getElementById('chart-high-scores');
        if (!ctx) return;
        const monthly = {};
        turns.forEach(t => { if (t.points === null || !t.created_at) return; const m = t.created_at.substring(0, 7); if (!monthly[m]) monthly[m] = { s180: 0, s140: 0, s100: 0 }; if (t.points === 180) monthly[m].s180++; else if (t.points >= 140) monthly[m].s140++; else if (t.points >= 100) monthly[m].s100++; });
        const months = Object.keys(monthly).sort().slice(-8);
        if (this.highScoresChart) this.highScoresChart.destroy();
        this.highScoresChart = new Chart(ctx, {
            type: 'bar',
            data: { labels: months.map(m => new Date(m + '-01').toLocaleDateString('de-DE', { month: 'short' })), datasets: [{ label: '180s', data: months.map(m => monthly[m].s180), backgroundColor: CONFIG.COLORS.green }, { label: '140+', data: months.map(m => monthly[m].s140), backgroundColor: CONFIG.COLORS.yellow }, { label: '100+', data: months.map(m => monthly[m].s100), backgroundColor: CONFIG.COLORS.blue }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top', labels: { color: '#94a3b8', font: { size: 10 } } } }, scales: { x: { stacked: true, grid: { display: false }, ticks: { color: '#94a3b8' } }, y: { stacked: true, grid: { color: 'rgba(255,255,255,0.1)' }, ticks: { color: '#94a3b8' } } } }
        });
    }
    
    renderRecentMatches(matches) {
        const tbody = document.querySelector('#recent-matches-table tbody');
        if (!tbody) return;
        tbody.innerHTML = matches.map(mp => {
            const match = mp.match, date = new Date(match.finished_at), isWin = match.winner === mp.player_index;
            const opp = this.opponentMap[mp.match_id];
            const oppName = opp ? (opp.is_bot ? '🤖 Bot Lvl ' + Math.round((opp.cpu_ppr || 40) / 10) : opp.name || 'Gegner') : 'Unbekannt';
            const avg = mp.average || 0;
            const perfClass = avg > this.overallAverage + 5 ? 'perf-great' : avg > this.overallAverage ? 'perf-good' : avg > this.overallAverage - 5 ? 'perf-ok' : 'perf-bad';
            const perfText = avg > this.overallAverage + 5 ? '🔥 Super' : avg > this.overallAverage ? '✅ Gut' : avg > this.overallAverage - 5 ? '➖ Ok' : '❌ Schwach';
            return '<tr><td>' + date.toLocaleDateString('de-DE') + '</td><td>' + oppName + '</td><td class="' + (isWin ? 'result-win' : 'result-loss') + '">' + (isWin ? '✅' : '❌') + '</td><td>' + (avg > 0 ? avg.toFixed(1) : '-') + '</td><td class="' + perfClass + '">' + perfText + '</td><td><span class="badge badge-' + (match.type || 'online').toLowerCase() + '">' + (match.type || 'Online') + '</span></td></tr>';
        }).join('');
    }

    // =====================================================
    // SCORING PAGE
    // =====================================================
    
    async loadScoringData() {
        this.showLoading();
        try {
            const matches = this.getFilteredData();
            const mpIds = matches.map(m => m.id);
            const allTurns = await this.loadTurnsForMatches(mpIds);
            const turnIds = allTurns.map(t => t.id);
            const allThrows = await this.loadThrowsForTurns(turnIds);
            
            // T20 analysis
            const t20Area = allThrows.filter(t => [20, 1, 5].includes(t.segment_number));
            const t20Hits = t20Area.filter(t => t.segment_bed === 'Triple' && t.segment_number === 20).length;
            const t20Rate = t20Area.length > 0 ? ((t20Hits / t20Area.length) * 100).toFixed(1) : 0;
            
            // T19 analysis
            const t19Area = allThrows.filter(t => [19, 3, 7].includes(t.segment_number));
            const t19Hits = t19Area.filter(t => t.segment_bed === 'Triple' && t.segment_number === 19).length;
            const t19Rate = t19Area.length > 0 ? ((t19Hits / t19Area.length) * 100).toFixed(1) : 0;
            
            let c100 = 0, c140 = 0, c180 = 0;
            allTurns.forEach(t => { if (t.points === 180) c180++; else if (t.points >= 140) c140++; else if (t.points >= 100) c100++; });
            
            const totalVisits = allTurns.length;
            const highPer100 = totalVisits > 0 ? ((c100 + c140 + c180) / totalVisits * 100).toFixed(1) : 0;
            
            document.getElementById('stat-t20-rate').textContent = t20Rate + '%';
            document.getElementById('stat-t19-rate').textContent = t19Rate + '%';
            document.getElementById('stat-100plus').textContent = c100 + c140 + c180;
            document.getElementById('stat-140plus').textContent = c140 + c180;
            document.getElementById('stat-180s-total').textContent = c180;
            document.getElementById('stat-visits-per-100').textContent = highPer100 + '%';
            
            this.renderT20T19Chart(t20Area, t19Area);
            this.renderScoreFreqChart(allTurns);
            this.renderFirst9TrendChart(matches, allTurns);
            this.renderVisitsBreakdownChart(allTurns);
            
        } catch (error) { console.error('Scoring error:', error); }
        finally { this.hideLoading(); }
    }
    
    renderT20T19Chart(t20Area, t19Area) {
        const ctx = document.getElementById('chart-t20-distribution');
        if (!ctx) return;
        
        const countT20 = { 'T20': 0, 'S20': 0, 'T5': 0, 'S5': 0, 'T1': 0, 'S1': 0 };
        t20Area.forEach(t => {
            if (t.segment_bed === 'Triple' && t.segment_number === 20) countT20['T20']++;
            else if (t.segment_number === 20) countT20['S20']++;
            else if (t.segment_bed === 'Triple' && t.segment_number === 5) countT20['T5']++;
            else if (t.segment_number === 5) countT20['S5']++;
            else if (t.segment_bed === 'Triple' && t.segment_number === 1) countT20['T1']++;
            else if (t.segment_number === 1) countT20['S1']++;
        });
        
        const countT19 = { 'T19': 0, 'S19': 0, 'T7': 0, 'S7': 0, 'T3': 0, 'S3': 0 };
        t19Area.forEach(t => {
            if (t.segment_bed === 'Triple' && t.segment_number === 19) countT19['T19']++;
            else if (t.segment_number === 19) countT19['S19']++;
            else if (t.segment_bed === 'Triple' && t.segment_number === 7) countT19['T7']++;
            else if (t.segment_number === 7) countT19['S7']++;
            else if (t.segment_bed === 'Triple' && t.segment_number === 3) countT19['T3']++;
            else if (t.segment_number === 3) countT19['S3']++;
        });
        
        if (this.t20Chart) this.t20Chart.destroy();
        this.t20Chart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Triple', 'Single (Ziel)', 'Triple (Nachbar)', 'Single (Nachbar)'],
                datasets: [
                    { label: 'T20 Bereich', data: [countT20['T20'], countT20['S20'], countT20['T5'] + countT20['T1'], countT20['S5'] + countT20['S1']], backgroundColor: CONFIG.COLORS.green },
                    { label: 'T19 Bereich', data: [countT19['T19'], countT19['S19'], countT19['T7'] + countT19['T3'], countT19['S7'] + countT19['S3']], backgroundColor: CONFIG.COLORS.blue }
                ]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top', labels: { color: '#94a3b8' } } }, scales: { x: { grid: { display: false }, ticks: { color: '#94a3b8' } }, y: { grid: { color: 'rgba(255,255,255,0.1)' }, ticks: { color: '#94a3b8' } } } }
        });
    }
    
    renderScoreFreqChart(turns) {
        const ctx = document.getElementById('chart-score-frequency');
        if (!ctx) return;
        const buckets = { '0-19': 0, '20-39': 0, '40-59': 0, '60-79': 0, '80-99': 0, '100-119': 0, '120-139': 0, '140-159': 0, '160-180': 0 };
        turns.forEach(t => { if (t.points === null) return; const p = t.points; if (p < 20) buckets['0-19']++; else if (p < 40) buckets['20-39']++; else if (p < 60) buckets['40-59']++; else if (p < 80) buckets['60-79']++; else if (p < 100) buckets['80-99']++; else if (p < 120) buckets['100-119']++; else if (p < 140) buckets['120-139']++; else if (p < 160) buckets['140-159']++; else buckets['160-180']++; });
        if (this.scoreFreqChart) this.scoreFreqChart.destroy();
        this.scoreFreqChart = new Chart(ctx, { type: 'bar', data: { labels: Object.keys(buckets), datasets: [{ data: Object.values(buckets), backgroundColor: CONFIG.COLORS.blue, borderRadius: 4 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { display: false }, ticks: { color: '#94a3b8', font: { size: 9 } } }, y: { grid: { color: 'rgba(255,255,255,0.1)' }, ticks: { color: '#94a3b8' } } } } });
    }
    
    renderFirst9TrendChart(matches, turns) {
        const ctx = document.getElementById('chart-first9-trend');
        if (!ctx) return;
        
        const turnsByMp = {};
        turns.filter(t => t.round <= 3 && t.points !== null).forEach(t => {
            if (!turnsByMp[t.match_player_id]) turnsByMp[t.match_player_id] = [];
            turnsByMp[t.match_player_id].push(t.points);
        });
        
        const data = matches.map(mp => ({ date: new Date(mp.match.finished_at), avg: turnsByMp[mp.id]?.length > 0 ? turnsByMp[mp.id].reduce((a,b)=>a+b,0) / turnsByMp[mp.id].length : null })).filter(d => d.avg !== null).sort((a,b) => a.date - b.date).slice(-20);
        
        if (this.first9TrendChart) this.first9TrendChart.destroy();
        this.first9TrendChart = new Chart(ctx, {
            type: 'line',
            data: { labels: data.map(d => d.date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })), datasets: [{ label: 'First 9 Avg', data: data.map(d => d.avg.toFixed(1)), borderColor: CONFIG.COLORS.green, tension: 0.3, fill: true, backgroundColor: 'rgba(16,185,129,0.1)' }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { color: 'rgba(255,255,255,0.1)' }, ticks: { color: '#94a3b8' } }, y: { grid: { color: 'rgba(255,255,255,0.1)' }, ticks: { color: '#94a3b8' }, suggestedMin: 35, suggestedMax: 55 } } }
        });
    }
    
    renderVisitsBreakdownChart(turns) {
        const ctx = document.getElementById('chart-visits-breakdown');
        if (!ctx) return;
        let c60 = 0, c100 = 0, c140 = 0, c180 = 0, other = 0;
        turns.forEach(t => { if (t.points === null) return; if (t.points === 180) c180++; else if (t.points >= 140) c140++; else if (t.points >= 100) c100++; else if (t.points >= 60) c60++; else other++; });
        if (this.visitsChart) this.visitsChart.destroy();
        this.visitsChart = new Chart(ctx, { type: 'doughnut', data: { labels: ['180', '140-179', '100-139', '60-99', '<60'], datasets: [{ data: [c180, c140, c100, c60, other], backgroundColor: ['#10b981', '#f59e0b', '#8b5cf6', '#3b82f6', '#64748b'] }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { color: '#94a3b8' } } } } });
    }

    // =====================================================
    // CHECKOUT PAGE
    // =====================================================
    
    async loadCheckoutData() {
        this.showLoading();
        try {
            const matches = this.getFilteredData();
            const mpIds = matches.map(m => m.id);
            
            let totalCheckout = 0, checkoutCount = 0;
            matches.forEach(mp => { if (mp.checkout_rate > 0) { totalCheckout += mp.checkout_rate; checkoutCount++; } });
            
            const allTurns = await this.loadTurnsForMatches(mpIds);
            const checkoutTurns = allTurns.filter(t => t.score_remaining === 0);
            const checkoutTurnIds = checkoutTurns.map(t => t.id);
            
            const checkoutThrows = await this.loadThrowsForTurns(checkoutTurnIds, 10000);
            const doubleThrows = checkoutThrows.filter(t => t.segment_bed === 'Double');
            
            // Count by double
            const doubleCount = {};
            doubleThrows.forEach(t => { doubleCount[t.segment_name] = (doubleCount[t.segment_name] || 0) + 1; });
            const sorted = Object.entries(doubleCount).sort((a, b) => b[1] - a[1]);
            
            const highest = Math.max(...checkoutTurns.map(t => t.points || 0), 0);
            
            document.getElementById('stat-checkout-total').textContent = checkoutCount > 0 ? ((totalCheckout / checkoutCount) * 100).toFixed(1) + '%' : '-';
            document.getElementById('stat-favorite-double').textContent = sorted[0]?.[0] || '-';
            document.getElementById('stat-highest-checkout').textContent = highest > 0 ? highest : '-';
            document.getElementById('stat-total-checkouts').textContent = checkoutTurns.length;
            document.getElementById('stat-checkout-opportunities').textContent = '-'; // Would need more data
            document.getElementById('stat-best-double').textContent = sorted[0]?.[0] || '-';
            
            this.renderDoublesChart(sorted.slice(0, 10));
            this.renderCheckoutScoreChart(checkoutTurns);
            this.renderCheckoutTable(sorted);
            
        } catch (error) { console.error('Checkout error:', error); }
        finally { this.hideLoading(); }
    }
    
    renderDoublesChart(doubles) {
        const ctx = document.getElementById('chart-favorite-doubles');
        if (!ctx) return;
        if (this.doublesChart) this.doublesChart.destroy();
        this.doublesChart = new Chart(ctx, { type: 'bar', data: { labels: doubles.map(d => d[0]), datasets: [{ data: doubles.map(d => d[1]), backgroundColor: CONFIG.COLORS.green, borderRadius: 6 }] }, options: { responsive: true, maintainAspectRatio: false, indexAxis: 'y', plugins: { legend: { display: false } }, scales: { x: { grid: { color: 'rgba(255,255,255,0.1)' }, ticks: { color: '#94a3b8' } }, y: { grid: { display: false }, ticks: { color: '#94a3b8' } } } } });
    }
    
    renderCheckoutScoreChart(checkoutTurns) {
        const ctx = document.getElementById('chart-checkout-by-score');
        if (!ctx) return;
        const ranges = { '2-40': 0, '41-60': 0, '61-80': 0, '81-100': 0, '101-120': 0, '121+': 0 };
        checkoutTurns.forEach(c => { const s = c.points; if (!s) return; if (s <= 40) ranges['2-40']++; else if (s <= 60) ranges['41-60']++; else if (s <= 80) ranges['61-80']++; else if (s <= 100) ranges['81-100']++; else if (s <= 120) ranges['101-120']++; else ranges['121+']++; });
        if (this.checkoutScoreChart) this.checkoutScoreChart.destroy();
        this.checkoutScoreChart = new Chart(ctx, { type: 'bar', data: { labels: Object.keys(ranges), datasets: [{ data: Object.values(ranges), backgroundColor: CONFIG.COLORS.blue, borderRadius: 6 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { display: false }, ticks: { color: '#94a3b8' } }, y: { grid: { color: 'rgba(255,255,255,0.1)' }, ticks: { color: '#94a3b8' } } } } });
    }
    
    renderCheckoutTable(doubles) {
        const tbody = document.querySelector('#checkout-table tbody');
        if (!tbody) return;
        const total = doubles.reduce((s, d) => s + d[1], 0) || 1;
        tbody.innerHTML = doubles.slice(0, 15).map(d => '<tr><td><strong>' + d[0] + '</strong></td><td>' + d[1] + '</td><td>-</td><td>' + ((d[1]/total)*100).toFixed(1) + '%</td></tr>').join('');
    }
match.winner === mp.player_index;
                const key = opp.is_bot ? '🤖 Bot Lvl ' + Math.round((opp.cpu_ppr || 40) / 10) : (opp.name || opp.id);
                
                if (!oppStats[key]) oppStats[key] = { name: key, matches: 0, wins: 0, lastMatch: null, isBot: opp.is_bot, myAvgSum: 0, oppAvgSum: 0, botLevel: opp.is_bot ? Math.round((opp.cpu_ppr || 40) / 10) : 0 };
                oppStats[key].matches++;
                if (isWin) oppStats[key].wins++;
                if (!oppStats[key].lastMatch || mp.match.finished_at > oppStats[key].lastMatch) oppStats[key].lastMatch = mp.match.finished_at;
                if (mp.average > 0) { oppStats[key].myAvgSum += mp.average; }
                if (opp.average > 0) { oppStats[key].oppAvgSum += opp.average; }
                
                if (opp.is_bot) { botTotal++; if (isWin) botWins++; }
                else { humanTotal++; if (isWin) humanWins++; }
                
                if (mp.average > 0 && opp.average > 0) { myAvgSum += mp.average; oppAvgSum += opp.average; avgCount++; }
            });
            
            const sortedOpps = Object.values(oppStats).sort((a, b) => b.matches - a.matches);
            const nemesis = sortedOpps.filter(o => o.matches >= 3 && (o.wins / o.matches) < 0.5).sort((a, b) => (a.wins/a.matches) - (b.wins/b.matches))[0];
            const victim = sortedOpps.filter(o => o.matches >= 3 && (o.wins / o.matches) > 0.5).sort((a, b) => (b.wins/b.matches) - (a.wins/a.matches))[0];
            
            const avgDiff = avgCount > 0 ? ((myAvgSum - oppAvgSum) / avgCount).toFixed(1) : '-';
            
            document.getElementById('stat-unique-opponents').textContent = sortedOpps.filter(o => !o.isBot).length;
            document.getElementById('stat-vs-bots').textContent = botTotal > 0 ? ((botWins/botTotal)*100).toFixed(0) + '%' : '-';
            document.getElementById('stat-vs-humans').textContent = humanTotal > 0 ? ((humanWins/humanTotal)*100).toFixed(0) + '%' : '-';
            document.getElementById('stat-nemesis').textContent = nemesis?.name || '-';
            document.getElementById('stat-favorite-victim').textContent = victim?.name || '-';
            document.getElementById('stat-avg-vs-opponents').textContent = avgDiff !== '-' ? (avgDiff > 0 ? '+' : '') + avgDiff : '-';
            
            this.renderWinRateByBotLevel(sortedOpps);
            this.renderTopOpponentsChart(sortedOpps.slice(0, 8));
            this.renderOpponentsTable(sortedOpps);
            
        } catch (error) { console.error('Opponents error:', error); }
        finally { this.hideLoading(); }
    }
    
    renderWinRateByBotLevel(opps) {
        const ctx = document.getElementById('chart-winrate-by-bot-level');
        if (!ctx) return;
        
        const byLevel = {};
        opps.filter(o => o.isBot).forEach(o => {
            const lvl = o.botLevel;
            if (!byLevel[lvl]) byLevel[lvl] = { wins: 0, total: 0 };
            byLevel[lvl].wins += o.wins;
            byLevel[lvl].total += o.matches;
        });
        
        const levels = Object.keys(byLevel).sort((a, b) => a - b);
        const winRates = levels.map(lvl => byLevel[lvl].total > 0 ? ((byLevel[lvl].wins / byLevel[lvl].total) * 100).toFixed(0) : 0);
        
        if (this.botLevelChart) this.botLevelChart.destroy();
        this.botLevelChart = new Chart(ctx, {
            type: 'bar',
            data: { labels: levels.map(l => 'Lvl ' + l), datasets: [{ label: 'Win %', data: winRates, backgroundColor: levels.map(l => winRates[levels.indexOf(l)] >= 50 ? CONFIG.COLORS.green : CONFIG.COLORS.red), borderRadius: 6 }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { display: false }, ticks: { color: '#94a3b8' } }, y: { grid: { color: 'rgba(255,255,255,0.1)' }, ticks: { color: '#94a3b8' }, max: 100 } } }
        });
    }
    
    renderTopOpponentsChart(opps) {
        const ctx = document.getElementById('chart-top-opponents');
        if (!ctx) return;
        if (this.topOppsChart) this.topOppsChart.destroy();
        this.topOppsChart = new Chart(ctx, {
            type: 'bar',
            data: { labels: opps.map(o => o.name.substring(0, 15)), datasets: [{ label: 'Siege', data: opps.map(o => o.wins), backgroundColor: CONFIG.COLORS.green }, { label: 'Niederlagen', data: opps.map(o => o.matches - o.wins), backgroundColor: CONFIG.COLORS.red }] },
            options: { responsive: true, maintainAspectRatio: false, indexAxis: 'y', plugins: { legend: { position: 'top', labels: { color: '#94a3b8' } } }, scales: { x: { stacked: true, grid: { color: 'rgba(255,255,255,0.1)' }, ticks: { color: '#94a3b8' } }, y: { stacked: true, grid: { display: false }, ticks: { color: '#94a3b8', font: { size: 10 } } } } }
        });
    }
    
    renderOpponentsTable(opps) {
        const tbody = document.querySelector('#opponents-table tbody');
        if (!tbody) return;
        tbody.innerHTML = opps.slice(0, 30).map(o => {
            const winRate = ((o.wins / o.matches) * 100).toFixed(0);
            const myAvg = o.matches > 0 ? (o.myAvgSum / o.matches).toFixed(1) : '-';
            const oppAvg = o.matches > 0 ? (o.oppAvgSum / o.matches).toFixed(1) : '-';
            const lastDate = o.lastMatch ? new Date(o.lastMatch).toLocaleDateString('de-DE') : '-';
            return '<tr><td>' + o.name + '</td><td>' + o.matches + '</td><td class="result-win">' + o.wins + '</td><td class="result-loss">' + (o.matches - o.wins) + '</td><td>' + winRate + '%</td><td>' + myAvg + '</td><td>' + oppAvg + '</td><td>' + lastDate + '</td></tr>';
        }).join('');
    }

    // =====================================================
    // ADVANCED ANALYSIS PAGE
    // =====================================================
    
    async loadAdvancedData() {
        this.showLoading();
        try {
            const matches = this.getFilteredData();
            
            // By time of day
            const byHour = {};
            const byDay = {};
            const dayNames = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
            
            let totalLegs = 0, matchCount = 0;
            
            matches.forEach(mp => {
                const d = new Date(mp.match.finished_at);
                const hour = d.getHours();
                const day = d.getDay();
                const timeSlot = hour < 12 ? 'Morgen' : hour < 17 ? 'Nachmittag' : hour < 21 ? 'Abend' : 'Nacht';
                
                if (!byHour[timeSlot]) byHour[timeSlot] = { wins: 0, total: 0, avgSum: 0 };
                byHour[timeSlot].total++;
                if (mp.match.winner === mp.player_index) byHour[timeSlot].wins++;
                if (mp.average > 0) byHour[timeSlot].avgSum += mp.average;
                
                if (!byDay[day]) byDay[day] = { wins: 0, total: 0, avgSum: 0 };
                byDay[day].total++;
                if (mp.match.winner === mp.player_index) byDay[day].wins++;
                if (mp.average > 0) byDay[day].avgSum += mp.average;
                
                totalLegs += (mp.legs_won || 0) + (mp.legs_lost || 0);
                matchCount++;
            });
            
            // Find best time/day
            let bestTime = '-', bestDay = '-', bestTimeAvg = 0, bestDayAvg = 0;
            Object.entries(byHour).forEach(([time, data]) => {
                const avg = data.total > 0 ? data.avgSum / data.total : 0;
                if (avg > bestTimeAvg && data.total >= 5) { bestTimeAvg = avg; bestTime = time; }
            });
            Object.entries(byDay).forEach(([day, data]) => {
                const avg = data.total > 0 ? data.avgSum / data.total : 0;
                if (avg > bestDayAvg && data.total >= 5) { bestDayAvg = avg; bestDay = dayNames[day]; }
            });
            
            document.getElementById('stat-best-time').textContent = bestTime;
            document.getElementById('stat-best-day').textContent = bestDay;
            document.getElementById('stat-avg-legs').textContent = matchCount > 0 ? (totalLegs / matchCount).toFixed(1) : '-';
            document.getElementById('stat-total-playtime').textContent = matchCount > 0 ? Math.round(matchCount * 8) + ' min' : '-'; // Estimate 8 min per match
            
            this.renderByTimeChart(byHour);
            this.renderByWeekdayChart(byDay, dayNames);
            this.renderLegsTrendChart(matches);
            this.renderConsistencyTrendChart(matches);
            
        } catch (error) { console.error('Advanced error:', error); }
        finally { this.hideLoading(); }
    }
    
    renderByTimeChart(byHour) {
        const ctx = document.getElementById('chart-by-time');
        if (!ctx) return;
        const times = ['Morgen', 'Nachmittag', 'Abend', 'Nacht'];
        const avgs = times.map(t => byHour[t]?.total > 0 ? (byHour[t].avgSum / byHour[t].total).toFixed(1) : 0);
        const winRates = times.map(t => byHour[t]?.total > 0 ? ((byHour[t].wins / byHour[t].total) * 100).toFixed(0) : 0);
        
        if (this.byTimeChart) this.byTimeChart.destroy();
        this.byTimeChart = new Chart(ctx, {
            type: 'bar',
            data: { labels: times, datasets: [{ label: 'Avg', data: avgs, backgroundColor: CONFIG.COLORS.green, yAxisID: 'y' }, { label: 'Win %', data: winRates, backgroundColor: CONFIG.COLORS.blue, yAxisID: 'y1' }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top', labels: { color: '#94a3b8' } } }, scales: { x: { grid: { display: false }, ticks: { color: '#94a3b8' } }, y: { type: 'linear', position: 'left', grid: { color: 'rgba(255,255,255,0.1)' }, ticks: { color: '#94a3b8' }, suggestedMin: 30, suggestedMax: 50 }, y1: { type: 'linear', position: 'right', grid: { display: false }, ticks: { color: '#94a3b8' }, max: 100 } } }
        });
    }
    
    renderByWeekdayChart(byDay, dayNames) {
        const ctx = document.getElementById('chart-by-weekday');
        if (!ctx) return;
        const days = [1, 2, 3, 4, 5, 6, 0]; // Mo-So
        const avgs = days.map(d => byDay[d]?.total > 0 ? (byDay[d].avgSum / byDay[d].total).toFixed(1) : 0);
        
        if (this.byWeekdayChart) this.byWeekdayChart.destroy();
        this.byWeekdayChart = new Chart(ctx, {
            type: 'bar',
            data: { labels: days.map(d => dayNames[d]), datasets: [{ label: 'Avg', data: avgs, backgroundColor: CONFIG.COLORS.green, borderRadius: 6 }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { display: false }, ticks: { color: '#94a3b8' } }, y: { grid: { color: 'rgba(255,255,255,0.1)' }, ticks: { color: '#94a3b8' }, suggestedMin: 30, suggestedMax: 50 } } }
        });
    }
    
    renderLegsTrendChart(matches) {
        const ctx = document.getElementById('chart-legs-trend');
        if (!ctx) return;
        
        const data = matches.slice(0, 30).reverse().map(mp => ({
            label: new Date(mp.match.finished_at).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }),
            legs: (mp.legs_won || 0) + (mp.legs_lost || 0)
        }));
        
        if (this.legsTrendChart) this.legsTrendChart.destroy();
        this.legsTrendChart = new Chart(ctx, {
            type: 'line',
            data: { labels: data.map(d => d.label), datasets: [{ label: 'Legs', data: data.map(d => d.legs), borderColor: CONFIG.COLORS.blue, tension: 0.3, fill: false }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { color: 'rgba(255,255,255,0.1)' }, ticks: { color: '#94a3b8', font: { size: 9 } } }, y: { grid: { color: 'rgba(255,255,255,0.1)' }, ticks: { color: '#94a3b8' } } } }
        });
    }
    
    renderConsistencyTrendChart(matches) {
        const ctx = document.getElementById('chart-consistency-trend');
        if (!ctx) return;
        
        // Calculate rolling std dev over last 10 matches
        const sorted = [...matches].sort((a, b) => new Date(a.match.finished_at) - new Date(b.match.finished_at));
        const data = [];
        
        for (let i = 9; i < sorted.length; i++) {
            const window = sorted.slice(i - 9, i + 1);
            const avgs = window.filter(m => m.average > 0).map(m => m.average);
            if (avgs.length > 0) {
                const mean = avgs.reduce((a, b) => a + b, 0) / avgs.length;
                const variance = avgs.reduce((sum, avg) => sum + Math.pow(avg - mean, 2), 0) / avgs.length;
                const stdDev = Math.sqrt(variance);
                data.push({ date: new Date(sorted[i].match.finished_at), stdDev });
            }
        }
        
        const recentData = data.slice(-20);
        
        if (this.consistencyChart) this.consistencyChart.destroy();
        this.consistencyChart = new Chart(ctx, {
            type: 'line',
            data: { labels: recentData.map(d => d.date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })), datasets: [{ label: 'Std Dev (niedriger = konstanter)', data: recentData.map(d => d.stdDev.toFixed(1)), borderColor: CONFIG.COLORS.yellow, tension: 0.3, fill: true, backgroundColor: 'rgba(245, 158, 11, 0.1)' }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { color: 'rgba(255,255,255,0.1)' }, ticks: { color: '#94a3b8', font: { size: 9 } } }, y: { grid: { color: 'rgba(255,255,255,0.1)' }, ticks: { color: '#94a3b8' }, reverse: true } } }
        });
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', function() { new AutodartsStats(); });
