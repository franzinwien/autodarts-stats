// Autodarts Stats - Clean Dashboard App

class AutodartsStats {
    constructor() {
        this.user = null;
        this.allowedUsers = [];
        this.matches = [];
        this.matchPlayers = [];
        this.legs = [];
        this.turns = [];
        this.users = [];
        this.currentPlayer = null;
        this.filters = {
            player: '',
            time: '30',
            type: '',
            opponent: ''
        };
        this.charts = {};
        this.currentPage = 1;
        this.matchesPerPage = 20;

        this.init();
    }

    async init() {
        // Check for existing session
        const { data: { session } } = await window.db.auth.getSession();

        if (session) {
            await this.handleAuth(session);
        }

        // Listen for auth changes
        window.db.auth.onAuthStateChange(async (event, session) => {
            if (event === 'SIGNED_IN' && session) {
                await this.handleAuth(session);
            } else if (event === 'SIGNED_OUT') {
                this.showLogin();
            }
        });

        this.setupEventListeners();
    }

    setupEventListeners() {
        // Login
        document.getElementById('send-magic-link')?.addEventListener('click', () => this.sendMagicLink());
        document.getElementById('email-input')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.sendMagicLink();
        });

        // Logout
        document.getElementById('logout-btn')?.addEventListener('click', () => this.logout());

        // Filters
        document.getElementById('apply-filters')?.addEventListener('click', () => this.applyFilters());

        // Navigation
        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.addEventListener('click', () => this.showPage(tab.dataset.page));
        });

        // Matches sort
        document.getElementById('matches-sort')?.addEventListener('change', () => this.renderMatchesTable());

        // H2H player selection
        document.getElementById('h2h-player1')?.addEventListener('change', () => this.updateH2H());
        document.getElementById('h2h-player2')?.addEventListener('change', () => this.updateH2H());
    }

    async sendMagicLink() {
        const email = document.getElementById('email-input').value.trim();
        const messageEl = document.getElementById('login-message');

        if (!email) {
            messageEl.textContent = 'Bitte Email eingeben';
            messageEl.className = 'login-message error';
            return;
        }

        try {
            const { error } = await window.db.auth.signInWithOtp({
                email,
                options: {
                    emailRedirectTo: window.location.origin + window.location.pathname
                }
            });

            if (error) throw error;

            messageEl.textContent = 'Magic Link gesendet! Check deine Emails.';
            messageEl.className = 'login-message success';
        } catch (error) {
            messageEl.textContent = 'Fehler: ' + error.message;
            messageEl.className = 'login-message error';
        }
    }

    async handleAuth(session) {
        this.showLoading(true);

        try {
            // Load allowed users
            const { data: allowedUsers } = await window.db.from('allowed_users').select('*');
            this.allowedUsers = allowedUsers || [];

            // Check if user is allowed
            const userEmail = session.user.email;
            const allowedUser = this.allowedUsers.find(u => u.email.toLowerCase() === userEmail.toLowerCase());

            if (!allowedUser) {
                alert('Zugang nicht erlaubt');
                await this.logout();
                return;
            }

            this.user = {
                ...session.user,
                autodarts_user_id: allowedUser.autodarts_user_id,
                autodarts_username: allowedUser.autodarts_username
            };

            // Load data
            await this.loadData();

            // Setup UI
            this.setupFilters();
            this.showDashboard();
            this.applyFilters();

        } catch (error) {
            console.error('Auth error:', error);
            alert('Fehler beim Laden: ' + error.message);
        } finally {
            this.showLoading(false);
        }
    }

    async loadData() {
        // Load all data in parallel
        const [matchesRes, matchPlayersRes, legsRes, turnsRes, usersRes] = await Promise.all([
            window.db.from('matches').select('*').order('finished_at', { ascending: false }),
            window.db.from('match_players').select('*'),
            window.db.from('legs').select('*'),
            window.db.from('turns').select('*'),
            window.db.from('users').select('*')
        ]);

        this.matches = matchesRes.data || [];
        this.matchPlayers = matchPlayersRes.data || [];
        this.legs = legsRes.data || [];
        this.turns = turnsRes.data || [];
        this.users = usersRes.data || [];

        console.log(`Loaded: ${this.matches.length} matches, ${this.matchPlayers.length} match_players, ${this.legs.length} legs, ${this.turns.length} turns`);
    }

    setupFilters() {
        // Player filter
        const playerSelect = document.getElementById('filter-player');
        playerSelect.innerHTML = '';

        this.allowedUsers.forEach(u => {
            const option = document.createElement('option');
            option.value = u.autodarts_user_id;
            option.textContent = u.autodarts_username;
            if (u.autodarts_user_id === this.user.autodarts_user_id) {
                option.selected = true;
            }
            playerSelect.appendChild(option);
        });

        // Opponent filter - will be populated after filtering
        this.updateOpponentFilter();

        // H2H player selects
        const h2hPlayer1 = document.getElementById('h2h-player1');
        const h2hPlayer2 = document.getElementById('h2h-player2');

        if (h2hPlayer1 && h2hPlayer2) {
            h2hPlayer1.innerHTML = '';
            h2hPlayer2.innerHTML = '';

            this.allowedUsers.forEach((u, i) => {
                const opt1 = document.createElement('option');
                opt1.value = u.autodarts_user_id;
                opt1.textContent = u.autodarts_username;
                if (i === 0) opt1.selected = true;
                h2hPlayer1.appendChild(opt1);

                const opt2 = document.createElement('option');
                opt2.value = u.autodarts_user_id;
                opt2.textContent = u.autodarts_username;
                if (i === 1) opt2.selected = true;
                h2hPlayer2.appendChild(opt2);
            });
        }

        // Set current player
        this.currentPlayer = this.user.autodarts_user_id;
        this.filters.player = this.currentPlayer;
    }

    updateOpponentFilter() {
        const opponentSelect = document.getElementById('filter-opponent');
        opponentSelect.innerHTML = '<option value="">Alle Gegner</option>';

        // Get unique opponents
        const opponents = new Map();
        this.matchPlayers.forEach(mp => {
            if (mp.user_id && mp.user_id !== this.filters.player) {
                if (!opponents.has(mp.user_id)) {
                    opponents.set(mp.user_id, mp.name);
                }
            }
        });

        // Add bots
        this.matchPlayers.forEach(mp => {
            if (mp.is_bot && mp.name) {
                const botKey = 'bot_' + mp.name;
                if (!opponents.has(botKey)) {
                    opponents.set(botKey, mp.name + ' (Bot)');
                }
            }
        });

        opponents.forEach((name, id) => {
            const option = document.createElement('option');
            option.value = id;
            option.textContent = name;
            opponentSelect.appendChild(option);
        });
    }

    applyFilters() {
        this.filters.player = document.getElementById('filter-player').value;
        this.filters.time = document.getElementById('filter-time').value;
        this.filters.type = document.getElementById('filter-type').value;
        this.filters.opponent = document.getElementById('filter-opponent').value;

        this.currentPlayer = this.filters.player;
        this.updateOpponentFilter();
        this.renderDashboard();
    }

    getFilteredData() {
        let playerMatches = this.matchPlayers.filter(mp => mp.user_id === this.filters.player);

        // Join with matches
        let data = playerMatches.map(mp => {
            const match = this.matches.find(m => m.id === mp.match_id);
            return { ...mp, match };
        }).filter(d => d.match);

        // Time filter
        if (this.filters.time !== 'all') {
            const days = parseInt(this.filters.time);
            const cutoff = new Date();
            cutoff.setDate(cutoff.getDate() - days);
            data = data.filter(d => new Date(d.match.finished_at) >= cutoff);
        }

        // Type filter
        if (this.filters.type) {
            data = data.filter(d => d.match.type === this.filters.type);
        }

        // Opponent filter
        if (this.filters.opponent) {
            data = data.filter(d => {
                const opponents = this.matchPlayers.filter(
                    mp => mp.match_id === d.match_id && mp.user_id !== this.filters.player
                );
                if (this.filters.opponent.startsWith('bot_')) {
                    const botName = this.filters.opponent.replace('bot_', '');
                    return opponents.some(o => o.is_bot && o.name === botName);
                }
                return opponents.some(o => o.user_id === this.filters.opponent);
            });
        }

        // Sort by date
        data.sort((a, b) => new Date(b.match.finished_at) - new Date(a.match.finished_at));

        return data;
    }

    renderDashboard() {
        const data = this.getFilteredData();

        this.renderStats(data);
        this.renderHighscores(data);
        this.renderCharts(data);
        this.renderRecentMatches(data.slice(0, 5));
        this.renderMatchesTable();

        // Update user name
        const userNameEl = document.getElementById('user-name');
        if (userNameEl) {
            userNameEl.textContent = this.user.autodarts_username;
        }
    }

    renderStats(data) {
        if (data.length === 0) {
            document.getElementById('stat-average').textContent = '--';
            document.getElementById('stat-first9').textContent = '--';
            document.getElementById('stat-checkout').textContent = '--';
            document.getElementById('stat-180s').textContent = '--';
            document.getElementById('stat-winrate').textContent = '--';
            document.getElementById('stat-matches').textContent = '0';
            return;
        }

        // Calculate stats from turns
        const playerTurns = this.getPlayerTurns(data);

        // Average
        const validTurns = playerTurns.filter(t => t.points != null);
        const avgPoints = validTurns.reduce((sum, t) => sum + t.points, 0) / validTurns.length;
        document.getElementById('stat-average').textContent = avgPoints ? avgPoints.toFixed(1) : '--';

        // First 9 Average (rounds 1-3)
        const first9Turns = validTurns.filter(t => t.round <= 3);
        const first9Avg = first9Turns.reduce((sum, t) => sum + t.points, 0) / first9Turns.length;
        document.getElementById('stat-first9').textContent = first9Avg ? first9Avg.toFixed(1) : '--';

        // 180s
        const count180s = validTurns.filter(t => t.points === 180).length;
        document.getElementById('stat-180s').textContent = count180s;

        // Win rate
        const wins = data.filter(d => d.match.winner === d.player_index).length;
        const winRate = (wins / data.length * 100).toFixed(0);
        document.getElementById('stat-winrate').textContent = winRate + '%';

        // Checkout rate (from match_players average if available)
        const avgCheckout = data.reduce((sum, d) => sum + (d.checkout_rate || 0), 0) / data.length;
        document.getElementById('stat-checkout').textContent = avgCheckout ? avgCheckout.toFixed(1) + '%' : '--';

        // Match count
        document.getElementById('stat-matches').textContent = data.length;
    }

    getPlayerTurns(data) {
        const matchPlayerIds = data.map(d => d.id);
        return this.turns.filter(t => matchPlayerIds.includes(t.match_player_id));
    }

    renderHighscores(data) {
        const playerTurns = this.getPlayerTurns(data);
        const validTurns = playerTurns.filter(t => t.points != null);

        // Best leg average - calculate per leg
        const legTurns = {};
        validTurns.forEach(t => {
            if (!legTurns[t.leg_id]) legTurns[t.leg_id] = [];
            legTurns[t.leg_id].push(t.points);
        });

        let bestLegAvg = 0;
        Object.values(legTurns).forEach(turns => {
            if (turns.length >= 3) {
                const avg = turns.reduce((a, b) => a + b, 0) / turns.length;
                if (avg > bestLegAvg) bestLegAvg = avg;
            }
        });
        document.getElementById('hs-best-leg').textContent = bestLegAvg ? bestLegAvg.toFixed(1) : '--';

        // Best match average
        const matchAvgs = data.map(d => {
            const mTurns = validTurns.filter(t => t.match_player_id === d.id);
            if (mTurns.length === 0) return 0;
            return mTurns.reduce((sum, t) => sum + t.points, 0) / mTurns.length;
        }).filter(a => a > 0);
        const bestMatchAvg = Math.max(...matchAvgs, 0);
        document.getElementById('hs-best-match').textContent = bestMatchAvg ? bestMatchAvg.toFixed(1) : '--';

        // Highest checkout - look at winning legs
        let highestCheckout = 0;
        data.forEach(d => {
            const matchLegs = this.legs.filter(l => l.match_id === d.match_id && l.winner_player_id === d.id);
            matchLegs.forEach(leg => {
                const legT = validTurns.filter(t => t.leg_id === leg.id && t.match_player_id === d.id);
                if (legT.length > 0) {
                    const lastTurn = legT.sort((a, b) => b.round - a.round)[0];
                    if (lastTurn && lastTurn.points > highestCheckout && lastTurn.score_remaining === 0) {
                        highestCheckout = lastTurn.points;
                    }
                }
            });
        });
        document.getElementById('hs-highest-checkout').textContent = highestCheckout || '--';

        // Minimum darts per leg
        let minDarts = Infinity;
        Object.entries(legTurns).forEach(([legId, turns]) => {
            const leg = this.legs.find(l => l.id === legId);
            if (leg) {
                // Check if this player won the leg
                const mp = data.find(d => {
                    const lt = validTurns.filter(t => t.leg_id === legId && t.match_player_id === d.id);
                    return lt.length > 0;
                });
                if (mp && leg.winner_player_id === mp.id) {
                    const darts = turns.length * 3; // Approximate
                    if (darts < minDarts && darts > 0) minDarts = darts;
                }
            }
        });
        document.getElementById('hs-min-darts').textContent = minDarts < Infinity ? minDarts : '--';
    }

    renderCharts(data) {
        this.renderTrendChart(data);
        this.renderResultsChart(data);
        this.renderScoringChart(data);
    }

    renderTrendChart(data) {
        const ctx = document.getElementById('chart-trend');
        if (!ctx) return;

        // Destroy existing chart
        if (this.charts.trend) {
            this.charts.trend.destroy();
        }

        // Group by date and calculate average
        const byDate = {};
        const playerTurns = this.getPlayerTurns(data);

        data.forEach(d => {
            const date = new Date(d.match.finished_at).toLocaleDateString('de-DE');
            if (!byDate[date]) byDate[date] = [];

            const mTurns = playerTurns.filter(t => t.match_player_id === d.id && t.points != null);
            if (mTurns.length > 0) {
                const avg = mTurns.reduce((sum, t) => sum + t.points, 0) / mTurns.length;
                byDate[date].push(avg);
            }
        });

        const labels = Object.keys(byDate).reverse();
        const values = labels.map(date => {
            const avgs = byDate[date];
            return avgs.reduce((a, b) => a + b, 0) / avgs.length;
        });

        this.charts.trend = new Chart(ctx, {
            type: 'line',
            data: {
                labels,
                datasets: [{
                    label: 'Average',
                    data: values,
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    fill: true,
                    tension: 0.3
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    x: {
                        grid: { color: '#333' },
                        ticks: { color: '#888' }
                    },
                    y: {
                        grid: { color: '#333' },
                        ticks: { color: '#888' }
                    }
                }
            }
        });
    }

    renderResultsChart(data) {
        const ctx = document.getElementById('chart-results');
        if (!ctx) return;

        if (this.charts.results) {
            this.charts.results.destroy();
        }

        const wins = data.filter(d => d.match.winner === d.player_index).length;
        const losses = data.length - wins;

        this.charts.results = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Siege', 'Niederlagen'],
                datasets: [{
                    data: [wins, losses],
                    backgroundColor: ['#10b981', '#ef4444'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { color: '#888' }
                    }
                }
            }
        });
    }

    renderScoringChart(data) {
        const ctx = document.getElementById('chart-scoring');
        if (!ctx) return;

        if (this.charts.scoring) {
            this.charts.scoring.destroy();
        }

        const playerTurns = this.getPlayerTurns(data);
        const validTurns = playerTurns.filter(t => t.points != null);

        // Scoring buckets
        const buckets = {
            '0-20': 0,
            '21-40': 0,
            '41-60': 0,
            '61-80': 0,
            '81-100': 0,
            '101-120': 0,
            '121-140': 0,
            '141-180': 0
        };

        validTurns.forEach(t => {
            const p = t.points;
            if (p <= 20) buckets['0-20']++;
            else if (p <= 40) buckets['21-40']++;
            else if (p <= 60) buckets['41-60']++;
            else if (p <= 80) buckets['61-80']++;
            else if (p <= 100) buckets['81-100']++;
            else if (p <= 120) buckets['101-120']++;
            else if (p <= 140) buckets['121-140']++;
            else buckets['141-180']++;
        });

        this.charts.scoring = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: Object.keys(buckets),
                datasets: [{
                    label: 'Aufnahmen',
                    data: Object.values(buckets),
                    backgroundColor: '#3b82f6'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    x: {
                        grid: { color: '#333' },
                        ticks: { color: '#888' }
                    },
                    y: {
                        grid: { color: '#333' },
                        ticks: { color: '#888' }
                    }
                }
            }
        });
    }

    renderRecentMatches(data) {
        const container = document.getElementById('recent-matches');
        if (!container) return;

        container.innerHTML = data.map(d => {
            const opponent = this.getOpponent(d);
            const isWin = d.match.winner === d.player_index;
            const date = new Date(d.match.finished_at).toLocaleDateString('de-DE');

            const playerTurns = this.turns.filter(t => t.match_player_id === d.id && t.points != null);
            const avg = playerTurns.length > 0
                ? (playerTurns.reduce((sum, t) => sum + t.points, 0) / playerTurns.length).toFixed(1)
                : '--';

            const count180 = playerTurns.filter(t => t.points === 180).length;

            return `
                <div class="match-item">
                    <div class="match-date">${date}</div>
                    <div class="match-opponent">${opponent}</div>
                    <div class="match-result ${isWin ? 'win' : 'loss'}">${isWin ? 'Sieg' : 'Niederlage'}</div>
                    <div class="match-avg">${avg}</div>
                    <div class="match-180s">${count180 > 0 ? count180 + 'x 180' : ''}</div>
                </div>
            `;
        }).join('');
    }

    getOpponent(matchPlayer) {
        const opponents = this.matchPlayers.filter(
            mp => mp.match_id === matchPlayer.match_id && mp.id !== matchPlayer.id
        );
        if (opponents.length === 0) return 'Unbekannt';
        return opponents.map(o => o.name || 'Unbekannt').join(', ');
    }

    renderMatchesTable() {
        const data = this.getFilteredData();
        const sort = document.getElementById('matches-sort')?.value || 'date-desc';

        // Sort data
        let sorted = [...data];
        switch (sort) {
            case 'date-asc':
                sorted.sort((a, b) => new Date(a.match.finished_at) - new Date(b.match.finished_at));
                break;
            case 'avg-desc':
                sorted.sort((a, b) => (b.average || 0) - (a.average || 0));
                break;
            case 'avg-asc':
                sorted.sort((a, b) => (a.average || 0) - (b.average || 0));
                break;
            default:
                sorted.sort((a, b) => new Date(b.match.finished_at) - new Date(a.match.finished_at));
        }

        // Paginate
        const start = (this.currentPage - 1) * this.matchesPerPage;
        const paged = sorted.slice(start, start + this.matchesPerPage);

        const tbody = document.querySelector('#matches-table tbody');
        if (!tbody) return;

        tbody.innerHTML = paged.map(d => {
            const opponent = this.getOpponent(d);
            const isWin = d.match.winner === d.player_index;
            const date = new Date(d.match.finished_at).toLocaleDateString('de-DE');

            const playerTurns = this.turns.filter(t => t.match_player_id === d.id && t.points != null);
            const avg = playerTurns.length > 0
                ? (playerTurns.reduce((sum, t) => sum + t.points, 0) / playerTurns.length).toFixed(1)
                : '--';

            const first9Turns = playerTurns.filter(t => t.round <= 3);
            const first9 = first9Turns.length > 0
                ? (first9Turns.reduce((sum, t) => sum + t.points, 0) / first9Turns.length).toFixed(1)
                : '--';

            const checkout = d.checkout_rate ? d.checkout_rate.toFixed(1) + '%' : '--';
            const count180 = playerTurns.filter(t => t.points === 180).length;

            return `
                <tr>
                    <td>${date}</td>
                    <td>${opponent}</td>
                    <td class="${isWin ? 'win' : 'loss'}">${isWin ? 'Sieg' : 'Niederlage'}</td>
                    <td>${avg}</td>
                    <td>${first9}</td>
                    <td>${checkout}</td>
                    <td>${count180 > 0 ? count180 : '-'}</td>
                </tr>
            `;
        }).join('');

        // Pagination
        this.renderPagination(sorted.length);
    }

    renderPagination(total) {
        const container = document.getElementById('matches-pagination');
        if (!container) return;

        const pages = Math.ceil(total / this.matchesPerPage);
        if (pages <= 1) {
            container.innerHTML = '';
            return;
        }

        let html = '';
        for (let i = 1; i <= pages; i++) {
            html += `<button class="${i === this.currentPage ? 'active' : ''}" onclick="app.goToPage(${i})">${i}</button>`;
        }
        container.innerHTML = html;
    }

    goToPage(page) {
        this.currentPage = page;
        this.renderMatchesTable();
    }

    updateH2H() {
        const player1Id = document.getElementById('h2h-player1')?.value;
        const player2Id = document.getElementById('h2h-player2')?.value;

        if (!player1Id || !player2Id || player1Id === player2Id) {
            return;
        }

        // Find matches where both players played
        const h2hMatches = [];
        this.matches.forEach(match => {
            const players = this.matchPlayers.filter(mp => mp.match_id === match.id);
            const p1 = players.find(p => p.user_id === player1Id);
            const p2 = players.find(p => p.user_id === player2Id);
            if (p1 && p2) {
                h2hMatches.push({ match, p1, p2 });
            }
        });

        // Sort by date
        h2hMatches.sort((a, b) => new Date(a.match.finished_at) - new Date(b.match.finished_at));

        // Calculate stats
        let wins1 = 0, wins2 = 0;
        let totalAvg1 = 0, totalAvg2 = 0;
        let legs1 = 0, legs2 = 0;
        let count180s1 = 0, count180s2 = 0;

        h2hMatches.forEach(h => {
            if (h.match.winner === h.p1.player_index) wins1++;
            else if (h.match.winner === h.p2.player_index) wins2++;

            legs1 += h.p1.legs_won || 0;
            legs2 += h.p2.legs_won || 0;

            // Calculate averages from turns
            const turns1 = this.turns.filter(t => t.match_player_id === h.p1.id && t.points != null);
            const turns2 = this.turns.filter(t => t.match_player_id === h.p2.id && t.points != null);

            if (turns1.length > 0) {
                totalAvg1 += turns1.reduce((sum, t) => sum + t.points, 0) / turns1.length;
            }
            if (turns2.length > 0) {
                totalAvg2 += turns2.reduce((sum, t) => sum + t.points, 0) / turns2.length;
            }

            count180s1 += turns1.filter(t => t.points === 180).length;
            count180s2 += turns2.filter(t => t.points === 180).length;
        });

        const avgAvg1 = h2hMatches.length > 0 ? totalAvg1 / h2hMatches.length : 0;
        const avgAvg2 = h2hMatches.length > 0 ? totalAvg2 / h2hMatches.length : 0;

        // Update UI
        const p1Name = this.allowedUsers.find(u => u.autodarts_user_id === player1Id)?.autodarts_username || 'Spieler 1';
        const p2Name = this.allowedUsers.find(u => u.autodarts_user_id === player2Id)?.autodarts_username || 'Spieler 2';

        document.getElementById('h2h-name1').textContent = p1Name;
        document.getElementById('h2h-name2').textContent = p2Name;
        document.getElementById('h2h-wins1').textContent = wins1;
        document.getElementById('h2h-wins2').textContent = wins2;

        // Stats comparison
        document.getElementById('h2h-avg1').textContent = avgAvg1.toFixed(1);
        document.getElementById('h2h-avg2').textContent = avgAvg2.toFixed(1);
        document.getElementById('h2h-first9-1').textContent = '--'; // TODO
        document.getElementById('h2h-first9-2').textContent = '--';
        document.getElementById('h2h-checkout1').textContent = '--';
        document.getElementById('h2h-checkout2').textContent = '--';
        document.getElementById('h2h-180s1').textContent = count180s1;
        document.getElementById('h2h-180s2').textContent = count180s2;
        document.getElementById('h2h-legs1').textContent = legs1;
        document.getElementById('h2h-legs2').textContent = legs2;

        // Highlight better values
        this.highlightBetter('h2h-avg1', 'h2h-avg2', avgAvg1, avgAvg2);
        this.highlightBetter('h2h-180s1', 'h2h-180s2', count180s1, count180s2);
        this.highlightBetter('h2h-legs1', 'h2h-legs2', legs1, legs2);

        // Chart
        this.renderH2HChart(h2hMatches, p1Name, p2Name);

        // Match list
        this.renderH2HMatches(h2hMatches, p1Name, p2Name);
    }

    highlightBetter(id1, id2, val1, val2) {
        const el1 = document.getElementById(id1);
        const el2 = document.getElementById(id2);
        el1?.classList.remove('better');
        el2?.classList.remove('better');
        if (val1 > val2) el1?.classList.add('better');
        else if (val2 > val1) el2?.classList.add('better');
    }

    renderH2HChart(matches, name1, name2) {
        const ctx = document.getElementById('chart-h2h');
        if (!ctx) return;

        if (this.charts.h2h) {
            this.charts.h2h.destroy();
        }

        const labels = matches.map((h, i) => `Match ${i + 1}`);
        const data1 = matches.map(h => {
            const turns = this.turns.filter(t => t.match_player_id === h.p1.id && t.points != null);
            return turns.length > 0 ? turns.reduce((sum, t) => sum + t.points, 0) / turns.length : 0;
        });
        const data2 = matches.map(h => {
            const turns = this.turns.filter(t => t.match_player_id === h.p2.id && t.points != null);
            return turns.length > 0 ? turns.reduce((sum, t) => sum + t.points, 0) / turns.length : 0;
        });

        this.charts.h2h = new Chart(ctx, {
            type: 'line',
            data: {
                labels,
                datasets: [
                    {
                        label: name1,
                        data: data1,
                        borderColor: '#10b981',
                        backgroundColor: 'rgba(16, 185, 129, 0.1)',
                        fill: false,
                        tension: 0.3
                    },
                    {
                        label: name2,
                        data: data2,
                        borderColor: '#3b82f6',
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        fill: false,
                        tension: 0.3
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                        labels: { color: '#888' }
                    }
                },
                scales: {
                    x: {
                        grid: { color: '#333' },
                        ticks: { color: '#888' }
                    },
                    y: {
                        grid: { color: '#333' },
                        ticks: { color: '#888' }
                    }
                }
            }
        });
    }

    renderH2HMatches(matches, name1, name2) {
        const container = document.getElementById('h2h-matches');
        if (!container) return;

        container.innerHTML = matches.slice().reverse().slice(0, 10).map(h => {
            const date = new Date(h.match.finished_at).toLocaleDateString('de-DE');
            const winner = h.match.winner === h.p1.player_index ? name1 : name2;
            const isP1Win = h.match.winner === h.p1.player_index;

            const turns1 = this.turns.filter(t => t.match_player_id === h.p1.id && t.points != null);
            const turns2 = this.turns.filter(t => t.match_player_id === h.p2.id && t.points != null);
            const avg1 = turns1.length > 0 ? (turns1.reduce((sum, t) => sum + t.points, 0) / turns1.length).toFixed(1) : '--';
            const avg2 = turns2.length > 0 ? (turns2.reduce((sum, t) => sum + t.points, 0) / turns2.length).toFixed(1) : '--';

            return `
                <div class="match-item">
                    <div class="match-date">${date}</div>
                    <div class="match-opponent">${name1} vs ${name2}</div>
                    <div class="match-result ${isP1Win ? 'win' : 'loss'}">${winner}</div>
                    <div class="match-avg">${avg1} - ${avg2}</div>
                    <div></div>
                </div>
            `;
        }).join('');
    }

    showPage(page) {
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));

        document.getElementById('page-' + page)?.classList.add('active');
        document.querySelector(`.nav-tab[data-page="${page}"]`)?.classList.add('active');

        if (page === 'h2h') {
            this.updateH2H();
        }
    }

    showLogin() {
        document.getElementById('login-screen').classList.remove('hidden');
        document.getElementById('dashboard-screen').classList.add('hidden');
    }

    showDashboard() {
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('dashboard-screen').classList.remove('hidden');
    }

    showLoading(show) {
        const overlay = document.getElementById('loading-overlay');
        if (show) {
            overlay.classList.remove('hidden');
        } else {
            overlay.classList.add('hidden');
        }
    }

    async logout() {
        await window.db.auth.signOut();
        this.showLogin();
    }
}

// Initialize app
const app = new AutodartsStats();
window.app = app;
