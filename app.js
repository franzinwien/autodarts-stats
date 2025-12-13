// =====================================================
// AUTODARTS STATS PRO - v2.3 Debug Version
// =====================================================

class AutodartsStats {
    constructor() {
        this.user = null;
        this.autodartsUserId = null;
        this.allMatchPlayers = [];
        this.allMatches = [];
        this.opponentMap = {};
        this.filters = { time: 'all', type: '', variant: '' };
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
            // Get allowed user info
            const { data: allowedUser, error: auError } = await supabase.from('allowed_users').select('*').eq('email', user.email).single();
            console.log('Allowed user:', allowedUser, 'Error:', auError);
            
            if (auError || !allowedUser) { alert('Zugang nicht erlaubt.'); await this.logout(); return; }
            
            this.autodartsUserId = allowedUser.autodarts_user_id;
            document.getElementById('user-name').textContent = allowedUser.autodarts_username || user.email;
            
            console.log('User ID:', this.autodartsUserId);
            
            // Load all base data
            await this.loadAllData();
            
            this.showDashboard();
            this.navigateTo('overview');
        } catch (error) { 
            console.error('Auth error:', error); 
            alert('Fehler: ' + error.message);
        }
        finally { this.hideLoading(); }
    }
    
    async loadAllData() {
        console.log('=== Loading Data ===');
        console.log('User ID:', this.autodartsUserId);
        
        // Step 1: Load match_players
        const { data: matchPlayers, error: mpError } = await supabase
            .from('match_players')
            .select('*')
            .eq('user_id', this.autodartsUserId);
        
        console.log('Match Players loaded:', matchPlayers?.length, 'Error:', mpError);
        
        if (mpError) {
            console.error('match_players error:', mpError);
            return;
        }
        
        this.allMatchPlayers = matchPlayers || [];
        
        if (this.allMatchPlayers.length === 0) {
            console.log('No match players found!');
            return;
        }
        
        // Step 2: Get unique match IDs
        const matchIds = [...new Set(this.allMatchPlayers.map(mp => mp.match_id))];
        console.log('Unique match IDs:', matchIds.length);
        
        // Step 3: Load matches in smaller batches
        this.allMatches = [];
        const batchSize = 50;
        
        for (let i = 0; i < matchIds.length; i += batchSize) {
            const batchIds = matchIds.slice(i, i + batchSize);
            console.log('Loading matches batch', i/batchSize + 1, 'of', Math.ceil(matchIds.length/batchSize));
            
            const { data: batchMatches, error: batchError } = await supabase
                .from('matches')
                .select('*')
                .in('id', batchIds);
            
            if (batchError) {
                console.error('Batch error:', batchError);
            } else if (batchMatches) {
                this.allMatches.push(...batchMatches);
            }
        }
        
        console.log('Total matches loaded:', this.allMatches.length);
        
        // Step 4: Load opponents
        this.opponentMap = {};
        for (let i = 0; i < matchIds.length; i += batchSize) {
            const batchIds = matchIds.slice(i, i + batchSize);
            
            const { data: players } = await supabase
                .from('match_players')
                .select('*')
                .in('match_id', batchIds);
            
            players?.forEach(p => {
                if (p.user_id !== this.autodartsUserId && !this.opponentMap[p.match_id]) {
                    this.opponentMap[p.match_id] = p;
                }
            });
        }
        
        console.log('Opponents loaded:', Object.keys(this.opponentMap).length);
        console.log('=== Data Loading Complete ===');
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
        }
    }

    // =====================================================
    // OVERVIEW PAGE
    // =====================================================
    
    async loadOverviewData() {
        this.showLoading();
        try {
            const matches = this.getFilteredData();
            console.log('Filtered matches:', matches.length);
            
            // Basic stats from match_players data
            const totalMatches = matches.length;
            let wins = 0;
            let totalCheckoutRate = 0;
            let checkoutCount = 0;
            
            matches.forEach(mp => {
                if (mp.match.winner === mp.player_index) wins++;
                if (mp.checkout_rate && mp.checkout_rate > 0) {
                    totalCheckoutRate += mp.checkout_rate;
                    checkoutCount++;
                }
            });
            
            const winRate = totalMatches > 0 ? ((wins / totalMatches) * 100).toFixed(1) : 0;
            const avgCheckout = checkoutCount > 0 ? ((totalCheckoutRate / checkoutCount) * 100).toFixed(1) : '-';
            
            // Load turns data
            const mpIds = matches.map(m => m.id);
            let allTurns = [];
            
            if (mpIds.length > 0) {
                // Load turns in batches
                for (let i = 0; i < mpIds.length; i += 50) {
                    const batchIds = mpIds.slice(i, i + 50);
                    const { data: turns, error } = await supabase
                        .from('turns')
                        .select('points, round, match_player_id, created_at')
                        .in('match_player_id', batchIds);
                    
                    if (!error && turns) {
                        allTurns.push(...turns);
                    }
                }
            }
            
            console.log('Turns loaded:', allTurns.length);
            
            // Calculate turn stats
            let totalPoints = 0, totalTurns = 0;
            let first9Points = 0, first9Turns = 0;
            let count180 = 0;
            
            allTurns.forEach(t => {
                if (t.points !== null) {
                    totalPoints += t.points;
                    totalTurns++;
                    if (t.points === 180) count180++;
                    if (t.round <= 3) {
                        first9Points += t.points;
                        first9Turns++;
                    }
                }
            });
            
            const avgPoints = totalTurns > 0 ? (totalPoints / totalTurns).toFixed(1) : '-';
            const first9Avg = first9Turns > 0 ? (first9Points / first9Turns).toFixed(1) : '-';
            
            // Update UI
            document.getElementById('stat-matches').textContent = totalMatches;
            document.getElementById('stat-winrate').textContent = winRate + '%';
            document.getElementById('stat-average').textContent = avgPoints;
            document.getElementById('stat-first9').textContent = first9Avg;
            document.getElementById('stat-checkout').textContent = avgCheckout !== '-' ? avgCheckout + '%' : '-';
            document.getElementById('stat-180s').textContent = count180;
            
            // Render charts
            this.renderAverageChart(matches, allTurns);
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
    
    renderAverageChart(matches, turns) {
        const ctx = document.getElementById('chart-monthly-avg');
        if (!ctx) return;
        
        // Group turns by match_player_id
        const turnsByMp = {};
        turns.forEach(t => {
            if (t.points !== null) {
                if (!turnsByMp[t.match_player_id]) turnsByMp[t.match_player_id] = [];
                turnsByMp[t.match_player_id].push(t.points);
            }
        });
        
        // Calculate per-match averages
        const matchAverages = matches.map(mp => {
            const mpTurns = turnsByMp[mp.id] || [];
            const avg = mpTurns.length > 0 ? mpTurns.reduce((a, b) => a + b, 0) / mpTurns.length : null;
            return { date: new Date(mp.match.finished_at), avg };
        }).filter(m => m.avg !== null).sort((a, b) => a.date - b.date);
        
        // Take last 30 data points
        const dataPoints = matchAverages.slice(-30);
        
        const labels = dataPoints.map(d => d.date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }));
        const data = dataPoints.map(d => d.avg.toFixed(1));
        
        if (this.avgChart) this.avgChart.destroy();
        this.avgChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels,
                datasets: [{
                    label: '3-Dart Average',
                    data,
                    borderColor: CONFIG.COLORS.green,
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    fill: true,
                    tension: 0.3,
                    pointRadius: 4,
                    pointBackgroundColor: CONFIG.COLORS.green
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: { grid: { color: 'rgba(255,255,255,0.1)' }, ticks: { color: '#94a3b8', maxRotation: 45, font: { size: 10 } } },
                    y: { grid: { color: 'rgba(255,255,255,0.1)' }, ticks: { color: '#94a3b8' }, suggestedMin: 25, suggestedMax: 55 }
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
            data: {
                labels: ['Siege', 'Niederlagen'],
                datasets: [{ data: [wins, losses], backgroundColor: [CONFIG.COLORS.green, CONFIG.COLORS.red], borderWidth: 0 }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'bottom', labels: { color: '#94a3b8', padding: 16 } } },
                cutout: '65%'
            }
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
        
        const first9Avg = first9Count > 0 ? (first9Total / first9Count).toFixed(1) : 0;
        const restAvg = restCount > 0 ? (restTotal / restCount).toFixed(1) : 0;
        
        if (this.first9Chart) this.first9Chart.destroy();
        this.first9Chart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['First 9', 'Rest'],
                datasets: [{ data: [first9Avg, restAvg], backgroundColor: [CONFIG.COLORS.green, CONFIG.COLORS.blue], borderRadius: 8 }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: { grid: { display: false }, ticks: { color: '#94a3b8' } },
                    y: { grid: { color: 'rgba(255,255,255,0.1)' }, ticks: { color: '#94a3b8' }, suggestedMin: 30, suggestedMax: 50 }
                }
            }
        });
    }
    
    renderScoringDistributionChart(turns) {
        const ctx = document.getElementById('chart-scoring-distribution');
        if (!ctx) return;
        
        let under40 = 0, s40to59 = 0, s60to99 = 0, s100to139 = 0, s140to179 = 0, s180 = 0;
        turns.forEach(t => {
            if (t.points === null) return;
            if (t.points === 180) s180++;
            else if (t.points >= 140) s140to179++;
            else if (t.points >= 100) s100to139++;
            else if (t.points >= 60) s60to99++;
            else if (t.points >= 40) s40to59++;
            else under40++;
        });
        
        if (this.scoringChart) this.scoringChart.destroy();
        this.scoringChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['<40', '40-59', '60-99', '100-139', '140-179', '180'],
                datasets: [{
                    data: [under40, s40to59, s60to99, s100to139, s140to179, s180],
                    backgroundColor: ['#64748b', '#94a3b8', '#3b82f6', '#8b5cf6', '#f59e0b', '#10b981'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'right', labels: { color: '#94a3b8', padding: 8, font: { size: 11 } } } },
                cutout: '50%'
            }
        });
    }
    
    renderHighScoresChart(turns) {
        const ctx = document.getElementById('chart-high-scores');
        if (!ctx) return;
        
        const monthly = {};
        turns.forEach(t => {
            if (t.points === null || !t.created_at) return;
            const m = t.created_at.substring(0, 7);
            if (!monthly[m]) monthly[m] = { s180: 0, s140: 0, s100: 0 };
            if (t.points === 180) monthly[m].s180++;
            else if (t.points >= 140) monthly[m].s140++;
            else if (t.points >= 100) monthly[m].s100++;
        });
        
        const months = Object.keys(monthly).sort().slice(-8);
        const labels = months.map(m => {
            const parts = m.split('-');
            return new Date(parts[0], parts[1] - 1).toLocaleDateString('de-DE', { month: 'short' });
        });
        
        if (this.highScoresChart) this.highScoresChart.destroy();
        this.highScoresChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels,
                datasets: [
                    { label: '180s', data: months.map(m => monthly[m].s180), backgroundColor: CONFIG.COLORS.green, borderRadius: 4 },
                    { label: '140+', data: months.map(m => monthly[m].s140), backgroundColor: CONFIG.COLORS.yellow, borderRadius: 4 },
                    { label: '100+', data: months.map(m => monthly[m].s100), backgroundColor: CONFIG.COLORS.blue, borderRadius: 4 }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'top', labels: { color: '#94a3b8', padding: 8, font: { size: 10 } } } },
                scales: {
                    x: { stacked: true, grid: { display: false }, ticks: { color: '#94a3b8', font: { size: 10 } } },
                    y: { stacked: true, grid: { color: 'rgba(255,255,255,0.1)' }, ticks: { color: '#94a3b8' } }
                }
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
            const opponent = this.opponentMap[mp.match_id];
            const oppName = opponent 
                ? (opponent.is_bot ? '🤖 Bot Lvl ' + Math.round((opponent.cpu_ppr || 40) / 10) : (opponent.name || 'Gegner'))
                : 'Unbekannt';
            const avg = mp.average ? mp.average.toFixed(1) : '-';
            
            return '<tr>' +
                '<td>' + date.toLocaleDateString('de-DE') + '</td>' +
                '<td>' + oppName + '</td>' +
                '<td class="' + (isWin ? 'result-win' : 'result-loss') + '">' + (isWin ? '✅ Sieg' : '❌ Niederlage') + '</td>' +
                '<td>' + avg + '</td>' +
                '<td><span class="badge badge-' + (match.type || 'online').toLowerCase() + '">' + (match.type || 'Online') + '</span></td>' +
                '</tr>';
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
            
            // Load turns
            let allTurns = [];
            for (let i = 0; i < mpIds.length; i += 50) {
                const batchIds = mpIds.slice(i, i + 50);
                const { data: turns } = await supabase.from('turns').select('id, points').in('match_player_id', batchIds);
                if (turns) allTurns.push(...turns);
            }
            
            // Load throws
            const turnIds = allTurns.map(t => t.id);
            let allThrows = [];
            for (let i = 0; i < turnIds.length && i < 5000; i += 100) {
                const batchIds = turnIds.slice(i, i + 100);
                const { data: throws } = await supabase.from('throws').select('segment_name, segment_bed, segment_number').in('turn_id', batchIds);
                if (throws) allThrows.push(...throws);
            }
            
            // T20 analysis
            const t20Area = allThrows.filter(t => [20, 1, 5].includes(t.segment_number));
            const t20Hits = t20Area.filter(t => t.segment_bed === 'Triple' && t.segment_number === 20).length;
            const t20Rate = t20Area.length > 0 ? ((t20Hits / t20Area.length) * 100).toFixed(1) : 0;
            
            let c100 = 0, c140 = 0, c180 = 0;
            allTurns.forEach(t => {
                if (t.points === 180) c180++;
                else if (t.points >= 140) c140++;
                else if (t.points >= 100) c100++;
            });
            
            document.getElementById('stat-t20-rate').textContent = t20Rate + '%';
            document.getElementById('stat-100plus').textContent = c100 + c140 + c180;
            document.getElementById('stat-140plus').textContent = c140 + c180;
            document.getElementById('stat-180s-total').textContent = c180;
            
            this.renderT20Chart(t20Area);
            this.renderScoreFreqChart(allTurns);
        } catch (error) {
            console.error('Scoring error:', error);
        } finally {
            this.hideLoading();
        }
    }
    
    renderT20Chart(data) {
        const ctx = document.getElementById('chart-t20-distribution');
        if (!ctx) return;
        
        const counts = { 'T20': 0, 'S20': 0, 'T1': 0, 'S1': 0, 'T5': 0, 'S5': 0, 'Miss': 0 };
        data.forEach(t => {
            if (t.segment_bed === 'Triple' && t.segment_number === 20) counts['T20']++;
            else if (t.segment_number === 20) counts['S20']++;
            else if (t.segment_bed === 'Triple' && t.segment_number === 1) counts['T1']++;
            else if (t.segment_number === 1) counts['S1']++;
            else if (t.segment_bed === 'Triple' && t.segment_number === 5) counts['T5']++;
            else if (t.segment_number === 5) counts['S5']++;
            else counts['Miss']++;
        });
        
        if (this.t20Chart) this.t20Chart.destroy();
        this.t20Chart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: Object.keys(counts),
                datasets: [{ data: Object.values(counts), backgroundColor: ['#10b981', '#34d399', '#f59e0b', '#fbbf24', '#3b82f6', '#60a5fa', '#ef4444'], borderRadius: 6 }]
            },
            options: { responsive: true, maintainAspectRatio: false, indexAxis: 'y', plugins: { legend: { display: false } }, scales: { x: { grid: { color: 'rgba(255,255,255,0.1)' }, ticks: { color: '#94a3b8' } }, y: { grid: { display: false }, ticks: { color: '#94a3b8' } } } }
        });
    }
    
    renderScoreFreqChart(turns) {
        const ctx = document.getElementById('chart-score-frequency');
        if (!ctx) return;
        
        const buckets = { '0-19': 0, '20-39': 0, '40-59': 0, '60-79': 0, '80-99': 0, '100-119': 0, '120-139': 0, '140-159': 0, '160-180': 0 };
        turns.forEach(t => {
            if (t.points === null) return;
            const p = t.points;
            if (p < 20) buckets['0-19']++;
            else if (p < 40) buckets['20-39']++;
            else if (p < 60) buckets['40-59']++;
            else if (p < 80) buckets['60-79']++;
            else if (p < 100) buckets['80-99']++;
            else if (p < 120) buckets['100-119']++;
            else if (p < 140) buckets['120-139']++;
            else if (p < 160) buckets['140-159']++;
            else buckets['160-180']++;
        });
        
        if (this.scoreFreqChart) this.scoreFreqChart.destroy();
        this.scoreFreqChart = new Chart(ctx, {
            type: 'bar',
            data: { labels: Object.keys(buckets), datasets: [{ data: Object.values(buckets), backgroundColor: CONFIG.COLORS.blue, borderRadius: 4 }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { display: false }, ticks: { color: '#94a3b8', font: { size: 9 }, maxRotation: 45 } }, y: { grid: { color: 'rgba(255,255,255,0.1)' }, ticks: { color: '#94a3b8' } } } }
        });
    }

    // =====================================================
    // CHECKOUT PAGE
    // =====================================================
    
    async loadCheckoutData() {
        this.showLoading();
        try {
            const matches = this.getFilteredData();
            const mpIds = matches.map(m => m.id);
            
            // Checkout rate from match_players
            let totalCheckout = 0, checkoutCount = 0;
            matches.forEach(mp => {
                if (mp.checkout_rate && mp.checkout_rate > 0) {
                    totalCheckout += mp.checkout_rate;
                    checkoutCount++;
                }
            });
            const avgCheckout = checkoutCount > 0 ? ((totalCheckout / checkoutCount) * 100).toFixed(1) : '-';
            
            // Load checkout turns
            let checkoutTurns = [];
            for (let i = 0; i < mpIds.length; i += 50) {
                const batchIds = mpIds.slice(i, i + 50);
                const { data: turns } = await supabase.from('turns').select('id, points').in('match_player_id', batchIds).eq('score_remaining', 0);
                if (turns) checkoutTurns.push(...turns);
            }
            
            // Load throws for checkout turns
            const checkoutTurnIds = checkoutTurns.map(t => t.id);
            let checkoutThrows = [];
            for (let i = 0; i < checkoutTurnIds.length; i += 100) {
                const batchIds = checkoutTurnIds.slice(i, i + 100);
                const { data: throws } = await supabase.from('throws').select('segment_name, segment_bed').in('turn_id', batchIds).eq('segment_bed', 'Double');
                if (throws) checkoutThrows.push(...throws);
            }
            
            // Count doubles
            const doubleCount = {};
            checkoutThrows.forEach(t => {
                doubleCount[t.segment_name] = (doubleCount[t.segment_name] || 0) + 1;
            });
            
            const sorted = Object.entries(doubleCount).sort((a, b) => b[1] - a[1]);
            const favDouble = sorted[0]?.[0] || '-';
            const total = checkoutThrows.length;
            const scores = checkoutTurns.map(t => t.points).filter(p => p > 0);
            const highest = scores.length > 0 ? Math.max(...scores) : 0;
            
            document.getElementById('stat-checkout-total').textContent = avgCheckout !== '-' ? avgCheckout + '%' : '-';
            document.getElementById('stat-favorite-double').textContent = favDouble;
            document.getElementById('stat-highest-checkout').textContent = highest || '-';
            document.getElementById('stat-total-checkouts').textContent = total;
            
            this.renderDoublesChart(sorted.slice(0, 10));
            this.renderCheckoutScoreChart(checkoutTurns);
            this.renderCheckoutTable(sorted);
        } catch (error) {
            console.error('Checkout error:', error);
        } finally {
            this.hideLoading();
        }
    }
    
    renderDoublesChart(doubles) {
        const ctx = document.getElementById('chart-favorite-doubles');
        if (!ctx) return;
        if (this.doublesChart) this.doublesChart.destroy();
        this.doublesChart = new Chart(ctx, {
            type: 'bar',
            data: { labels: doubles.map(d => d[0]), datasets: [{ data: doubles.map(d => d[1]), backgroundColor: CONFIG.COLORS.green, borderRadius: 6 }] },
            options: { responsive: true, maintainAspectRatio: false, indexAxis: 'y', plugins: { legend: { display: false } }, scales: { x: { grid: { color: 'rgba(255,255,255,0.1)' }, ticks: { color: '#94a3b8' } }, y: { grid: { display: false }, ticks: { color: '#94a3b8' } } } }
        });
    }
    
    renderCheckoutScoreChart(checkoutTurns) {
        const ctx = document.getElementById('chart-checkout-by-score');
        if (!ctx) return;
        
        const ranges = { '2-40': 0, '41-60': 0, '61-80': 0, '81-100': 0, '101-120': 0, '121+': 0 };
        checkoutTurns.forEach(c => {
            const s = c.points;
            if (!s) return;
            if (s <= 40) ranges['2-40']++;
            else if (s <= 60) ranges['41-60']++;
            else if (s <= 80) ranges['61-80']++;
            else if (s <= 100) ranges['81-100']++;
            else if (s <= 120) ranges['101-120']++;
            else ranges['121+']++;
        });
        
        if (this.checkoutScoreChart) this.checkoutScoreChart.destroy();
        this.checkoutScoreChart = new Chart(ctx, {
            type: 'bar',
            data: { labels: Object.keys(ranges), datasets: [{ data: Object.values(ranges), backgroundColor: CONFIG.COLORS.blue, borderRadius: 6 }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { display: false }, ticks: { color: '#94a3b8' } }, y: { grid: { color: 'rgba(255,255,255,0.1)' }, ticks: { color: '#94a3b8' } } } }
        });
    }
    
    renderCheckoutTable(doubles) {
        const tbody = document.querySelector('#checkout-table tbody');
        if (!tbody) return;
        const total = doubles.reduce((s, d) => s + d[1], 0) || 1;
        tbody.innerHTML = doubles.slice(0, 15).map(d => 
            '<tr><td>-</td><td><strong>' + d[0] + '</strong></td><td>' + d[1] + '</td><td>' + ((d[1]/total)*100).toFixed(1) + '%</td></tr>'
        ).join('');
    }

    // =====================================================
    // MATCHES PAGE
    // =====================================================
    
    async loadMatchesPage() {
        this.showLoading();
        try {
            const filtered = this.getFilteredData();
            const tbody = document.querySelector('#all-matches-table tbody');
            if (tbody) {
                tbody.innerHTML = filtered.map(mp => {
                    const m = mp.match;
                    const d = new Date(m.finished_at);
                    const w = m.winner === mp.player_index;
                    const opp = this.opponentMap[mp.match_id];
                    const oppName = opp ? (opp.is_bot ? '🤖 Bot Lvl ' + Math.round((opp.cpu_ppr||40)/10) : opp.name || 'Gegner') : 'Unbekannt';
                    return '<tr>' +
                        '<td>' + d.toLocaleDateString('de-DE') + ' ' + d.toLocaleTimeString('de-DE', {hour:'2-digit',minute:'2-digit'}) + '</td>' +
                        '<td>' + oppName + '</td>' +
                        '<td class="' + (w ? 'result-win' : 'result-loss') + '">' + (w ? '✅ Sieg' : '❌ Niederlage') + '</td>' +
                        '<td>' + (mp.legs_won || 0) + '</td>' +
                        '<td>' + (mp.average ? mp.average.toFixed(1) : '-') + '</td>' +
                        '<td>' + (m.variant || '-') + '</td>' +
                        '<td><span class="badge badge-' + (m.type || 'online').toLowerCase() + '">' + (m.type || 'Online') + '</span></td>' +
                        '</tr>';
                }).join('');
            }
        } catch (error) {
            console.error('Matches error:', error);
        } finally {
            this.hideLoading();
        }
    }

    // =====================================================
    // HEATMAP PAGE
    // =====================================================
    
    async loadHeatmapData() {
        this.showLoading();
        try {
            const matches = this.getFilteredData();
            const mpIds = matches.map(m => m.id);
            
            // Load turn IDs
            let turnIds = [];
            for (let i = 0; i < mpIds.length; i += 50) {
                const batchIds = mpIds.slice(i, i + 50);
                const { data: turns } = await supabase.from('turns').select('id').in('match_player_id', batchIds);
                if (turns) turnIds.push(...turns.map(t => t.id));
            }
            
            // Load throws with coordinates
            const target = document.getElementById('heatmap-target')?.value || 'all';
            let allThrows = [];
            
            for (let i = 0; i < turnIds.length && i < 10000; i += 100) {
                const batchIds = turnIds.slice(i, i + 100);
                let query = supabase.from('throws').select('segment_name, segment_number, segment_bed, coord_x, coord_y').in('turn_id', batchIds).not('coord_x', 'is', null);
                
                if (target === '20') query = query.in('segment_number', [20, 1, 5]);
                else if (target === '19') query = query.in('segment_number', [19, 3, 7]);
                else if (target === '18') query = query.in('segment_number', [18, 4, 1]);
                else if (target === 'doubles') query = query.eq('segment_bed', 'Double');
                
                const { data: throws } = await query;
                if (throws) allThrows.push(...throws);
            }
            
            this.renderDartboard(allThrows);
            this.renderSegmentStats(allThrows);
        } catch (error) {
            console.error('Heatmap error:', error);
        } finally {
            this.hideLoading();
        }
    }
    
    renderDartboard(throws) {
        const canvas = document.getElementById('dartboard-canvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const cx = canvas.width / 2, cy = canvas.height / 2, r = 220;
        
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Draw rings
        [{ radius: r, color: '#1a1a2e' }, { radius: r * 0.85, color: '#252540' }, { radius: r * 0.65, color: '#1a1a2e' }, { radius: r * 0.45, color: '#252540' }, { radius: r * 0.15, color: '#10b981' }, { radius: r * 0.06, color: '#ef4444' }]
            .forEach(ring => { ctx.beginPath(); ctx.arc(cx, cy, ring.radius, 0, Math.PI * 2); ctx.fillStyle = ring.color; ctx.fill(); });
        
        // Draw throws
        const scale = 180;
        throws.forEach(t => {
            if (t.coord_x != null && t.coord_y != null) {
                ctx.beginPath();
                ctx.arc(cx + t.coord_x * scale, cy - t.coord_y * scale, 3, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(16, 185, 129, 0.6)';
                ctx.fill();
            }
        });
    }
    
    renderSegmentStats(throws) {
        const container = document.getElementById('segment-stats');
        if (!container) return;
        
        const counts = {};
        throws.forEach(t => {
            if (t.segment_name && t.segment_name !== 'Outside') {
                counts[t.segment_name] = (counts[t.segment_name] || 0) + 1;
            }
        });
        
        const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 10);
        const max = sorted[0]?.[1] || 1;
        
        container.innerHTML = sorted.map(item => 
            '<div class="segment-stat"><span class="segment-name">' + item[0] + '</span><div class="segment-bar"><div class="segment-bar-fill" style="width:' + ((item[1]/max)*100) + '%"></div></div><span class="segment-count">' + item[1] + '</span></div>'
        ).join('');
    }

    // =====================================================
    // OPPONENTS PAGE
    // =====================================================
    
    async loadOpponentsData() {
        this.showLoading();
        try {
            const matches = this.getFilteredData();
            const oppStats = {};
            let botWins = 0, botTotal = 0, humanWins = 0, humanTotal = 0;
            
            matches.forEach(mp => {
                const opp = this.opponentMap[mp.match_id];
                if (!opp) return;
                
                const isWin = mp.match.winner === mp.player_index;
                const key = opp.is_bot ? '🤖 Bot Lvl ' + Math.round((opp.cpu_ppr || 40) / 10) : (opp.name || opp.id);
                
                if (!oppStats[key]) oppStats[key] = { name: key, matches: 0, wins: 0, lastMatch: null, isBot: opp.is_bot };
                oppStats[key].matches++;
                if (isWin) oppStats[key].wins++;
                if (!oppStats[key].lastMatch || mp.match.finished_at > oppStats[key].lastMatch) {
                    oppStats[key].lastMatch = mp.match.finished_at;
                }
                
                if (opp.is_bot) { botTotal++; if (isWin) botWins++; }
                else { humanTotal++; if (isWin) humanWins++; }
            });
            
            const sortedOpps = Object.values(oppStats).sort((a, b) => b.matches - a.matches);
            const nemesis = sortedOpps.filter(o => o.matches >= 3 && (o.wins / o.matches) < 0.5).sort((a, b) => (a.wins/a.matches) - (b.wins/b.matches))[0];
            
            document.getElementById('stat-unique-opponents').textContent = sortedOpps.filter(o => !o.isBot).length;
            document.getElementById('stat-vs-bots').textContent = botTotal > 0 ? ((botWins/botTotal)*100).toFixed(0) + '%' : '-';
            document.getElementById('stat-vs-humans').textContent = humanTotal > 0 ? ((humanWins/humanTotal)*100).toFixed(0) + '%' : '-';
            document.getElementById('stat-nemesis').textContent = nemesis?.name || '-';
            
            const tbody = document.querySelector('#opponents-table tbody');
            if (tbody) {
                tbody.innerHTML = sortedOpps.slice(0, 30).map(o => {
                    const winRate = ((o.wins / o.matches) * 100).toFixed(0);
                    const lastDate = o.lastMatch ? new Date(o.lastMatch).toLocaleDateString('de-DE') : '-';
                    return '<tr>' +
                        '<td>' + o.name + '</td>' +
                        '<td>' + o.matches + '</td>' +
                        '<td class="result-win">' + o.wins + '</td>' +
                        '<td class="result-loss">' + (o.matches - o.wins) + '</td>' +
                        '<td>' + winRate + '%</td>' +
                        '<td>-</td>' +
                        '<td>' + lastDate + '</td>' +
                        '</tr>';
                }).join('');
            }
        } catch (error) {
            console.error('Opponents error:', error);
        } finally {
            this.hideLoading();
        }
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', function() { new AutodartsStats(); });
