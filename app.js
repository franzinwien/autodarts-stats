// AUTODARTS STATS PRO v4.0 - Head-to-Head & Rankings Edition
const BELLACIAO_ID = '7eb1c7f2-1a04-41cd-aae3-0416a8f4db59';
const FRANZ_ID = 'b81d2805-46e8-4daf-be6c-899e2d70bdfa';

// T20 Polygon (Convex Hull aus 7586 echten T20-Würfen)
const T20_POLYGON = [
    [-0.089152, 0.565903], [0.079155, 0.5653], [0.08823, 0.565993], [0.090225, 0.569936],
    [0.090479, 0.571558], [0.096431, 0.61163], [0.09477, 0.62118], [0.092786, 0.621972],
    [0.080128, 0.624283], [0.073509, 0.625], [0.051897, 0.627071], [0.018904, 0.62905],
    [0.002049, 0.629261], [-0.011489, 0.629035], [-0.025957, 0.628627], [-0.033343, 0.628343],
    [-0.041776, 0.627821], [-0.059573, 0.626313], [-0.068194, 0.625463], [-0.080342, 0.624259],
    [-0.095506, 0.621444], [-0.096787, 0.615528], [-0.096603, 0.611639], [-0.095702, 0.604708],
    [-0.089838, 0.568086]
];
const T20_CENTROID = [-0.0006088, 0.5932017]; // Mittelpunkt des T20-Felds

// Skalierungsfaktor: 1 normalisierte Einheit = 173mm (basierend auf Triple-Ring bei 103mm)
const COORD_TO_MM = 173;

// Prüft ob ein Punkt innerhalb eines Polygons liegt (Ray-casting Algorithmus)
function pointInPolygon(x, y, polygon) {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const xi = polygon[i][0], yi = polygon[i][1];
        const xj = polygon[j][0], yj = polygon[j][1];
        if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
            inside = !inside;
        }
    }
    return inside;
}

// Berechnet kürzeste Distanz von einem Punkt zu einem Liniensegment
function distanceToSegment(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1, dy = y2 - y1;
    const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)));
    const nearX = x1 + t * dx, nearY = y1 + t * dy;
    return Math.sqrt((px - nearX) ** 2 + (py - nearY) ** 2);
}

// Berechnet kürzeste Distanz von einem Punkt zum Polygon-Rand
function distanceToPolygon(x, y, polygon) {
    let minDist = Infinity;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const dist = distanceToSegment(x, y, polygon[j][0], polygon[j][1], polygon[i][0], polygon[i][1]);
        if (dist < minDist) minDist = dist;
    }
    return minDist;
}

// Berechnet Richtung vom T20-Zentrum zum Punkt (8 Richtungen)
// oben = Richtung Bull, unten = Richtung Draht/außen
// links = Richtung 5, rechts = Richtung 1
function getDirectionFromT20(x, y) {
    const dx = x - T20_CENTROID[0];
    const dy = y - T20_CENTROID[1];
    const angle = Math.atan2(dy, dx) * 180 / Math.PI; // -180 bis 180

    // 8 Richtungen: je 45° Segmente
    // Rechts = 0°, Oben = 90°, Links = 180°/-180°, Unten = -90°
    if (angle >= -22.5 && angle < 22.5) return 'rechts-mitte';
    if (angle >= 22.5 && angle < 67.5) return 'rechts-oben';
    if (angle >= 67.5 && angle < 112.5) return 'oben';
    if (angle >= 112.5 && angle < 157.5) return 'links-oben';
    if (angle >= 157.5 || angle < -157.5) return 'links-mitte';
    if (angle >= -157.5 && angle < -112.5) return 'links-unten';
    if (angle >= -112.5 && angle < -67.5) return 'unten';
    return 'rechts-unten'; // -67.5 bis -22.5
}

// Analysiert T20-Würfe und gruppiert Fehlwürfe nach Richtung und Distanz
function analyzeT20Misses(throws) {
    const t20Area = throws.filter(t => [20, 1, 5].includes(t.segment_number) && t.coord_x != null && t.coord_y != null);

    // 8 Richtungen mit Distanz-Kategorien
    const directions = ['links-oben', 'links-mitte', 'links-unten', 'oben', 'unten', 'rechts-oben', 'rechts-mitte', 'rechts-unten'];
    const byDirection = {};
    directions.forEach(d => {
        byDirection[d] = { close: [], far: [] }; // close: 0-1cm, far: >1cm
    });

    const results = {
        total: t20Area.length,
        hits: 0,
        misses: [],
        byDirection,
        byDistance: { '0-1cm': 0, '1-2cm': 0, '2-3cm': 0, '>3cm': 0 }
    };

    t20Area.forEach(t => {
        const inT20 = pointInPolygon(t.coord_x, t.coord_y, T20_POLYGON);
        if (inT20) {
            results.hits++;
        } else {
            const dist = distanceToPolygon(t.coord_x, t.coord_y, T20_POLYGON);
            const distMm = dist * COORD_TO_MM; // Umrechnung in mm
            const direction = getDirectionFromT20(t.coord_x, t.coord_y);

            results.misses.push({ x: t.coord_x, y: t.coord_y, distMm, direction, segment: t.segment_name });

            // Nach Richtung und Nähe gruppieren (1cm = 10mm)
            if (distMm <= 10) {
                results.byDirection[direction].close.push(distMm);
            } else {
                results.byDirection[direction].far.push(distMm);
            }

            // Distanz-Kategorien in cm
            if (distMm <= 10) results.byDistance['0-1cm']++;
            else if (distMm <= 20) results.byDistance['1-2cm']++;
            else if (distMm <= 30) results.byDistance['2-3cm']++;
            else results.byDistance['>3cm']++;
        }
    });

    return results;
}

class AutodartsStats {
    constructor() { this.user = null; this.currentPlayerId = null; this.allPlayers = []; this.allMatchPlayers = []; this.allMatches = []; this.allLegs = []; this.opponentMap = {}; this.overallAverage = 0; this.matchRankings = []; this.legRankings = []; this.filters = { time: 'all', type: '', variant: 'X01', view: 'legs' }; this.init(); }
    
    async init() {
        this.isInitialized = false;
        const { data: { session } } = await window.db.auth.getSession();
        if (session) { await this.handleAuthSuccess(session.user); this.isInitialized = true; }
        else {
            const hp = new URLSearchParams(window.location.hash.substring(1));
            if (hp.get('access_token')) {
                const { data: { session: ns } } = await window.db.auth.getSession();
                if (ns) { await this.handleAuthSuccess(ns.user); this.isInitialized = true; window.history.replaceState({}, document.title, window.location.pathname); }
            }
        }
        window.db.auth.onAuthStateChange(async (e, s) => {
            // Only handle SIGNED_IN on initial login (not TOKEN_REFRESHED which shows as SIGNED_IN too)
            if (e === 'SIGNED_IN' && s && !this.isInitialized) {
                await this.handleAuthSuccess(s.user);
                this.isInitialized = true;
            } else if (e === 'SIGNED_OUT') {
                this.isInitialized = false;
                this.showLoginScreen();
            }
            // TOKEN_REFRESHED events are handled automatically by Supabase, no action needed
        });
        this.setupEventListeners();
    }
    
    setupEventListeners() { document.getElementById('send-magic-link')?.addEventListener('click', () => this.sendMagicLink()); document.getElementById('email-input')?.addEventListener('keypress', (e) => { if (e.key === 'Enter') this.sendMagicLink(); }); document.getElementById('logout-btn')?.addEventListener('click', () => this.logout()); document.querySelectorAll('.nav-btn').forEach(btn => btn.addEventListener('click', () => this.navigateTo(btn.dataset.page))); document.getElementById('apply-filters')?.addEventListener('click', () => this.applyFilters()); document.getElementById('heatmap-target')?.addEventListener('change', () => this.loadHeatmapData()); document.getElementById('global-filter-player')?.addEventListener('change', (e) => this.switchPlayer(e.target.value)); document.getElementById('match-detail-prev')?.addEventListener('click', () => this.navigateMatch(-1)); document.getElementById('match-detail-next')?.addEventListener('click', () => this.navigateMatch(1)); document.getElementById('match-detail-select')?.addEventListener('change', (e) => this.loadMatchDetail(e.target.value)); document.querySelectorAll('.toggle-btn').forEach(btn => btn.addEventListener('click', () => this.toggleView(btn.dataset.view))); }
    
    async switchPlayer(pid) { if (pid === this.currentPlayerId) return; this.currentPlayerId = pid; await this.loadPlayerData(pid); this.applyFilters(); }
    toggleView(view) { if (this.filters.view === view) return; this.filters.view = view; document.querySelectorAll('.toggle-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.view === view)); this.legHistoryLoaded = false; this.matchHistoryLoaded = false; this.navigateTo(document.querySelector('.nav-btn.active')?.dataset.page || 'overview'); }
    applyFilters() { this.filters.time = document.getElementById('global-filter-time').value; this.filters.type = document.getElementById('global-filter-type').value; this.filters.variant = document.getElementById('global-filter-variant').value; this.legHistoryLoaded = false; this.matchHistoryLoaded = false; this.navigateTo(document.querySelector('.nav-btn.active')?.dataset.page || 'overview'); }
    getFilteredData() { let d = this.allMatchPlayers.map(mp => ({...mp, match: this.allMatches.find(m => m.id === mp.match_id)})).filter(mp => mp.match); if (this.filters.time !== 'all') { const days = parseInt(this.filters.time), cutoff = new Date(); cutoff.setDate(cutoff.getDate() - days); d = d.filter(mp => new Date(mp.match.finished_at) >= cutoff); } if (this.filters.type) d = d.filter(mp => mp.match.type === this.filters.type); if (this.filters.variant) d = d.filter(mp => mp.match.variant === this.filters.variant); return d.sort((a, b) => new Date(b.match.finished_at) - new Date(a.match.finished_at)); }
    
    async sendMagicLink() { const email = document.getElementById('email-input').value.trim(), msg = document.getElementById('login-message'); if (!email) { msg.textContent = 'Bitte Email eingeben'; msg.className = 'login-message error'; return; } try { const { error } = await window.db.auth.signInWithOtp({ email, options: { emailRedirectTo: location.origin + location.pathname } }); if (error) throw error; msg.textContent = 'Magic Link gesendet!'; msg.className = 'login-message success'; } catch (e) { msg.textContent = e.message; msg.className = 'login-message error'; } }
    
    async handleAuthSuccess(user) { this.user = user; this.showLoading(); try { const { data: players } = await window.db.from('allowed_users').select('*'); this.allPlayers = players || []; const cu = this.allPlayers.find(p => p.email === user.email); if (!cu) { alert('Zugang nicht erlaubt.'); await this.logout(); return; } this.currentPlayerId = cu.autodarts_user_id; document.getElementById('user-name').textContent = cu.autodarts_username || user.email; const sel = document.getElementById('global-filter-player'); if (sel) sel.innerHTML = this.allPlayers.map(p => '<option value="'+p.autodarts_user_id+'"'+(p.autodarts_user_id===cu.autodarts_user_id?' selected':'')+'>'+(p.autodarts_username||p.email)+'</option>').join(''); document.getElementById('global-filter-variant').value = 'X01'; this.filters.variant = 'X01'; await this.loadPlayerData(this.currentPlayerId); this.showDashboard(); this.navigateTo('overview'); } catch (e) { console.error(e); } finally { this.hideLoading(); } }
    
    async loadPlayerData(pid) { const { data: mp } = await window.db.from('match_players').select('*').eq('user_id', pid); this.allMatchPlayers = mp || []; if (!this.allMatchPlayers.length) return; const mids = [...new Set(this.allMatchPlayers.map(m => m.match_id))]; const batches = []; for (let i = 0; i < mids.length; i += 50) batches.push(mids.slice(i, i+50)); const [matchResults, oppResults] = await Promise.all([Promise.all(batches.map(batch => window.db.from('matches').select('*').in('id', batch))), Promise.all(batches.map(batch => window.db.from('match_players').select('*').in('match_id', batch)))]); this.allMatches = matchResults.flatMap(r => r.data || []); this.opponentMap = {}; oppResults.flatMap(r => r.data || []).forEach(p => { if (p.user_id !== pid && !this.opponentMap[p.match_id]) this.opponentMap[p.match_id] = p; }); const avgs = this.allMatchPlayers.filter(m => m.average > 0).map(m => m.average); this.overallAverage = avgs.length ? avgs.reduce((a,b)=>a+b,0)/avgs.length : 0; }
    
    async loadTurns(mpIds) { if (!mpIds.length) return []; const batches = []; for (let i = 0; i < mpIds.length; i += 50) batches.push(mpIds.slice(i, i+50)); const results = await Promise.all(batches.map(batch => window.db.from('turns').select('id,points,round,match_player_id,created_at,score_remaining').in('match_player_id', batch))); return results.flatMap(r => r.data || []); }
    async loadThrows(tids, lim=5000) { if (!tids.length) return []; const limitedTids = tids.slice(0, lim); const batches = []; for (let i = 0; i < limitedTids.length; i += 100) batches.push(limitedTids.slice(i, i+100)); const results = await Promise.all(batches.map(batch => window.db.from('throws').select('*').in('turn_id', batch))); return results.flatMap(r => r.data || []); }
    
    // Calculate average from turns for a match_player
    calcAvgFromTurns(turns, mpId) { const t = turns.filter(x => x.match_player_id === mpId && x.points !== null); return t.length ? t.reduce((s,x) => s + x.points, 0) / t.length : 0; }
    
    // Calculate rankings client-side
    calcRankings(matchesWithAvg) { const sorted = [...matchesWithAvg].sort((a,b) => b.calcAvg - a.calcAvg); sorted.forEach((m, i) => m.avgRank = i + 1); const byScore = [...matchesWithAvg].sort((a,b) => { const scoreA = a.calcAvg * 0.4 + (a.isWin ? 10 : 0); const scoreB = b.calcAvg * 0.4 + (b.isWin ? 10 : 0); return scoreB - scoreA; }); byScore.forEach((m, i) => m.matchRank = i + 1); return matchesWithAvg; }
    
    getRankBadge(rank, total) { if (rank === 1) return '<span class="rank-badge rank-gold">🥇 1</span>'; if (rank === 2) return '<span class="rank-badge rank-silver">🥈 2</span>'; if (rank === 3) return '<span class="rank-badge rank-bronze">🥉 3</span>'; if (rank <= 10) return '<span class="rank-badge rank-top10">#' + rank + '</span>'; return '<span class="rank-badge rank-normal">#' + rank + '</span>'; }
    
    async logout() { await window.db.auth.signOut(); this.showLoginScreen(); }
    showLoginScreen() { document.getElementById('login-screen').classList.remove('hidden'); document.getElementById('dashboard-screen').classList.add('hidden'); }
    showDashboard() { document.getElementById('login-screen').classList.add('hidden'); document.getElementById('dashboard-screen').classList.remove('hidden'); }
    showLoading() { document.getElementById('loading-overlay')?.classList.remove('hidden'); }
    hideLoading() { document.getElementById('loading-overlay')?.classList.add('hidden'); }
    navigateTo(page) { document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.page === page)); document.querySelectorAll('.page').forEach(p => p.classList.toggle('active', p.id === 'page-'+page)); ({overview:()=>this.loadOverviewData(),legs:()=>this.loadLegsPage(),scoring:()=>this.loadScoringData(),checkout:()=>this.loadCheckoutData(),matches:()=>this.loadMatchesPage(),matchdetail:()=>this.loadMatchDetailPage(),heatmap:()=>this.loadHeatmapData(),opponents:()=>this.loadOpponentsData(),advanced:()=>this.loadAdvancedData(),headtohead:()=>this.loadH2HData()})[page]?.(); }

    // ========== OVERVIEW ==========
    async loadOverviewData() {
        this.showLoading();
        try {
            // === TOTAL STATS (alle Daten ohne Filter, nur X01) ===
            const allData = this.allMatchPlayers.map(mp => ({...mp, match: this.allMatches.find(m => m.id === mp.match_id)})).filter(mp => mp.match && mp.match.variant === 'X01');
            const allMpIds = allData.map(m => m.id);
            let totalWins = 0, totalCheckoutSum = 0, totalCheckoutCnt = 0;
            allData.forEach(mp => {
                if(mp.match.winner === mp.player_index) totalWins++;
                if(mp.checkout_rate > 0) { totalCheckoutSum += mp.checkout_rate; totalCheckoutCnt++; }
            });
            const allTurns = await this.loadTurns(allMpIds);
            let totalPts = 0, totalCnt = 0, totalF9pts = 0, totalF9cnt = 0, total180s = 0;
            allTurns.forEach(t => {
                if(t.points !== null) {
                    totalPts += t.points; totalCnt++;
                    if(t.points === 180) total180s++;
                    if(t.round <= 3) { totalF9pts += t.points; totalF9cnt++; }
                }
            });

            // Gesamt-Statistiken anzeigen
            document.getElementById('stat-total-average').textContent = totalCnt ? (totalPts / totalCnt).toFixed(1) : '-';
            document.getElementById('stat-total-first9').textContent = totalF9cnt ? (totalF9pts / totalF9cnt).toFixed(1) : '-';
            document.getElementById('stat-total-checkout').textContent = totalCheckoutCnt ? ((totalCheckoutSum / totalCheckoutCnt) * 100).toFixed(1) + '%' : '-';
            document.getElementById('stat-total-180s').textContent = total180s;
            const totalLegsWon = allData.reduce((s, mp) => s + (mp.legs_won || 0), 0);
            const totalLegs = allData.reduce((s, mp) => s + (mp.legs_won || 0) + (mp.legs_lost || 0), 0);
            document.getElementById('stat-total-winrate').textContent = this.filters.view === 'legs'
                ? (totalLegs ? ((totalLegsWon / totalLegs) * 100).toFixed(0) + '%' : '-')
                : (allData.length ? ((totalWins / allData.length) * 100).toFixed(0) + '%' : '-');

            // === FILTERED STATS ===
            const matches = this.getFilteredData();
            const mpIds = matches.map(m => m.id);
            const turns = await this.loadTurns(mpIds);

            let pts = 0, cnt = 0, f9pts = 0, f9cnt = 0, c180 = 0;
            const byMp = {};
            turns.forEach(t => {
                if(t.points !== null) {
                    pts += t.points; cnt++;
                    if(t.points === 180) c180++;
                    if(t.round <= 3) { f9pts += t.points; f9cnt++; }
                    if(!byMp[t.match_player_id]) byMp[t.match_player_id] = [];
                    byMp[t.match_player_id].push(t.points);
                }
            });

            // Rankings berechnen
            const matchData = matches.map(mp => {
                const t = byMp[mp.id] || [];
                const calcAvg = t.length ? t.reduce((a,b) => a+b, 0) / t.length : (mp.average || 0);
                return {...mp, calcAvg, isWin: mp.match.winner === mp.player_index };
            });
            this.matchRankings = this.calcRankings(matchData);
            const bestMatch = this.matchRankings.find(m => m.avgRank === 1);

            // Konsistenz berechnen
            const mAvgs = Object.values(byMp).map(a => a.reduce((x,y) => x+y, 0) / a.length);
            const avg = mAvgs.length ? mAvgs.reduce((a,b) => a+b, 0) / mAvgs.length : 0;
            const std = Math.sqrt(mAvgs.length ? mAvgs.reduce((s,a) => s + Math.pow(a - avg, 2), 0) / mAvgs.length : 0);

            // Trend berechnen (letzte 7 Tage vs vorherige 7 Tage)
            const now = new Date(), w1 = new Date(now - 7*864e5), w2 = new Date(now - 14*864e5);
            const rec = matches.filter(m => new Date(m.match.finished_at) >= w1 && m.average > 0);
            const prev = matches.filter(m => { const d = new Date(m.match.finished_at); return d >= w2 && d < w1 && m.average > 0; });
            const recAvg = rec.length ? rec.reduce((s,m) => s + m.average, 0) / rec.length : 0;
            const prevAvg = prev.length ? prev.reduce((s,m) => s + m.average, 0) / prev.length : 0;
            const trend = prevAvg ? recAvg - prevAvg : 0;

            // Filter-Statistiken anzeigen
            document.getElementById('stat-average').textContent = cnt ? (pts / cnt).toFixed(1) : '-';
            document.getElementById('stat-first9').textContent = f9cnt ? (f9pts / f9cnt).toFixed(1) : '-';
            const tEl = document.getElementById('stat-trend');
            tEl.textContent = trend > 0 ? '↑ +' + trend.toFixed(1) : trend < 0 ? '↓ ' + trend.toFixed(1) : '→ 0';
            tEl.className = 'stat-value ' + (trend > 0 ? 'trend-up' : trend < 0 ? 'trend-down' : '');
            document.getElementById('stat-best-leg').textContent = bestMatch ? bestMatch.calcAvg.toFixed(1) : '-';
            document.getElementById('stat-best-label').textContent = this.filters.view === 'legs' ? 'Bestes Leg' : 'Bestes Match';
            document.getElementById('stat-consistency').textContent = (std < 3 ? 'A+' : std < 5 ? 'A' : std < 7 ? 'B' : std < 10 ? 'C' : 'D') + ' (±' + std.toFixed(1) + ')';

            // Filter-Badge aktualisieren
            const filterBadge = document.getElementById('filter-badge');
            if (filterBadge) {
                const viewLabel = this.filters.view === 'legs' ? 'Legs' : 'Matches';
                const timeLabel = this.filters.time === 'all' ? 'Alle Zeit' : this.filters.time + ' Tage';
                filterBadge.textContent = viewLabel + ' · ' + timeLabel;
            }

            // Charts rendern
            this.renderAvgChart(matches, turns);
            this.renderResultsChart(matches.filter(mp => mp.match.winner === mp.player_index).length, matches.length - matches.filter(mp => mp.match.winner === mp.player_index).length);
            this.renderFirst9Chart(turns);
            this.renderScoringChart(turns);
            this.renderHighScoresChart(turns);
            this.renderRecentMatches(this.matchRankings.slice(0, 10));
        } catch(e) { console.error(e); } finally { this.hideLoading(); }
    }

    renderAvgChart(matches,turns){const ctx=document.getElementById('chart-avg-comparison');if(!ctx)return;const byMp={};turns.forEach(t=>{if(t.points!==null){if(!byMp[t.match_player_id])byMp[t.match_player_id]={all:[],sc:[]};byMp[t.match_player_id].all.push(t.points);if(t.score_remaining===null||t.score_remaining>100)byMp[t.match_player_id].sc.push(t.points);}});const md=matches.map(mp=>{const d=byMp[mp.id]||{all:[],sc:[]};return{date:new Date(mp.match.finished_at),avgAll:d.all.length?d.all.reduce((a,b)=>a+b,0)/d.all.length:null,avgSc:d.sc.length?d.sc.reduce((a,b)=>a+b,0)/d.sc.length:null};}).filter(m=>m.avgAll!==null).sort((a,b)=>a.date-b.date);if(!md.length)return;const days=Math.ceil((md[md.length-1].date-md[0].date)/864e5);let dp;if(days>180){const byM={};md.forEach(m=>{const k=m.date.toISOString().slice(0,7);if(!byM[k])byM[k]={all:[],sc:[]};byM[k].all.push(m.avgAll);if(m.avgSc)byM[k].sc.push(m.avgSc);});dp=Object.entries(byM).sort((a,b)=>a[0].localeCompare(b[0])).map(([m,d])=>({l:new Date(m+'-01').toLocaleDateString('de-DE',{month:'short',year:'2-digit'}),a:d.all.reduce((x,y)=>x+y,0)/d.all.length,s:d.sc.length?d.sc.reduce((x,y)=>x+y,0)/d.sc.length:null}));}else{dp=md.slice(-30).map(m=>({l:m.date.toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit'}),a:m.avgAll,s:m.avgSc}));}if(this.avgCompChart)this.avgCompChart.destroy();this.avgCompChart=new Chart(ctx,{type:'line',data:{labels:dp.map(d=>d.l),datasets:[{label:'Avg bis 100',data:dp.map(d=>d.s?.toFixed(1)),borderColor:CONFIG.COLORS.blue,fill:false,tension:.3},{label:'Match Avg',data:dp.map(d=>d.a.toFixed(1)),borderColor:CONFIG.COLORS.green,backgroundColor:'rgba(16,185,129,.1)',fill:true,tension:.3}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'top',labels:{color:'#94a3b8'}}},scales:{x:{grid:{color:'rgba(255,255,255,.1)'},ticks:{color:'#94a3b8',maxRotation:45,font:{size:10}}},y:{grid:{color:'rgba(255,255,255,.1)'},ticks:{color:'#94a3b8'},suggestedMin:30,suggestedMax:55}}}});}
    renderResultsChart(w,l){const ctx=document.getElementById('chart-results');if(!ctx)return;if(this.resChart)this.resChart.destroy();this.resChart=new Chart(ctx,{type:'doughnut',data:{labels:['Siege','Niederl.'],datasets:[{data:[w,l],backgroundColor:[CONFIG.COLORS.green,CONFIG.COLORS.red],borderWidth:0}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom',labels:{color:'#94a3b8'}}},cutout:'65%'}});}
    renderFirst9Chart(turns){const ctx=document.getElementById('chart-first9-comparison');if(!ctx)return;let f9=0,f9c=0,r=0,rc=0;turns.forEach(t=>{if(t.points!==null){if(t.round<=3){f9+=t.points;f9c++;}else{r+=t.points;rc++;}}});if(this.f9Chart)this.f9Chart.destroy();this.f9Chart=new Chart(ctx,{type:'bar',data:{labels:['First 9','Rest'],datasets:[{data:[f9c?(f9/f9c).toFixed(1):0,rc?(r/rc).toFixed(1):0],backgroundColor:[CONFIG.COLORS.green,CONFIG.COLORS.blue],borderRadius:8}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{grid:{display:false},ticks:{color:'#94a3b8'}},y:{grid:{color:'rgba(255,255,255,.1)'},ticks:{color:'#94a3b8'},suggestedMin:30,suggestedMax:50}}}});}
    renderScoringChart(turns){const ctx=document.getElementById('chart-scoring-distribution');if(!ctx)return;let u40=0,s40=0,s60=0,s100=0,s140=0,s180=0;turns.forEach(t=>{if(t.points===null)return;if(t.points===180)s180++;else if(t.points>=140)s140++;else if(t.points>=100)s100++;else if(t.points>=60)s60++;else if(t.points>=40)s40++;else u40++;});if(this.scorChart)this.scorChart.destroy();this.scorChart=new Chart(ctx,{type:'doughnut',data:{labels:['<40','40-59','60-99','100-139','140-179','180'],datasets:[{data:[u40,s40,s60,s100,s140,s180],backgroundColor:['#64748b','#94a3b8','#3b82f6','#8b5cf6','#f59e0b','#10b981'],borderWidth:0}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'right',labels:{color:'#94a3b8',font:{size:11}}}},cutout:'50%'}});}
    renderHighScoresChart(turns){const ctx=document.getElementById('chart-high-scores');if(!ctx)return;const mon={};turns.forEach(t=>{if(t.points===null||!t.created_at)return;const m=t.created_at.slice(0,7);if(!mon[m])mon[m]={s180:0,s140:0,s100:0};if(t.points===180)mon[m].s180++;else if(t.points>=140)mon[m].s140++;else if(t.points>=100)mon[m].s100++;});const ms=Object.keys(mon).sort().slice(-8);if(this.hsChart)this.hsChart.destroy();this.hsChart=new Chart(ctx,{type:'bar',data:{labels:ms.map(m=>new Date(m+'-01').toLocaleDateString('de-DE',{month:'short'})),datasets:[{label:'180s',data:ms.map(m=>mon[m].s180),backgroundColor:CONFIG.COLORS.green},{label:'140+',data:ms.map(m=>mon[m].s140),backgroundColor:CONFIG.COLORS.yellow},{label:'100+',data:ms.map(m=>mon[m].s100),backgroundColor:CONFIG.COLORS.blue}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'top',labels:{color:'#94a3b8',font:{size:10}}}},scales:{x:{stacked:true,grid:{display:false},ticks:{color:'#94a3b8'}},y:{stacked:true,grid:{color:'rgba(255,255,255,.1)'},ticks:{color:'#94a3b8'}}}}});}
    renderRecentMatches(matches){const tb=document.querySelector('#recent-matches-table tbody');if(!tb)return;const total=this.matchRankings.length;tb.innerHTML=matches.map(mp=>{const m=mp.match,d=new Date(m.finished_at),w=m.winner===mp.player_index,opp=this.opponentMap[mp.match_id],on=opp?(opp.is_bot?'🤖 Bot '+Math.round((opp.cpu_ppr||40)/10):opp.name||'Gegner'):'?',avg=mp.calcAvg||0,pc=avg>this.overallAverage+5?'perf-great':avg>this.overallAverage?'perf-good':avg>this.overallAverage-5?'perf-ok':'perf-bad',pt=avg>this.overallAverage+5?'🔥 Super':avg>this.overallAverage?'✅ Gut':avg>this.overallAverage-5?'➖ Ok':'❌ Schwach';return'<tr><td>'+d.toLocaleDateString('de-DE')+'</td><td>'+on+'</td><td class="'+(w?'result-win':'result-loss')+'">'+(w?'✅':'❌')+'</td><td>'+avg.toFixed(1)+'</td><td class="'+pc+'">'+pt+'</td><td>'+this.getRankBadge(mp.avgRank,total)+'</td></tr>';}).join('');}

    // ========== LEGS PAGE (NEU) ==========
    async loadLegsPage() {
        this.showLoading();
        try {
            const matches = this.getFilteredData();
            const mpIds = matches.map(m => m.id);
            const matchIds = [...new Set(matches.map(m => m.match_id))];

            // Titel je nach Ansicht
            const pageTitle = document.getElementById('legs-page-title');
            if (pageTitle) {
                pageTitle.textContent = this.filters.view === 'legs' ? '🎯 Legs' : '🎮 Matches';
            }

            if (this.filters.view === 'legs') {
                // Lade Leg-Daten aus der Materialized View
                const legBatches = [];
                for (let i = 0; i < matchIds.length; i += 100) legBatches.push(matchIds.slice(i, i + 100));
                const legResults = await Promise.all(legBatches.map(batch => window.db.from('leg_averages').select('*').in('match_id', batch)));
                const allLegAvgs = legResults.flatMap(r => r.data || []);

                // Nur Legs des aktuellen Spielers
                const mpIdSet = new Set(mpIds);
                const myLegs = allLegAvgs.filter(l => mpIdSet.has(l.match_player_id));

                // Lade Legs für Winner-Info
                const legIds = myLegs.map(l => l.leg_id);
                const legsBatches = [];
                for (let i = 0; i < matchIds.length; i += 100) legsBatches.push(matchIds.slice(i, i + 100));
                const legsResults = await Promise.all(legsBatches.map(batch => window.db.from('legs').select('*').in('match_id', batch)));
                const allLegs = legsResults.flatMap(r => r.data || []);
                const legsMap = {};
                allLegs.forEach(l => { legsMap[l.id] = l; });

                // Sortieren und Rangliste erstellen
                const legData = myLegs.map(l => {
                    const mp = matches.find(m => m.id === l.match_player_id);
                    const leg = legsMap[l.leg_id];
                    return {
                        legId: l.leg_id,
                        matchId: l.match_id,
                        mpId: l.match_player_id,
                        avg: l.three_dart_avg || 0,
                        totalDarts: l.total_darts,
                        legNumber: leg?.leg_number ?? 0,
                        won: leg?.winner_player_id === l.match_player_id,
                        match: mp?.match,
                        mp: mp
                    };
                }).filter(l => l.match);

                // Nach Average sortieren für Rang
                legData.sort((a, b) => b.avg - a.avg);
                legData.forEach((l, i) => { l.rank = i + 1; });

                // Nach Datum sortieren für Anzeige
                const sortedLegs = [...legData].sort((a, b) => new Date(b.match.finished_at) - new Date(a.match.finished_at));

                this.currentLegsData = sortedLegs;
                this.renderLegsTable(sortedLegs.slice(0, 50));
            } else {
                // Match-Ansicht (wie bisher)
                const turns = await this.loadTurns(mpIds);
                const byMp = {};
                turns.forEach(t => {
                    if (t.points !== null) {
                        if (!byMp[t.match_player_id]) byMp[t.match_player_id] = [];
                        byMp[t.match_player_id].push(t.points);
                    }
                });

                const matchData = matches.map(mp => {
                    const t = byMp[mp.id] || [];
                    const calcAvg = t.length ? t.reduce((a, b) => a + b, 0) / t.length : (mp.average || 0);
                    return { ...mp, calcAvg, isWin: mp.match.winner === mp.player_index };
                });
                this.matchRankings = this.calcRankings(matchData);
                this.currentLegsData = this.matchRankings;
                this.renderMatchesTable(this.matchRankings.slice(0, 50));
            }
        } catch (e) { console.error(e); }
        finally { this.hideLoading(); }
    }

    renderLegsTable(legs) {
        const tb = document.querySelector('#legs-table tbody');
        if (!tb) return;
        const total = this.currentLegsData.length;

        tb.innerHTML = legs.map((leg, idx) => {
            const m = leg.match;
            const d = new Date(m.finished_at);
            const opp = this.opponentMap[leg.matchId];
            const oppName = opp ? (opp.is_bot ? '🤖 Bot ' + Math.round((opp.cpu_ppr || 40) / 10) : opp.name || 'Gegner') : '?';
            const checkout = leg.won ? '✅' : '-';

            return '<tr onclick="window.app.openLegDetail(\'' + leg.legId + '\')" style="cursor:pointer">' +
                '<td>' + (idx + 1) + '</td>' +
                '<td>' + d.toLocaleDateString('de-DE') + '</td>' +
                '<td>' + oppName + '</td>' +
                '<td>Leg ' + (leg.legNumber + 1) + '</td>' +
                '<td><strong>' + leg.avg.toFixed(1) + '</strong></td>' +
                '<td>' + (leg.totalDarts || '-') + '</td>' +
                '<td>' + checkout + '</td>' +
                '<td>' + this.getRankBadge(leg.rank, total) + '</td>' +
                '<td>→</td>' +
                '</tr>';
        }).join('');
    }

    renderMatchesTable(matches) {
        const tb = document.querySelector('#legs-table tbody');
        if (!tb) return;
        const total = matches.length;

        tb.innerHTML = matches.map((mp, idx) => {
            const m = mp.match;
            const d = new Date(m.finished_at);
            const w = mp.isWin;
            const opp = this.opponentMap[mp.match_id];
            const oppName = opp ? (opp.is_bot ? '🤖 Bot ' + Math.round((opp.cpu_ppr || 40) / 10) : opp.name || 'Gegner') : '?';

            return '<tr onclick="window.app.openMatchDetail(\'' + mp.match_id + '\')" style="cursor:pointer">' +
                '<td>' + (idx + 1) + '</td>' +
                '<td>' + d.toLocaleDateString('de-DE') + '</td>' +
                '<td>' + oppName + '</td>' +
                '<td>' + (mp.legs_won || 0) + ':' + (mp.legs_lost || 0) + '</td>' +
                '<td><strong>' + mp.calcAvg.toFixed(1) + '</strong></td>' +
                '<td>-</td>' +
                '<td class="' + (w ? 'result-win' : 'result-loss') + '">' + (w ? '✅' : '❌') + '</td>' +
                '<td>' + this.getRankBadge(mp.avgRank, total) + '</td>' +
                '<td>→</td>' +
                '</tr>';
        }).join('');
    }

    async openLegDetail(legId) {
        const panel = document.getElementById('leg-detail-panel');
        if (!panel) return;

        // Lade Leg-Daten
        const legData = this.currentLegsData?.find(l => l.legId === legId);
        if (!legData) return;

        // Panel öffnen
        panel.classList.remove('hidden');
        setTimeout(() => panel.classList.add('visible'), 10);

        // Titel
        const title = document.getElementById('leg-detail-title');
        if (title) {
            const d = new Date(legData.match.finished_at);
            title.textContent = 'Leg ' + (legData.legNumber + 1) + ' - ' + d.toLocaleDateString('de-DE');
        }

        // Stats
        document.getElementById('ld-average').textContent = legData.avg.toFixed(1);
        document.getElementById('ld-darts').textContent = legData.totalDarts || '-';
        document.getElementById('ld-checkout').textContent = legData.won ? '✅' : '-';
        document.getElementById('ld-rank').textContent = '#' + legData.rank;

        // Lade Turns für dieses Leg
        const { data: turns } = await window.db.from('turns').select('*').eq('leg_id', legId).order('created_at');
        if (!turns) return;

        const myTurns = turns.filter(t => t.match_player_id === legData.mpId);

        // First 9 berechnen
        const f9 = myTurns.filter(t => t.round <= 3 && t.points !== null);
        const f9Avg = f9.length ? f9.reduce((s, t) => s + t.points, 0) / f9.length : 0;
        document.getElementById('ld-first9').textContent = f9Avg.toFixed(1);

        // Visits-Tabelle
        this.renderLegVisitsTable(myTurns);

        // Charts
        this.renderLegProgressionChart(myTurns);
        this.renderLegScoringChart(myTurns);
    }

    renderLegVisitsTable(turns) {
        const tb = document.querySelector('#ld-visits-table tbody');
        if (!tb) return;

        tb.innerHTML = turns.map((t, i) => {
            return '<tr>' +
                '<td>' + (i + 1) + '</td>' +
                '<td><strong>' + (t.points || 0) + '</strong></td>' +
                '<td>' + (t.score_remaining ?? '-') + '</td>' +
                '<td>-</td>' +
                '</tr>';
        }).join('');
    }

    renderLegProgressionChart(turns) {
        const ctx = document.getElementById('ld-chart-progression');
        if (!ctx) return;

        const data = [];
        let remaining = 501;
        turns.forEach((t, i) => {
            if (t.points !== null) remaining -= t.points;
            data.push({ x: i + 1, y: remaining > 0 ? remaining : 0 });
        });

        if (this.ldProgChart) this.ldProgChart.destroy();
        this.ldProgChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.map(d => d.x),
                datasets: [{
                    data: data.map(d => d.y),
                    borderColor: CONFIG.COLORS.green,
                    backgroundColor: 'rgba(16,185,129,0.1)',
                    fill: true,
                    tension: 0.3
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: { grid: { color: 'rgba(255,255,255,0.1)' }, ticks: { color: '#94a3b8' } },
                    y: { grid: { color: 'rgba(255,255,255,0.1)' }, ticks: { color: '#94a3b8' }, reverse: false, min: 0 }
                }
            }
        });
    }

    renderLegScoringChart(turns) {
        const ctx = document.getElementById('ld-chart-scoring');
        if (!ctx) return;

        let u60 = 0, s60 = 0, s100 = 0, s140 = 0, s180 = 0;
        turns.forEach(t => {
            if (t.points === null) return;
            if (t.points === 180) s180++;
            else if (t.points >= 140) s140++;
            else if (t.points >= 100) s100++;
            else if (t.points >= 60) s60++;
            else u60++;
        });

        if (this.ldScoreChart) this.ldScoreChart.destroy();
        this.ldScoreChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['180', '140+', '100+', '60+', '<60'],
                datasets: [{
                    data: [s180, s140, s100, s60, u60],
                    backgroundColor: ['#10b981', '#f59e0b', '#8b5cf6', '#3b82f6', '#64748b']
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'bottom', labels: { color: '#94a3b8', font: { size: 10 } } } },
                cutout: '50%'
            }
        });
    }

    closeLegDetail() {
        const panel = document.getElementById('leg-detail-panel');
        if (panel) {
            panel.classList.remove('visible');
            setTimeout(() => panel.classList.add('hidden'), 300);
        }
    }

    openMatchDetail(matchId) {
        // Navigiert zur alten Match-Detail-Seite (später durch neues Detail-Panel ersetzen)
        document.getElementById('match-detail-select').value = matchId;
        this.navigateTo('matchdetail');
        this.loadMatchDetail(matchId);
    }

    // ========== SCORING ==========
    async loadScoringData(){this.showLoading();try{const matches=this.getFilteredData(),mpIds=matches.map(m=>m.id),turns=await this.loadTurns(mpIds),tids=turns.map(t=>t.id),throws=await this.loadThrows(tids);const t20=throws.filter(t=>[20,1,5].includes(t.segment_number)),t20h=t20.filter(t=>t.segment_bed==='Triple'&&t.segment_number===20).length,t20r=t20.length?((t20h/t20.length)*100).toFixed(1):0;const t19=throws.filter(t=>[19,3,7].includes(t.segment_number)),t19h=t19.filter(t=>t.segment_bed==='Triple'&&t.segment_number===19).length,t19r=t19.length?((t19h/t19.length)*100).toFixed(1):0;let c100=0,c140=0,c180=0;turns.forEach(t=>{if(t.points===180)c180++;else if(t.points>=140)c140++;else if(t.points>=100)c100++;});document.getElementById('stat-t20-rate').textContent=t20r+'%';document.getElementById('stat-t19-rate').textContent=t19r+'%';document.getElementById('stat-100plus').textContent=c100+c140+c180;document.getElementById('stat-140plus').textContent=c140+c180;document.getElementById('stat-180s-total').textContent=c180;document.getElementById('stat-visits-per-100').textContent=turns.length?((c100+c140+c180)/turns.length*100).toFixed(1)+'%':'0%';this.renderT20Chart(t20,t19);this.renderScoreFreqChart(turns);this.renderFirst9TrendChart(matches,turns);this.renderVisitsChart(turns);}catch(e){console.error(e);}finally{this.hideLoading();}}
    renderT20Chart(t20,t19){const ctx=document.getElementById('chart-t20-distribution');if(!ctx)return;const c20={T:0,S:0,N:0},c19={T:0,S:0,N:0};t20.forEach(t=>{if(t.segment_bed==='Triple'&&t.segment_number===20)c20.T++;else if(t.segment_number===20)c20.S++;else c20.N++;});t19.forEach(t=>{if(t.segment_bed==='Triple'&&t.segment_number===19)c19.T++;else if(t.segment_number===19)c19.S++;else c19.N++;});if(this.t20Chart)this.t20Chart.destroy();this.t20Chart=new Chart(ctx,{type:'bar',data:{labels:['Triple','Single','Nachbar'],datasets:[{label:'T20',data:[c20.T,c20.S,c20.N],backgroundColor:CONFIG.COLORS.green},{label:'T19',data:[c19.T,c19.S,c19.N],backgroundColor:CONFIG.COLORS.blue}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'top',labels:{color:'#94a3b8'}}},scales:{x:{grid:{display:false},ticks:{color:'#94a3b8'}},y:{grid:{color:'rgba(255,255,255,.1)'},ticks:{color:'#94a3b8'}}}}});}
    renderScoreFreqChart(turns){const ctx=document.getElementById('chart-score-frequency');if(!ctx)return;const b={'0-19':0,'20-39':0,'40-59':0,'60-79':0,'80-99':0,'100-119':0,'120-139':0,'140-159':0,'160-180':0};turns.forEach(t=>{if(t.points===null)return;const p=t.points;if(p<20)b['0-19']++;else if(p<40)b['20-39']++;else if(p<60)b['40-59']++;else if(p<80)b['60-79']++;else if(p<100)b['80-99']++;else if(p<120)b['100-119']++;else if(p<140)b['120-139']++;else if(p<160)b['140-159']++;else b['160-180']++;});if(this.sfChart)this.sfChart.destroy();this.sfChart=new Chart(ctx,{type:'bar',data:{labels:Object.keys(b),datasets:[{data:Object.values(b),backgroundColor:CONFIG.COLORS.blue,borderRadius:4}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{grid:{display:false},ticks:{color:'#94a3b8',font:{size:9}}},y:{grid:{color:'rgba(255,255,255,.1)'},ticks:{color:'#94a3b8'}}}}});}
    renderFirst9TrendChart(matches,turns){const ctx=document.getElementById('chart-first9-trend');if(!ctx)return;const byMp={};turns.filter(t=>t.round<=3&&t.points!==null).forEach(t=>{if(!byMp[t.match_player_id])byMp[t.match_player_id]=[];byMp[t.match_player_id].push(t.points);});const d=matches.map(mp=>({dt:new Date(mp.match.finished_at),avg:byMp[mp.id]?.length?byMp[mp.id].reduce((a,b)=>a+b,0)/byMp[mp.id].length:null})).filter(x=>x.avg!==null).sort((a,b)=>a.dt-b.dt).slice(-20);if(this.f9TChart)this.f9TChart.destroy();this.f9TChart=new Chart(ctx,{type:'line',data:{labels:d.map(x=>x.dt.toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit'})),datasets:[{data:d.map(x=>x.avg.toFixed(1)),borderColor:CONFIG.COLORS.green,tension:.3,fill:true,backgroundColor:'rgba(16,185,129,.1)'}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{grid:{color:'rgba(255,255,255,.1)'},ticks:{color:'#94a3b8'}},y:{grid:{color:'rgba(255,255,255,.1)'},ticks:{color:'#94a3b8'},suggestedMin:35,suggestedMax:55}}}});}
    renderVisitsChart(turns){const ctx=document.getElementById('chart-visits-breakdown');if(!ctx)return;let c60=0,c100=0,c140=0,c180=0,o=0;turns.forEach(t=>{if(t.points===null)return;if(t.points===180)c180++;else if(t.points>=140)c140++;else if(t.points>=100)c100++;else if(t.points>=60)c60++;else o++;});if(this.vChart)this.vChart.destroy();this.vChart=new Chart(ctx,{type:'doughnut',data:{labels:['180','140+','100+','60+','<60'],datasets:[{data:[c180,c140,c100,c60,o],backgroundColor:['#10b981','#f59e0b','#8b5cf6','#3b82f6','#64748b']}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'right',labels:{color:'#94a3b8'}}}}});}
    
    // ========== CHECKOUT ==========
    async loadCheckoutData(){this.showLoading();try{const matches=this.getFilteredData(),mpIds=matches.map(m=>m.id);let cSum=0,cCnt=0;matches.forEach(mp=>{if(mp.checkout_rate>0){cSum+=mp.checkout_rate;cCnt++;}});const turns=await this.loadTurns(mpIds),coTurns=turns.filter(t=>t.score_remaining===0),coTids=coTurns.map(t=>t.id),coThrows=await this.loadThrows(coTids,10000),dblThrows=coThrows.filter(t=>t.segment_bed==='Double'),dblCnt={};dblThrows.forEach(t=>{dblCnt[t.segment_name]=(dblCnt[t.segment_name]||0)+1;});const sorted=Object.entries(dblCnt).sort((a,b)=>b[1]-a[1]),highest=Math.max(...coTurns.map(t=>t.points||0),0);document.getElementById('stat-checkout-total').textContent=cCnt?((cSum/cCnt)*100).toFixed(1)+'%':'-';document.getElementById('stat-favorite-double').textContent=sorted[0]?.[0]||'-';document.getElementById('stat-highest-checkout').textContent=highest||'-';document.getElementById('stat-total-checkouts').textContent=coTurns.length;document.getElementById('stat-checkout-opportunities').textContent='-';document.getElementById('stat-best-double').textContent=sorted[0]?.[0]||'-';this.renderDoublesChart(sorted.slice(0,10));this.renderCheckoutScoreChart(coTurns);this.renderCheckoutTable(sorted);}catch(e){console.error(e);}finally{this.hideLoading();}}
    renderDoublesChart(d){const ctx=document.getElementById('chart-favorite-doubles');if(!ctx)return;if(this.dblChart)this.dblChart.destroy();this.dblChart=new Chart(ctx,{type:'bar',data:{labels:d.map(x=>x[0]),datasets:[{data:d.map(x=>x[1]),backgroundColor:CONFIG.COLORS.green,borderRadius:6}]},options:{responsive:true,maintainAspectRatio:false,indexAxis:'y',plugins:{legend:{display:false}},scales:{x:{grid:{color:'rgba(255,255,255,.1)'},ticks:{color:'#94a3b8'}},y:{grid:{display:false},ticks:{color:'#94a3b8'}}}}});}
    renderCheckoutScoreChart(coTurns){const ctx=document.getElementById('chart-checkout-by-score');if(!ctx)return;const r={'2-40':0,'41-60':0,'61-80':0,'81-100':0,'101-120':0,'121+':0};coTurns.forEach(c=>{const s=c.points;if(!s)return;if(s<=40)r['2-40']++;else if(s<=60)r['41-60']++;else if(s<=80)r['61-80']++;else if(s<=100)r['81-100']++;else if(s<=120)r['101-120']++;else r['121+']++;});if(this.coScChart)this.coScChart.destroy();this.coScChart=new Chart(ctx,{type:'bar',data:{labels:Object.keys(r),datasets:[{data:Object.values(r),backgroundColor:CONFIG.COLORS.blue,borderRadius:6}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{grid:{display:false},ticks:{color:'#94a3b8'}},y:{grid:{color:'rgba(255,255,255,.1)'},ticks:{color:'#94a3b8'}}}}});}
    renderCheckoutTable(d){const tb=document.querySelector('#checkout-table tbody');if(!tb)return;const tot=d.reduce((s,x)=>s+x[1],0)||1;tb.innerHTML=d.slice(0,15).map(x=>'<tr><td><strong>'+x[0]+'</strong></td><td>'+x[1]+'</td><td>-</td><td>'+((x[1]/tot)*100).toFixed(1)+'%</td></tr>').join('');}
    
    // ========== MATCHES ==========
    async loadMatchesPage(){this.showLoading();try{const matches=this.getFilteredData(),mpIds=matches.map(m=>m.id),turns=await this.loadTurns(mpIds);const byMp={};turns.forEach(t=>{if(t.points!==null){if(!byMp[t.match_player_id])byMp[t.match_player_id]=[];byMp[t.match_player_id].push(t.points);}});const matchData=matches.map(mp=>{const t=byMp[mp.id]||[];return{...mp,calcAvg:t.length?t.reduce((a,b)=>a+b,0)/t.length:(mp.average||0),isWin:mp.match.winner===mp.player_index};});this.matchRankings=this.calcRankings(matchData);const total=this.matchRankings.length;const tb=document.querySelector('#all-matches-table tbody');if(tb)tb.innerHTML=this.matchRankings.map(mp=>{const m=mp.match,d=new Date(m.finished_at),w=mp.isWin,opp=this.opponentMap[mp.match_id],on=opp?(opp.is_bot?'🤖 Bot '+Math.round((opp.cpu_ppr||40)/10):opp.name||'Gegner'):'?',avg=mp.calcAvg;return'<tr><td>'+d.toLocaleDateString('de-DE')+' '+d.toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'})+'</td><td>'+on+'</td><td class="'+(w?'result-win':'result-loss')+'">'+(w?'✅':'❌')+'</td><td>'+(mp.legs_won||0)+'</td><td>'+avg.toFixed(1)+'</td><td>'+this.getRankBadge(mp.avgRank,total)+'</td><td>'+(m.variant||'-')+'</td><td><span class="badge badge-'+(m.type||'online').toLowerCase()+'">'+(m.type||'')+'</span></td></tr>';}).join('');}catch(e){console.error(e);}finally{this.hideLoading();}}
    
    // ========== HEATMAP ==========
    async loadHeatmapData(){this.showLoading();try{const matches=this.getFilteredData(),mpIds=matches.map(m=>m.id),turns=await this.loadTurns(mpIds),tids=turns.map(t=>t.id),target=document.getElementById('heatmap-target')?.value||'all';let throws=await this.loadThrows(tids,10000);if(target==='20')throws=throws.filter(t=>[20,1,5].includes(t.segment_number));else if(target==='19')throws=throws.filter(t=>[19,3,7].includes(t.segment_number));else if(target==='18')throws=throws.filter(t=>[18,4,1].includes(t.segment_number));else if(target==='doubles')throws=throws.filter(t=>t.segment_bed==='Double');const wc=throws.filter(t=>t.coord_x!=null&&t.coord_y!=null);let gs='-',dx='-',dy='-';if(wc.length>10){const ax=wc.reduce((s,t)=>s+t.coord_x,0)/wc.length,ay=wc.reduce((s,t)=>s+t.coord_y,0)/wc.length,vx=wc.reduce((s,t)=>s+Math.pow(t.coord_x-ax,2),0)/wc.length,vy=wc.reduce((s,t)=>s+Math.pow(t.coord_y-ay,2),0)/wc.length;gs=(Math.sqrt(vx+vy)*170).toFixed(0);dx=ax>.02?'→ Rechts':ax<-.02?'← Links':'○ Mitte';dy=ay>.02?'↑ Hoch':ay<-.02?'↓ Tief':'○ Mitte';}document.getElementById('stat-grouping-score').textContent=gs;document.getElementById('stat-drift-x').textContent=dx;document.getElementById('stat-drift-y').textContent=dy;document.getElementById('stat-total-throws').textContent=wc.length;this.renderDartboard(wc);this.renderSegmentStats(throws);}catch(e){console.error(e);}finally{this.hideLoading();}}
    renderDartboard(throws){const cv=document.getElementById('dartboard-canvas');if(!cv)return;const ctx=cv.getContext('2d'),cx=cv.width/2,cy=cv.height/2,r=220;ctx.fillStyle='#1e293b';ctx.fillRect(0,0,cv.width,cv.height);[{r:r,c:'#1a1a2e'},{r:r*.85,c:'#252540'},{r:r*.65,c:'#1a1a2e'},{r:r*.45,c:'#252540'},{r:r*.15,c:'#10b981'},{r:r*.06,c:'#ef4444'}].forEach(x=>{ctx.beginPath();ctx.arc(cx,cy,x.r,0,Math.PI*2);ctx.fillStyle=x.c;ctx.fill();});throws.forEach(t=>{ctx.beginPath();ctx.arc(cx+t.coord_x*180,cy-t.coord_y*180,3,0,Math.PI*2);ctx.fillStyle='rgba(16,185,129,.6)';ctx.fill();});}
    renderSegmentStats(throws){const c=document.getElementById('segment-stats');if(!c)return;const cnt={};throws.forEach(t=>{if(t.segment_name&&t.segment_name!=='Outside')cnt[t.segment_name]=(cnt[t.segment_name]||0)+1;});const s=Object.entries(cnt).sort((a,b)=>b[1]-a[1]).slice(0,10),mx=s[0]?.[1]||1;c.innerHTML=s.map(x=>'<div class="segment-stat"><span class="segment-name">'+x[0]+'</span><div class="segment-bar"><div class="segment-bar-fill" style="width:'+((x[1]/mx)*100)+'%"></div></div><span class="segment-count">'+x[1]+'</span></div>').join('');}
    
    // ========== OPPONENTS ==========
    async loadOpponentsData(){this.showLoading();try{const matches=this.getFilteredData(),os={};let bw=0,bt=0,hw=0,ht=0,myS=0,opS=0,ac=0;matches.forEach(mp=>{const opp=this.opponentMap[mp.match_id];if(!opp)return;const w=mp.match.winner===mp.player_index,k=opp.is_bot?'🤖 Bot '+Math.round((opp.cpu_ppr||40)/10):(opp.name||opp.id);if(!os[k])os[k]={name:k,m:0,w:0,last:null,isBot:opp.is_bot,myAvg:0,opAvg:0,lvl:opp.is_bot?Math.round((opp.cpu_ppr||40)/10):0};os[k].m++;if(w)os[k].w++;if(!os[k].last||mp.match.finished_at>os[k].last)os[k].last=mp.match.finished_at;if(mp.average>0)os[k].myAvg+=mp.average;if(opp.average>0)os[k].opAvg+=opp.average;if(opp.is_bot){bt++;if(w)bw++;}else{ht++;if(w)hw++;}if(mp.average>0&&opp.average>0){myS+=mp.average;opS+=opp.average;ac++;}});const so=Object.values(os).sort((a,b)=>b.m-a.m),nem=so.filter(o=>o.m>=3&&(o.w/o.m)<.5).sort((a,b)=>(a.w/a.m)-(b.w/b.m))[0],vic=so.filter(o=>o.m>=3&&(o.w/o.m)>.5).sort((a,b)=>(b.w/b.m)-(a.w/a.m))[0],ad=ac?((myS-opS)/ac).toFixed(1):'-';document.getElementById('stat-unique-opponents').textContent=so.filter(o=>!o.isBot).length;document.getElementById('stat-vs-bots').textContent=bt?((bw/bt)*100).toFixed(0)+'%':'-';document.getElementById('stat-vs-humans').textContent=ht?((hw/ht)*100).toFixed(0)+'%':'-';document.getElementById('stat-nemesis').textContent=nem?.name||'-';document.getElementById('stat-favorite-victim').textContent=vic?.name||'-';document.getElementById('stat-avg-vs-opponents').textContent=ad!=='-'?(ad>0?'+':'')+ad:'-';this.renderBotLevelChart(so);this.renderTopOppsChart(so.slice(0,8));this.renderOpponentsTable(so);}catch(e){console.error(e);}finally{this.hideLoading();}}
    renderBotLevelChart(os){const ctx=document.getElementById('chart-winrate-by-bot-level');if(!ctx)return;const bl={};os.filter(o=>o.isBot).forEach(o=>{const l=o.lvl;if(!bl[l])bl[l]={w:0,t:0};bl[l].w+=o.w;bl[l].t+=o.m;});const ls=Object.keys(bl).sort((a,b)=>a-b),wr=ls.map(l=>bl[l].t?((bl[l].w/bl[l].t)*100).toFixed(0):0);if(this.blChart)this.blChart.destroy();this.blChart=new Chart(ctx,{type:'bar',data:{labels:ls.map(l=>'Lvl '+l),datasets:[{data:wr,backgroundColor:wr.map(r=>r>=50?CONFIG.COLORS.green:CONFIG.COLORS.red),borderRadius:6}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{grid:{display:false},ticks:{color:'#94a3b8'}},y:{grid:{color:'rgba(255,255,255,.1)'},ticks:{color:'#94a3b8'},max:100}}}});}
    renderTopOppsChart(os){const ctx=document.getElementById('chart-top-opponents');if(!ctx)return;if(this.toChart)this.toChart.destroy();this.toChart=new Chart(ctx,{type:'bar',data:{labels:os.map(o=>o.name.substring(0,12)),datasets:[{label:'Siege',data:os.map(o=>o.w),backgroundColor:CONFIG.COLORS.green},{label:'Niederl.',data:os.map(o=>o.m-o.w),backgroundColor:CONFIG.COLORS.red}]},options:{responsive:true,maintainAspectRatio:false,indexAxis:'y',plugins:{legend:{position:'top',labels:{color:'#94a3b8'}}},scales:{x:{stacked:true,grid:{color:'rgba(255,255,255,.1)'},ticks:{color:'#94a3b8'}},y:{stacked:true,grid:{display:false},ticks:{color:'#94a3b8',font:{size:10}}}}}});}
    renderOpponentsTable(os){const tb=document.querySelector('#opponents-table tbody');if(!tb)return;tb.innerHTML=os.slice(0,30).map(o=>{const wr=((o.w/o.m)*100).toFixed(0),ma=o.m&&o.myAvg?(o.myAvg/o.m).toFixed(1):'-',oa=o.m&&o.opAvg?(o.opAvg/o.m).toFixed(1):'-';return'<tr><td>'+o.name+'</td><td>'+o.m+'</td><td class="result-win">'+o.w+'</td><td class="result-loss">'+(o.m-o.w)+'</td><td>'+wr+'%</td><td>'+ma+'</td><td>'+oa+'</td><td>'+(o.last?new Date(o.last).toLocaleDateString('de-DE'):'-')+'</td></tr>';}).join('');}
    
    // ========== ADVANCED ==========
    async loadAdvancedData(){this.showLoading();try{const matches=this.getFilteredData(),bh={},bd={},dn=['So','Mo','Di','Mi','Do','Fr','Sa'];let tl=0,mc=0;matches.forEach(mp=>{const d=new Date(mp.match.finished_at),h=d.getHours(),day=d.getDay(),ts=h<12?'Morgen':h<17?'Nachmittag':h<21?'Abend':'Nacht';if(!bh[ts])bh[ts]={w:0,t:0,a:0};bh[ts].t++;if(mp.match.winner===mp.player_index)bh[ts].w++;if(mp.average>0)bh[ts].a+=mp.average;if(!bd[day])bd[day]={w:0,t:0,a:0};bd[day].t++;if(mp.match.winner===mp.player_index)bd[day].w++;if(mp.average>0)bd[day].a+=mp.average;tl+=(mp.legs_won||0)+(mp.legs_lost||0);mc++;});let bt='-',bdy='-',bta=0,bda=0;Object.entries(bh).forEach(([t,d])=>{const a=d.t?d.a/d.t:0;if(a>bta&&d.t>=5){bta=a;bt=t;}});Object.entries(bd).forEach(([day,d])=>{const a=d.t?d.a/d.t:0;if(a>bda&&d.t>=5){bda=a;bdy=dn[day];}});document.getElementById('stat-best-time').textContent=bt;document.getElementById('stat-best-day').textContent=bdy;document.getElementById('stat-avg-legs').textContent=mc?(tl/mc).toFixed(1):'-';document.getElementById('stat-total-playtime').textContent=mc?Math.round(mc*8)+' min':'-';this.renderByTimeChart(bh);this.renderByDayChart(bd,dn);this.renderLegsTrendChart(matches);this.renderConsistencyChart(matches);}catch(e){console.error(e);}finally{this.hideLoading();}}
    renderByTimeChart(bh){const ctx=document.getElementById('chart-by-time');if(!ctx)return;const ts=['Morgen','Nachmittag','Abend','Nacht'],av=ts.map(t=>bh[t]?.t?(bh[t].a/bh[t].t).toFixed(1):0);if(this.btChart)this.btChart.destroy();this.btChart=new Chart(ctx,{type:'bar',data:{labels:ts,datasets:[{data:av,backgroundColor:CONFIG.COLORS.green,borderRadius:6}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{grid:{display:false},ticks:{color:'#94a3b8'}},y:{grid:{color:'rgba(255,255,255,.1)'},ticks:{color:'#94a3b8'},suggestedMin:30,suggestedMax:50}}}});}
    renderByDayChart(bd,dn){const ctx=document.getElementById('chart-by-weekday');if(!ctx)return;const ds=[1,2,3,4,5,6,0],av=ds.map(d=>bd[d]?.t?(bd[d].a/bd[d].t).toFixed(1):0);if(this.bdChart)this.bdChart.destroy();this.bdChart=new Chart(ctx,{type:'bar',data:{labels:ds.map(d=>dn[d]),datasets:[{data:av,backgroundColor:CONFIG.COLORS.blue,borderRadius:6}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{grid:{display:false},ticks:{color:'#94a3b8'}},y:{grid:{color:'rgba(255,255,255,.1)'},ticks:{color:'#94a3b8'},suggestedMin:30,suggestedMax:50}}}});}
    renderLegsTrendChart(matches){const ctx=document.getElementById('chart-legs-trend');if(!ctx)return;const d=matches.slice(0,30).reverse().map(mp=>({l:new Date(mp.match.finished_at).toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit'}),legs:(mp.legs_won||0)+(mp.legs_lost||0)}));if(this.ltChart)this.ltChart.destroy();this.ltChart=new Chart(ctx,{type:'line',data:{labels:d.map(x=>x.l),datasets:[{data:d.map(x=>x.legs),borderColor:CONFIG.COLORS.blue,tension:.3,fill:false}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{grid:{color:'rgba(255,255,255,.1)'},ticks:{color:'#94a3b8',font:{size:9}}},y:{grid:{color:'rgba(255,255,255,.1)'},ticks:{color:'#94a3b8'}}}}});}
    renderConsistencyChart(matches){const ctx=document.getElementById('chart-consistency-trend');if(!ctx)return;const s=[...matches].sort((a,b)=>new Date(a.match.finished_at)-new Date(b.match.finished_at)),d=[];for(let i=9;i<s.length;i++){const w=s.slice(i-9,i+1),av=w.filter(m=>m.average>0).map(m=>m.average);if(av.length){const mn=av.reduce((a,b)=>a+b,0)/av.length,sd=Math.sqrt(av.reduce((x,a)=>x+Math.pow(a-mn,2),0)/av.length);d.push({dt:new Date(s[i].match.finished_at),sd});}}const rd=d.slice(-20);if(this.csChart)this.csChart.destroy();this.csChart=new Chart(ctx,{type:'line',data:{labels:rd.map(x=>x.dt.toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit'})),datasets:[{data:rd.map(x=>x.sd.toFixed(1)),borderColor:CONFIG.COLORS.yellow,tension:.3,fill:true,backgroundColor:'rgba(245,158,11,.1)'}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{grid:{color:'rgba(255,255,255,.1)'},ticks:{color:'#94a3b8',font:{size:9}}},y:{grid:{color:'rgba(255,255,255,.1)'},ticks:{color:'#94a3b8'},reverse:true}}}});}

    // ========== HEAD-TO-HEAD ==========
    async loadH2HData() {
        this.showLoading();
        try {
            // Get all matches where both players participated (parallel)
            const [{ data: franzMatches }, { data: bellaMatches }] = await Promise.all([
                window.db.from('match_players').select('match_id').eq('user_id', FRANZ_ID),
                window.db.from('match_players').select('match_id').eq('user_id', BELLACIAO_ID)
            ]);

            if (!franzMatches || !bellaMatches) { this.hideLoading(); return; }

            const franzMatchIds = new Set(franzMatches.map(m => m.match_id));
            const commonMatchIds = bellaMatches.filter(m => franzMatchIds.has(m.match_id)).map(m => m.match_id);

            if (commonMatchIds.length === 0) {
                document.getElementById('h2h-total-matches').textContent = '0';
                this.hideLoading();
                return;
            }

            // Load match details (parallel batches)
            const matchBatches = []; for (let i = 0; i < commonMatchIds.length; i += 50) matchBatches.push(commonMatchIds.slice(i, i + 50));
            const matchResults = await Promise.all(matchBatches.map(batch => window.db.from('matches').select('*').in('id', batch)));
            let matches = matchResults.flatMap(r => r.data || []);

            // Apply filters (time, type, variant) - but NOT player filter
            if (this.filters.time !== 'all') {
                const days = parseInt(this.filters.time);
                const cutoff = new Date();
                cutoff.setDate(cutoff.getDate() - days);
                matches = matches.filter(m => new Date(m.finished_at) >= cutoff);
            }
            if (this.filters.type) {
                matches = matches.filter(m => m.type === this.filters.type);
            }
            if (this.filters.variant) {
                matches = matches.filter(m => m.variant === this.filters.variant);
            }

            if (matches.length === 0) {
                document.getElementById('h2h-wins1').textContent = '0';
                document.getElementById('h2h-wins2').textContent = '0';
                document.getElementById('h2h-total-matches').textContent = '0';
                document.getElementById('h2h-avg-p1').textContent = '-';
                document.getElementById('h2h-avg-p2').textContent = '-';
                document.getElementById('h2h-legs-p1').textContent = '-';
                document.getElementById('h2h-legs-p2').textContent = '-';
                document.getElementById('h2h-streak').textContent = '-';
                this.hideLoading();
                return;
            }

            // Get filtered match IDs for loading players
            const filteredMatchIds = matches.map(m => m.id);

            // Load match_players for these matches (parallel batches)
            const playerBatches = []; for (let i = 0; i < filteredMatchIds.length; i += 50) playerBatches.push(filteredMatchIds.slice(i, i + 50));
            const playerResults = await Promise.all(playerBatches.map(batch => window.db.from('match_players').select('*').in('match_id', batch)));
            const allPlayers = playerResults.flatMap(r => r.data || []);

            // Load turns for calculating real averages
            const mpIds = allPlayers.map(p => p.id);
            const turns = await this.loadTurns(mpIds);
            const turnsByMp = {};
            turns.forEach(t => {
                if (t.points !== null) {
                    if (!turnsByMp[t.match_player_id]) turnsByMp[t.match_player_id] = [];
                    turnsByMp[t.match_player_id].push(t.points);
                }
            });
            
            // Build H2H data
            let franzWins = 0, bellaWins = 0, franzLegs = 0, bellaLegs = 0;
            let franzAvgSum = 0, bellaAvgSum = 0, matchCount = 0;
            const h2hMatches = [];
            let currentStreak = 0, streakPlayer = null;
            
            matches.sort((a, b) => new Date(a.finished_at) - new Date(b.finished_at)).forEach(match => {
                const franzMp = allPlayers.find(p => p.match_id === match.id && p.user_id === FRANZ_ID);
                const bellaMp = allPlayers.find(p => p.match_id === match.id && p.user_id === BELLACIAO_ID);
                if (!franzMp || !bellaMp) return;
                
                // Check that this is a direct 1v1 match (exactly 2 players)
                const playersInMatch = allPlayers.filter(p => p.match_id === match.id);
                if (playersInMatch.length !== 2) return;
                
                const franzTurns = turnsByMp[franzMp.id] || [];
                const bellaTurns = turnsByMp[bellaMp.id] || [];
                const franzAvg = franzTurns.length ? franzTurns.reduce((a,b)=>a+b,0) / franzTurns.length : 0;
                const bellaAvg = bellaTurns.length ? bellaTurns.reduce((a,b)=>a+b,0) / bellaTurns.length : 0;
                
                const franzWon = match.winner === franzMp.player_index;
                if (franzWon) franzWins++; else bellaWins++;
                
                franzLegs += franzMp.legs_won || 0;
                bellaLegs += bellaMp.legs_won || 0;
                
                if (franzAvg > 0) { franzAvgSum += franzAvg; matchCount++; }
                if (bellaAvg > 0) { bellaAvgSum += bellaAvg; }
                
                // Streak tracking
                const winner = franzWon ? 'franz' : 'bella';
                if (winner === streakPlayer) currentStreak++;
                else { currentStreak = 1; streakPlayer = winner; }
                
                h2hMatches.push({
                    date: new Date(match.finished_at),
                    franzAvg, bellaAvg,
                    franzWon,
                    legs: (franzMp.legs_won || 0) + '-' + (bellaMp.legs_won || 0),
                    franzMpId: franzMp.id,
                    bellaMpId: bellaMp.id
                });
            });
            
            // Update stats
            document.getElementById('h2h-wins1').textContent = franzWins;
            document.getElementById('h2h-wins2').textContent = bellaWins;
            document.getElementById('h2h-total-matches').textContent = h2hMatches.length;
            document.getElementById('h2h-avg-p1').textContent = matchCount ? (franzAvgSum / matchCount).toFixed(1) : '-';
            document.getElementById('h2h-avg-p2').textContent = matchCount ? (bellaAvgSum / matchCount).toFixed(1) : '-';
            document.getElementById('h2h-legs-p1').textContent = franzLegs;
            document.getElementById('h2h-legs-p2').textContent = bellaLegs;
            document.getElementById('h2h-streak').textContent = currentStreak + 'x ' + (streakPlayer === 'franz' ? '🟢' : '🔴');
            
            // Render charts
            this.renderH2HWinsChart(h2hMatches);
            this.renderH2HAvgChart(h2hMatches);
            this.renderH2HRadar(franzAvgSum/matchCount, bellaAvgSum/matchCount, franzWins, bellaWins, franzLegs, bellaLegs);
            this.renderH2HPie(franzWins, bellaWins);
            this.renderH2HTable(h2hMatches.reverse(), turnsByMp);
            
        } catch (e) { console.error('H2H error:', e); }
        finally { this.hideLoading(); }
    }
    
    renderH2HWinsChart(matches) {
        const ctx = document.getElementById('chart-h2h-wins');
        if (!ctx) return;
        
        let franzCum = 0, bellaCum = 0;
        const data = matches.map(m => {
            if (m.franzWon) franzCum++; else bellaCum++;
            return { date: m.date.toLocaleDateString('de-DE', {month:'short', year:'2-digit'}), franz: franzCum, bella: bellaCum };
        });
        
        if (this.h2hWinsChart) this.h2hWinsChart.destroy();
        this.h2hWinsChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.map(d => d.date),
                datasets: [
                    { label: 'franzinwien', data: data.map(d => d.franz), borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,0.1)', fill: true, tension: 0.3 },
                    { label: 'bellaciao', data: data.map(d => d.bella), borderColor: '#ef4444', backgroundColor: 'rgba(239,68,68,0.1)', fill: true, tension: 0.3 }
                ]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top', labels: { color: '#94a3b8' } } }, scales: { x: { grid: { color: 'rgba(255,255,255,0.1)' }, ticks: { color: '#94a3b8' } }, y: { grid: { color: 'rgba(255,255,255,0.1)' }, ticks: { color: '#94a3b8' } } } }
        });
    }
    
    renderH2HAvgChart(matches) {
        const ctx = document.getElementById('chart-h2h-avg');
        if (!ctx) return;
        
        const recent = matches.slice(-15);
        if (this.h2hAvgChart) this.h2hAvgChart.destroy();
        this.h2hAvgChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: recent.map(m => m.date.toLocaleDateString('de-DE', {day:'2-digit', month:'2-digit'})),
                datasets: [
                    { label: 'franzinwien', data: recent.map(m => m.franzAvg.toFixed(1)), backgroundColor: '#10b981' },
                    { label: 'bellaciao', data: recent.map(m => m.bellaAvg.toFixed(1)), backgroundColor: '#ef4444' }
                ]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top', labels: { color: '#94a3b8' } } }, scales: { x: { grid: { display: false }, ticks: { color: '#94a3b8', font: { size: 9 } } }, y: { grid: { color: 'rgba(255,255,255,0.1)' }, ticks: { color: '#94a3b8' }, suggestedMin: 25, suggestedMax: 50 } } }
        });
    }
    
    renderH2HRadar(fAvg, bAvg, fWins, bWins, fLegs, bLegs) {
        const ctx = document.getElementById('chart-h2h-radar');
        if (!ctx) return;
        
        const total = fWins + bWins || 1;
        const totalLegs = fLegs + bLegs || 1;
        
        if (this.h2hRadarChart) this.h2hRadarChart.destroy();
        this.h2hRadarChart = new Chart(ctx, {
            type: 'radar',
            data: {
                labels: ['Average', 'Win Rate', 'Legs'],
                datasets: [
                    { label: 'franzinwien', data: [fAvg, (fWins/total)*100, (fLegs/totalLegs)*100], borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,0.2)' },
                    { label: 'bellaciao', data: [bAvg, (bWins/total)*100, (bLegs/totalLegs)*100], borderColor: '#ef4444', backgroundColor: 'rgba(239,68,68,0.2)' }
                ]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top', labels: { color: '#94a3b8' } } }, scales: { r: { grid: { color: 'rgba(255,255,255,0.1)' }, pointLabels: { color: '#94a3b8' }, ticks: { display: false } } } }
        });
    }
    
    renderH2HPie(fWins, bWins) {
        const ctx = document.getElementById('chart-h2h-pie');
        if (!ctx) return;
        
        if (this.h2hPieChart) this.h2hPieChart.destroy();
        this.h2hPieChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['franzinwien', 'bellaciao'],
                datasets: [{ data: [fWins, bWins], backgroundColor: ['#10b981', '#ef4444'], borderWidth: 0 }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: '#94a3b8' } } }, cutout: '60%' }
        });
    }
    
    renderH2HTable(matches, turnsByMp) {
        const tb = document.querySelector('#h2h-matches-table tbody');
        if (!tb) return;
        
        // Calculate rankings within H2H matches for Franz
        const franzMatches = matches.map(m => ({ ...m, calcAvg: m.franzAvg }));
        franzMatches.sort((a, b) => b.calcAvg - a.calcAvg);
        franzMatches.forEach((m, i) => m.rank = i + 1);
        const rankMap = {};
        franzMatches.forEach(m => rankMap[m.franzMpId] = m.rank);
        
        const total = matches.length;
        tb.innerHTML = matches.map(m => {
            const rank = rankMap[m.franzMpId] || '-';
            return '<tr>' +
                '<td>' + m.date.toLocaleDateString('de-DE') + '</td>' +
                '<td class="' + (m.franzWon ? 'result-win' : 'result-loss') + '">' + (m.franzWon ? '✅ Sieg' : '❌ Niederlage') + '</td>' +
                '<td>' + m.franzAvg.toFixed(1) + '</td>' +
                '<td>' + m.bellaAvg.toFixed(1) + '</td>' +
                '<td>' + m.legs + '</td>' +
                '<td>' + (m.franzWon ? '🟢 Franz' : '🔴 Bella') + '</td>' +
                '<td>' + this.getRankBadge(rank, total) + '</td>' +
                '</tr>';
        }).join('');
    }

    // ========== MATCH DETAIL ==========
    async loadLegHistoryData() {
        // Load leg averages from Supabase view (single query per match batch)
        if (this.legHistoryLoaded) return;

        try {
            // Get filtered match IDs and match_player_ids
            const matches = this.getFilteredData();
            const filteredMatchIds = matches.map(m => m.match_id);
            const mpIdSet = new Set(matches.map(m => m.id));

            if (filteredMatchIds.length === 0) {
                this.legHistory = [];
                this.legHistoryLoaded = true;
                return;
            }

            // Load from leg_averages view by match_id (parallel batches)
            const legBatches = []; for (let i = 0; i < filteredMatchIds.length; i += 100) legBatches.push(filteredMatchIds.slice(i, i + 100));
            const legResults = await Promise.all(legBatches.map(batch => window.db.from('leg_averages').select('*').in('match_id', batch)));
            const allLegAvgs = legResults.flatMap(r => r.data || []);

            // Filter to only current player's legs (not opponent's)
            const myLegAvgs = allLegAvgs.filter(l => mpIdSet.has(l.match_player_id));

            // Sort by average descending and assign ranks
            const legAvgs = myLegAvgs.map(l => ({
                legId: l.leg_id,
                avg: l.three_dart_avg || 0,
                totalPoints: l.total_points,
                totalDarts: l.total_darts
            }));
            legAvgs.sort((a, b) => b.avg - a.avg);
            legAvgs.forEach((leg, i) => leg.rank = i + 1);

            this.legHistory = legAvgs;
            this.legHistoryLoaded = true;
        } catch (e) {
            console.error('loadLegHistoryData error:', e);
        }
    }

    getLegRank(legId) {
        if (!this.legHistory) return null;
        const leg = this.legHistory.find(l => l.legId === legId);
        return leg ? { rank: leg.rank, total: this.legHistory.length, avg: leg.avg } : null;
    }

    async loadMatchHistoryData() {
        // Load match averages from Supabase view (single query!)
        if (this.matchHistoryLoaded) return;

        try {
            // Get ALL match averages for current player in ONE query
            const { data, error } = await supabase
                .from('match_averages')
                .select('*')
                .eq('user_id', this.currentPlayerId);

            if (error) throw error;

            // Filter to only include matches that match current filters (variant, etc.)
            const filteredMatches = this.getFilteredData();
            const filteredMatchIds = new Set(filteredMatches.map(m => m.match_id));
            const filteredData = (data || []).filter(m => filteredMatchIds.has(m.match_id));

            // Sort by average descending and assign ranks
            const matchAvgs = filteredData.map(m => ({
                matchId: m.match_id,
                avg: m.three_dart_avg || 0,
                totalPoints: m.total_points,
                totalDarts: m.total_darts
            }));
            matchAvgs.sort((a, b) => b.avg - a.avg);
            matchAvgs.forEach((m, i) => m.rank = i + 1);

            this.matchHistory = matchAvgs;
            this.matchHistoryLoaded = true;
        } catch (e) {
            console.error('loadMatchHistoryData error:', e);
        }
    }

    getMatchRank(matchId) {
        if (!this.matchHistory) return null;
        const match = this.matchHistory.find(m => m.matchId === matchId);
        return match ? { rank: match.rank, total: this.matchHistory.length, avg: match.avg } : null;
    }

    async loadMatchDetailPage() {
        const select = document.getElementById('match-detail-select');
        if (!select) return;

        // Load leg and match history in background
        this.loadLegHistoryData();
        this.loadMatchHistoryData();

        // Populate match dropdown
        const matches = this.getFilteredData();
        select.innerHTML = '<option value="">Match auswählen...</option>' +
            matches.map(mp => {
                const d = new Date(mp.match.finished_at);
                const opp = this.opponentMap[mp.match_id];
                const oppName = opp ? (opp.is_bot ? '🤖 Bot ' + Math.round((opp.cpu_ppr||40)/10) : opp.name || 'Gegner') : '?';
                const win = mp.match.winner === mp.player_index;
                return `<option value="${mp.match_id}">${d.toLocaleDateString('de-DE')} - vs ${oppName} ${win ? '✅' : '❌'} (${mp.average?.toFixed(1) || '-'})</option>`;
            }).join('');

        // Load first match if available
        if (matches.length > 0 && !select.value) {
            // Don't auto-load, show empty state
        }
    }

    navigateMatch(direction) {
        const select = document.getElementById('match-detail-select');
        if (!select) return;
        const options = Array.from(select.options).filter(o => o.value);
        const currentIdx = options.findIndex(o => o.value === select.value);
        const newIdx = Math.max(0, Math.min(options.length - 1, currentIdx + direction));
        if (options[newIdx]) {
            select.value = options[newIdx].value;
            this.loadMatchDetail(select.value);
        }
    }

    async loadMatchDetail(matchId) {
        if (!matchId) {
            document.getElementById('match-detail-header')?.classList.add('hidden');
            document.getElementById('match-detail-content')?.classList.add('hidden');
            document.getElementById('match-detail-empty')?.classList.remove('hidden');
            return;
        }

        this.showLoading();
        try {
            // Find match player data
            const mp = this.allMatchPlayers.find(m => m.match_id === matchId);
            const match = this.allMatches.find(m => m.id === matchId);
            const opp = this.opponentMap[matchId];
            if (!mp || !match) { this.hideLoading(); return; }

            const isWin = match.winner === mp.player_index;
            const oppMp = opp;

            // Load legs for this match
            const { data: legs } = await window.db.from('legs').select('*').eq('match_id', matchId).order('leg_number');

            // Load turns for both players
            const { data: myTurns } = await window.db.from('turns').select('*').eq('match_player_id', mp.id).order('created_at');
            let oppTurns = [];
            if (oppMp) {
                const { data } = await window.db.from('turns').select('*').eq('match_player_id', oppMp.id).order('created_at');
                oppTurns = data || [];
            }

            // Update header
            document.getElementById('match-detail-header')?.classList.remove('hidden');
            document.getElementById('match-detail-content')?.classList.remove('hidden');
            document.getElementById('match-detail-empty')?.classList.add('hidden');

            const d = new Date(match.finished_at);
            // Get current player's name from allowed_users
            const currentPlayer = this.allPlayers.find(p => p.autodarts_user_id === this.currentPlayerId);
            const playerName = currentPlayer?.autodarts_username || mp.name || 'Du';

            document.getElementById('md-date').textContent = `📅 ${d.toLocaleDateString('de-DE')} ${d.toLocaleTimeString('de-DE', {hour:'2-digit', minute:'2-digit'})}`;
            document.getElementById('md-opponent').textContent = `🎯 ${playerName} vs ${opp ? (opp.is_bot ? '🤖 Bot ' + Math.round((opp.cpu_ppr||40)/10) : opp.name) : '?'}`;
            document.getElementById('md-result').textContent = isWin ? '✅ Sieg' : '❌ Niederlage';
            document.getElementById('md-result').className = 'match-result ' + (isWin ? 'win' : 'loss');

            // Count legs won/lost from legs data (legs_lost doesn't exist in DB)
            const myLegsWon = (legs || []).filter(l => l.winner_player_id === mp.id).length;
            const oppLegsWon = (legs || []).length - myLegsWon;
            document.getElementById('md-legs').textContent = `${myLegsWon}:${oppLegsWon} Legs`;

            // Show match ranking if available - ensure history is loaded first
            await this.loadMatchHistoryData();
            const matchRank = this.getMatchRank(matchId);
            const matchRankEl = document.getElementById('md-match-rank');
            if (matchRankEl) {
                if (matchRank) {
                    const badge = this.getMatchRankBadge(matchRank.rank, matchRank.total);
                    matchRankEl.innerHTML = badge;
                } else {
                    matchRankEl.innerHTML = '<span class="rank-loading">Ranking lädt...</span>';
                }
            }

            // Load throws for accurate dart count and stats
            const turnIds = (myTurns || []).map(t => t.id);
            const myThrows = await this.loadThrows(turnIds, 10000);

            // Calculate actual darts thrown from throws table
            const dartsThrown = myThrows.length || (myTurns?.length || 0) * 3;

            // Calculate Match Average: (Total Points / Total Darts) × 3
            const totalPoints = (myTurns || []).reduce((s, t) => s + (t.points || 0), 0);
            const matchAverage = dartsThrown > 0 ? (totalPoints / dartsThrown) * 3 : 0;

            // Update stats - Match Average is calculated, others from DB
            document.getElementById('md-average').textContent = matchAverage.toFixed(2) || '-';
            document.getElementById('md-first9').textContent = mp.first_9_average?.toFixed(1) || '-';
            document.getElementById('md-avg170').textContent = mp.average_until_170?.toFixed(1) || '-';
            document.getElementById('md-checkout').textContent = mp.checkout_rate ? (mp.checkout_rate * 100).toFixed(1) + '%' : '-';

            // Count 180s from turns for THIS match only (not mp.total_180s which is overall)
            const match180s = (myTurns || []).filter(t => t.points === 180).length;
            document.getElementById('md-180s').textContent = match180s;

            document.getElementById('md-darts').textContent = dartsThrown || '-';

            // T20 count and rate
            const t20Throws = myThrows.filter(t => t.segment_name === 'T20');
            const totalThrows = myThrows.length;
            document.getElementById('md-t20-count').textContent = t20Throws.length;
            document.getElementById('md-t20-rate').textContent = totalThrows ? ((t20Throws.length / totalThrows) * 100).toFixed(1) + '%' : '-';

            // Highest visit
            const highestVisit = Math.max(...(myTurns || []).map(t => t.points || 0), 0);
            document.getElementById('md-highest').textContent = highestVisit || '-';

            // Store throws for later use
            this.currentMyThrows = myThrows;

            // Store data for leg display
            this.currentMatchLegs = legs || [];
            this.currentMyTurns = myTurns || [];
            this.currentOppTurns = oppTurns;
            this.currentMp = mp;
            this.currentOppMp = oppMp;

            // Store match data for summary generation
            this.currentMatchData = {
                myStats: {
                    average: mp.average,
                    first9_average: mp.first_9_average,
                    checkout_percentage: mp.checkout_rate ? mp.checkout_rate * 100 : null,
                    player_id: mp.id
                },
                opponent: opp ? (opp.is_bot ? 'Bot ' + Math.round((opp.cpu_ppr || 40) / 10) : opp.name || 'Gegner') : 'Gegner'
            };

            // Render leg filter tabs
            this.renderLegFilterTabs();
            this.enableStickyHeader();

            // Default: Match view
            this.selectView('match');

        } catch (e) {
            console.error('loadMatchDetail error:', e);
        } finally {
            this.hideLoading();
        }
    }

    renderLegOverview() {
        const grid = document.getElementById('leg-overview-grid');
        if (!grid || !this.currentMatchLegs) return;

        // Group throws by turn_id to count actual darts per turn
        const dartsByTurn = {};
        if (this.currentMyThrows) {
            this.currentMyThrows.forEach(th => {
                dartsByTurn[th.turn_id] = (dartsByTurn[th.turn_id] || 0) + 1;
            });
        }

        grid.innerHTML = this.currentMatchLegs.map((leg, i) => {
            const myTurns = this.currentMyTurns.filter(t => t.leg_id === leg.id);
            const totalPoints = myTurns.reduce((s, t) => s + (t.points || 0), 0);

            // Calculate actual darts thrown (from throws table, fallback to turns * 3)
            let totalDarts = 0;
            myTurns.forEach(t => {
                totalDarts += dartsByTurn[t.id] || 3; // fallback to 3 if no throws data
            });

            // 3-Dart-Average = (Total Points / Total Darts) * 3
            const avg = totalDarts > 0 ? (totalPoints / totalDarts) * 3 : 0;

            // winner_player_id contains match_player.id, NOT user_id!
            const won = leg.winner_player_id === this.currentMp?.id;

            // Get historical rank for this leg
            const rankInfo = this.getLegRank(leg.id);
            const rankHtml = rankInfo ? this.getLegRankBadge(rankInfo.rank, rankInfo.total) : '';

            return `<div class="leg-card ${won ? 'won' : 'lost'}" data-leg-id="${leg.id}" onclick="window.app.selectLeg('${leg.id}')">
                <div class="leg-number">Leg ${leg.leg_number + 1}</div>
                <div class="leg-avg">${avg.toFixed(1)}</div>
                <div class="leg-darts">${totalDarts} Darts</div>
                <div class="leg-rank">${rankHtml}</div>
                <div class="leg-result">${won ? '✅' : '❌'}</div>
            </div>`;
        }).join('');
    }

    getLegRankBadge(rank, total) {
        const percentile = ((total - rank + 1) / total) * 100;
        if (rank === 1) return '<span class="leg-rank-badge rank-gold" title="Bestes Leg aller Zeiten!">🥇 #1</span>';
        if (rank === 2) return '<span class="leg-rank-badge rank-silver" title="Platz 2">🥈 #2</span>';
        if (rank === 3) return '<span class="leg-rank-badge rank-bronze" title="Platz 3">🥉 #3</span>';
        if (percentile >= 90) return `<span class="leg-rank-badge rank-top10" title="Top 10%">#${rank}</span>`;
        if (percentile >= 75) return `<span class="leg-rank-badge rank-top25" title="Top 25%">#${rank}</span>`;
        if (percentile >= 50) return `<span class="leg-rank-badge rank-top50" title="Top 50%">#${rank}</span>`;
        return `<span class="leg-rank-badge rank-normal" title="Position ${rank} von ${total}">#${rank}</span>`;
    }

    getMatchRankBadge(rank, total) {
        const percentile = ((total - rank + 1) / total) * 100;
        if (rank === 1) return `<span class="match-rank-badge rank-gold" title="Bestes Match aller Zeiten!">🏆 Match #1 von ${total}</span>`;
        if (rank === 2) return `<span class="match-rank-badge rank-silver" title="Platz 2">🥈 Match #2 von ${total}</span>`;
        if (rank === 3) return `<span class="match-rank-badge rank-bronze" title="Platz 3">🥉 Match #3 von ${total}</span>`;
        if (percentile >= 90) return `<span class="match-rank-badge rank-top10" title="Top 10%">⭐ Match #${rank} von ${total}</span>`;
        if (percentile >= 75) return `<span class="match-rank-badge rank-top25" title="Top 25%">Match #${rank} von ${total}</span>`;
        if (percentile >= 50) return `<span class="match-rank-badge rank-top50" title="Top 50%">Match #${rank} von ${total}</span>`;
        return `<span class="match-rank-badge rank-normal" title="Position ${rank} von ${total}">Match #${rank} von ${total}</span>`;
    }

    selectLeg(legId) {
        // Update active state
        document.querySelectorAll('.leg-card').forEach(c => c.classList.toggle('active', c.dataset.legId === legId));

        const leg = this.currentMatchLegs.find(l => l.id === legId);
        if (!leg) return;

        document.getElementById('leg-detail-title').textContent = `- Leg ${leg.leg_number + 1}`;

        // Get turns for this leg
        const myTurns = this.currentMyTurns.filter(t => t.leg_id === legId).sort((a,b) => a.turn - b.turn);
        const oppTurns = this.currentOppTurns.filter(t => t.leg_id === legId).sort((a,b) => a.turn - b.turn);

        // Render detail table
        this.renderLegDetailTable(myTurns, oppTurns);

        // Render score progression chart
        this.renderLegProgressionChart(myTurns, oppTurns, leg);
    }

    renderLegDetailTable(myTurns, oppTurns) {
        const tbody = document.querySelector('#leg-detail-table tbody');
        if (!tbody) return;

        const maxVisits = Math.max(myTurns.length, oppTurns.length);
        let rows = [];

        for (let i = 0; i < maxVisits; i++) {
            const my = myTurns[i];
            const opp = oppTurns[i];
            rows.push(`<tr>
                <td>${i + 1}</td>
                <td>${my?.points ?? '-'}</td>
                <td>${my?.score_remaining ?? '-'}</td>
                <td>${opp?.points ?? '-'}</td>
                <td>${opp?.score_remaining ?? '-'}</td>
            </tr>`);
        }

        tbody.innerHTML = rows.join('');
    }

    renderT20Analysis(throws) {
        const analysis = analyzeT20Misses(throws);

        // Update stats
        const hitRate = analysis.total > 0 ? ((analysis.hits / analysis.total) * 100).toFixed(1) : '-';
        document.getElementById('t20-hit-rate').textContent = hitRate !== '-' ? hitRate + '%' : '-';
        document.getElementById('t20-total-attempts').textContent = analysis.total || '-';

        // Average miss distance in mm
        if (analysis.misses.length > 0) {
            const avgDist = analysis.misses.reduce((s, m) => s + m.distMm, 0) / analysis.misses.length;
            document.getElementById('t20-avg-miss-dist').textContent = avgDist.toFixed(1) + 'mm';
        } else {
            document.getElementById('t20-avg-miss-dist').textContent = '-';
        }

        // 8 Direction stats with heatmap
        const directions = ['links-oben', 'links-mitte', 'links-unten', 'oben', 'unten', 'rechts-oben', 'rechts-mitte', 'rechts-unten'];

        // Calculate counts for heatmap scaling
        const counts = directions.map(dir => {
            const data = analysis.byDirection[dir];
            return data.close.length + data.far.length;
        });
        const maxCount = Math.max(...counts, 1);
        const totalMisses = analysis.misses.length || 1;

        directions.forEach((dir, i) => {
            const el = document.getElementById(`t20-miss-${dir}`);
            if (el) {
                const data = analysis.byDirection[dir];
                const closeCount = data.close.length;
                const farCount = data.far.length;
                const total = closeCount + farCount;

                if (total > 0) {
                    el.querySelector('.direction-value').textContent = total;
                    el.querySelector('.direction-detail').textContent = `≤1cm: ${closeCount} | >1cm: ${farCount}`;

                    // Heatmap color based on intensity
                    const intensity = total / maxCount;
                    el.style.background = this.getHeatmapColor(intensity);
                    el.style.color = intensity > 0.5 ? '#000' : '#fff';
                    const label = el.querySelector('.direction-label');
                    const detail = el.querySelector('.direction-detail');
                    if (label) label.style.color = intensity > 0.5 ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.7)';
                    if (detail) detail.style.color = intensity > 0.5 ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.6)';
                } else {
                    el.querySelector('.direction-value').textContent = '-';
                    el.querySelector('.direction-detail').textContent = '';
                    el.style.background = 'var(--bg-tertiary)';
                    el.style.color = '';
                    const label = el.querySelector('.direction-label');
                    const detail = el.querySelector('.direction-detail');
                    if (label) label.style.color = '';
                    if (detail) detail.style.color = '';
                }
            }
        });

        // Center (T20 hits)
        const centerEl = document.getElementById('t20-miss-center');
        if (centerEl) {
            centerEl.querySelector('.direction-value').textContent = analysis.hits || '0';
        }

        // Distance breakdown bars (in cm)
        const distMapping = {
            '0-1cm': { fillId: 'dist-0-1', countId: 'dist-count-0-1' },
            '1-2cm': { fillId: 'dist-1-2', countId: 'dist-count-1-2' },
            '2-3cm': { fillId: 'dist-2-3', countId: 'dist-count-2-3' },
            '>3cm': { fillId: 'dist-3plus', countId: 'dist-count-3plus' }
        };

        Object.entries(analysis.byDistance).forEach(([key, count]) => {
            const mapping = distMapping[key];
            if (mapping) {
                const fillEl = document.getElementById(mapping.fillId);
                const countEl = document.getElementById(mapping.countId);
                if (fillEl) fillEl.style.width = ((count / totalMisses) * 100) + '%';
                if (countEl) countEl.textContent = count;
            }
        });

        // Textual analysis
        this.renderT20TextAnalysis(analysis, totalMisses);

        // Extended analysis
        this.renderT20Scatter(throws, analysis);
        this.renderT20Fatigue(throws);

        // T20 trend chart (only in Match view)
        if (this.currentLegView === 'match') {
            this.renderT20TrendChart();
            document.getElementById('t20-trend-section').style.display = '';
        } else {
            document.getElementById('t20-trend-section').style.display = 'none';
        }
    }

    renderT20Scatter(throws, analysis) {
        const canvas = document.getElementById('t20-scatter-canvas');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const w = canvas.width;
        const h = canvas.height;
        const cx = w / 2;
        const cy = h / 2;

        // Clear canvas
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(0, 0, w, h);

        // Scale and center on T20
        const scale = 2500;
        const t20x = T20_CENTROID[0];
        const t20y = T20_CENTROID[1];

        // Helper to transform coordinates (centered on T20)
        const toCanvasX = (x) => cx + (x - t20x) * scale;
        const toCanvasY = (y) => cy - (y - t20y) * scale;

        // Draw T20 polygon
        ctx.strokeStyle = 'rgba(16, 185, 129, 0.5)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        T20_POLYGON.forEach((p, i) => {
            const x = toCanvasX(p[0]);
            const y = toCanvasY(p[1]);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
        ctx.closePath();
        ctx.fillStyle = 'rgba(16, 185, 129, 0.2)';
        ctx.fill();
        ctx.stroke();

        // Draw crosshair at T20 center
        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cx - 20, cy);
        ctx.lineTo(cx + 20, cy);
        ctx.moveTo(cx, cy - 20);
        ctx.lineTo(cx, cy + 20);
        ctx.stroke();

        // Draw distance rings (1cm, 2cm, 3cm)
        ctx.strokeStyle = 'rgba(255,255,255,0.1)';
        [10, 20, 30].forEach(mm => {
            const radius = (mm / COORD_TO_MM) * scale;
            ctx.beginPath();
            ctx.arc(cx, cy, radius, 0, Math.PI * 2);
            ctx.stroke();
        });

        // Draw all throws (only show T20 hits and throws within 3cm)
        const t20Throws = throws.filter(t => [20, 1, 5].includes(t.segment_number) && t.coord_x != null && t.coord_y != null);

        t20Throws.forEach(t => {
            const x = toCanvasX(t.coord_x);
            const y = toCanvasY(t.coord_y);

            // Skip if outside canvas
            if (x < -10 || x > w + 10 || y < -10 || y > h + 10) return;

            const inT20 = pointInPolygon(t.coord_x, t.coord_y, T20_POLYGON);
            const dist = inT20 ? 0 : distanceToPolygon(t.coord_x, t.coord_y, T20_POLYGON) * COORD_TO_MM;

            // Hide throws >3cm from T20
            if (!inT20 && dist > 30) return;

            // Color based on distance: T20 (green), ≤1cm (yellow), 1-2cm (orange), 2-3cm (red)
            if (inT20) {
                ctx.fillStyle = '#10b981'; // Green for T20 hits
            } else if (dist <= 10) {
                ctx.fillStyle = '#fbbf24'; // Yellow for ≤1cm
            } else if (dist <= 20) {
                ctx.fillStyle = '#f97316'; // Orange for 1-2cm
            } else {
                ctx.fillStyle = '#ef4444'; // Red for 2-3cm
            }

            ctx.beginPath();
            ctx.arc(x, y, 5, 0, Math.PI * 2);
            ctx.fill();

            // Add border for visibility
            ctx.strokeStyle = 'rgba(0,0,0,0.3)';
            ctx.lineWidth = 1;
            ctx.stroke();
        });

        // Draw center marker
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(cx, cy, 2, 0, Math.PI * 2);
        ctx.fill();
    }

    async renderT20TrendChart() {
        const canvas = document.getElementById('chart-t20-trend');
        if (!canvas) return;

        // Destroy existing chart
        if (this.charts['t20-trend']) {
            this.charts['t20-trend'].destroy();
        }

        // Fetch T20 rates for recent matches
        try {
            const playerId = this.getPlayerId();
            const { data: recentMatches, error } = await supabase
                .from('matches')
                .select('id, created_at')
                .eq('player_id', playerId)
                .eq('variant', 'X01')
                .order('created_at', { ascending: false })
                .limit(100);

            if (error || !recentMatches || recentMatches.length < 5) {
                canvas.parentElement.innerHTML = '<p style="color: var(--text-muted); text-align: center; padding: 1rem;">Nicht genug Daten für Trendanalyse</p>';
                return;
            }

            // Fetch throws for each match
            const matchIds = recentMatches.map(m => m.id);
            const { data: allThrows, error: throwsError } = await supabase
                .from('throws')
                .select('match_id, segment_number, multiplier, coord_x, coord_y')
                .in('match_id', matchIds);

            if (throwsError || !allThrows) {
                return;
            }

            // Group throws by match and calculate T20 rates
            const matchT20Rates = [];
            for (const match of recentMatches.reverse()) { // oldest first
                const matchThrows = allThrows.filter(t => t.match_id === match.id);
                const t20AreaThrows = matchThrows.filter(t =>
                    [20, 1, 5].includes(t.segment_number) && t.coord_x != null && t.coord_y != null
                );

                if (t20AreaThrows.length >= 5) {
                    const t20Hits = t20AreaThrows.filter(t =>
                        pointInPolygon(t.coord_x, t.coord_y, T20_POLYGON)
                    ).length;
                    const rate = (t20Hits / t20AreaThrows.length) * 100;
                    matchT20Rates.push({
                        date: new Date(match.created_at).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }),
                        rate: rate,
                        isCurrent: match.id === this.currentMatchId
                    });
                }
            }

            if (matchT20Rates.length < 5) {
                canvas.parentElement.innerHTML = '<p style="color: var(--text-muted); text-align: center; padding: 1rem;">Nicht genug Daten für Trendanalyse</p>';
                return;
            }

            // Calculate moving average
            const movingAvg = [];
            const windowSize = 5;
            for (let i = 0; i < matchT20Rates.length; i++) {
                if (i < windowSize - 1) {
                    movingAvg.push(null);
                } else {
                    const window = matchT20Rates.slice(i - windowSize + 1, i + 1);
                    const avg = window.reduce((sum, m) => sum + m.rate, 0) / windowSize;
                    movingAvg.push(avg);
                }
            }

            // Create chart
            this.charts['t20-trend'] = new Chart(canvas, {
                type: 'line',
                data: {
                    labels: matchT20Rates.map(m => m.date),
                    datasets: [
                        {
                            label: 'T20 Rate',
                            data: matchT20Rates.map(m => m.rate),
                            borderColor: 'rgba(16, 185, 129, 0.5)',
                            backgroundColor: matchT20Rates.map(m =>
                                m.isCurrent ? '#10b981' : 'rgba(16, 185, 129, 0.3)'
                            ),
                            pointRadius: matchT20Rates.map(m => m.isCurrent ? 8 : 3),
                            pointBackgroundColor: matchT20Rates.map(m =>
                                m.isCurrent ? '#10b981' : 'rgba(16, 185, 129, 0.5)'
                            ),
                            fill: false,
                            tension: 0.3
                        },
                        {
                            label: '5-Match Ø',
                            data: movingAvg,
                            borderColor: '#3b82f6',
                            borderWidth: 2,
                            pointRadius: 0,
                            fill: false,
                            tension: 0.4
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: true,
                            position: 'bottom',
                            labels: { color: '#94a3b8', boxWidth: 12, padding: 8 }
                        }
                    },
                    scales: {
                        x: {
                            display: false
                        },
                        y: {
                            min: 0,
                            max: 100,
                            ticks: { color: '#64748b', callback: v => v + '%' },
                            grid: { color: 'rgba(255,255,255,0.05)' }
                        }
                    }
                }
            });
        } catch (err) {
            console.error('Error rendering T20 trend chart:', err);
        }
    }

    renderT20Fatigue(throws) {
        const t20Throws = throws.filter(t => [20, 1, 5].includes(t.segment_number) && t.coord_x != null && t.coord_y != null);
        if (t20Throws.length < 4) {
            document.getElementById('t20-first-half').textContent = '-';
            document.getElementById('t20-second-half').textContent = '-';
            document.getElementById('t20-fatigue').textContent = 'Zu wenige Daten';
            return;
        }

        const mid = Math.floor(t20Throws.length / 2);
        const firstHalf = t20Throws.slice(0, mid);
        const secondHalf = t20Throws.slice(mid);

        const firstHits = firstHalf.filter(t => pointInPolygon(t.coord_x, t.coord_y, T20_POLYGON)).length;
        const secondHits = secondHalf.filter(t => pointInPolygon(t.coord_x, t.coord_y, T20_POLYGON)).length;

        const firstRate = (firstHits / firstHalf.length) * 100;
        const secondRate = (secondHits / secondHalf.length) * 100;

        document.getElementById('t20-first-half').textContent = firstRate.toFixed(1) + '%';
        document.getElementById('t20-second-half').textContent = secondRate.toFixed(1) + '%';

        const diff = secondRate - firstRate;
        const fatigueEl = document.getElementById('t20-fatigue');

        if (diff > 3) {
            fatigueEl.textContent = '📈 Verbesserung (+' + diff.toFixed(1) + '%)';
            fatigueEl.className = 'comp-value positive';
        } else if (diff < -3) {
            fatigueEl.textContent = '📉 Ermüdung (' + diff.toFixed(1) + '%)';
            fatigueEl.className = 'comp-value negative';
        } else {
            fatigueEl.textContent = '➡️ Konstant (' + (diff >= 0 ? '+' : '') + diff.toFixed(1) + '%)';
            fatigueEl.className = 'comp-value';
        }
    }

    getHeatmapColor(intensity) {
        // From dark/neutral (0) to red (1)
        if (intensity < 0.1) return 'var(--bg-tertiary)';
        if (intensity < 0.25) return '#2d5a3d'; // dark green
        if (intensity < 0.4) return '#4a7c3f';  // green
        if (intensity < 0.55) return '#7fb041'; // light green
        if (intensity < 0.7) return '#c4a82b';  // yellow
        if (intensity < 0.85) return '#d97b2a'; // orange
        return '#d94a2a'; // red
    }

    renderT20TextAnalysis(analysis, totalMisses) {
        const el = document.getElementById('t20-text-analysis');
        if (!el) return;

        if (totalMisses < 5) {
            el.textContent = 'Zu wenige Daten für Analyse';
            return;
        }

        const insights = [];
        const bd = analysis.byDirection;

        // Calculate direction sums
        const leftCount = (bd['links-oben'].close.length + bd['links-oben'].far.length) +
                         (bd['links-mitte'].close.length + bd['links-mitte'].far.length) +
                         (bd['links-unten'].close.length + bd['links-unten'].far.length);
        const rightCount = (bd['rechts-oben'].close.length + bd['rechts-oben'].far.length) +
                          (bd['rechts-mitte'].close.length + bd['rechts-mitte'].far.length) +
                          (bd['rechts-unten'].close.length + bd['rechts-unten'].far.length);
        const topCount = (bd['links-oben'].close.length + bd['links-oben'].far.length) +
                        (bd['oben'].close.length + bd['oben'].far.length) +
                        (bd['rechts-oben'].close.length + bd['rechts-oben'].far.length);
        const bottomCount = (bd['links-unten'].close.length + bd['links-unten'].far.length) +
                           (bd['unten'].close.length + bd['unten'].far.length) +
                           (bd['rechts-unten'].close.length + bd['rechts-unten'].far.length);

        const horizontalBias = leftCount - rightCount;
        const verticalBias = topCount - bottomCount;
        const horizontalRatio = Math.abs(horizontalBias) / totalMisses;
        const verticalRatio = Math.abs(verticalBias) / totalMisses;

        // Check spread uniformity
        const dirCounts = Object.values(bd).map(d => d.close.length + d.far.length);
        const maxDir = Math.max(...dirCounts);
        const nonZeroCounts = dirCounts.filter(c => c > 0);
        const minDir = nonZeroCounts.length > 0 ? Math.min(...nonZeroCounts) : 0;
        const spreadRatio = maxDir > 0 ? minDir / maxDir : 1;

        if (spreadRatio > 0.5 && horizontalRatio < 0.15 && verticalRatio < 0.15) {
            insights.push('📊 Gleichmäßige Streuung in alle Richtungen');
        } else {
            // Horizontal tendency
            if (horizontalRatio > 0.15) {
                if (horizontalBias > 0) {
                    insights.push(`⬅️ Tendenz nach links (5er) - ${leftCount} vs ${rightCount}`);
                } else {
                    insights.push(`➡️ Tendenz nach rechts (1er) - ${rightCount} vs ${leftCount}`);
                }
            }

            // Vertical tendency
            if (verticalRatio > 0.15) {
                if (verticalBias > 0) {
                    insights.push(`⬆️ Tendenz nach oben (Bull) - ${topCount} vs ${bottomCount}`);
                } else {
                    insights.push(`⬇️ Tendenz nach unten (Draht) - ${bottomCount} vs ${topCount}`);
                }
            }
        }

        // Precision analysis
        const closeTotal = Object.values(bd).reduce((s, d) => s + d.close.length, 0);
        const closeRatio = closeTotal / totalMisses;

        if (closeRatio > 0.5) {
            insights.push(`✅ Gute Präzision - ${(closeRatio * 100).toFixed(0)}% knapp daneben (≤1cm)`);
        } else if (closeRatio < 0.3) {
            insights.push(`⚠️ Hohe Streuung - nur ${(closeRatio * 100).toFixed(0)}% knapp daneben`);
        }

        // Hit rate
        const hitRateNum = analysis.total > 0 ? (analysis.hits / analysis.total) * 100 : 0;
        if (hitRateNum >= 15) {
            insights.push(`🎯 Starke T20-Quote: ${hitRateNum.toFixed(1)}%`);
        } else if (hitRateNum < 8) {
            insights.push(`💡 T20-Quote: ${hitRateNum.toFixed(1)}% - Raum für Verbesserung`);
        }

        el.innerHTML = insights.length > 0 ? insights.join('<br>') : 'Keine auffälligen Muster erkannt';
    }

    async renderMatchSummary() {
        const container = document.getElementById('match-summary-content');
        if (!container || !this.currentMatchData) return;

        const match = this.currentMatchData;
        const myStats = match.myStats || {};
        const turns = this.currentMyTurns;
        const legs = this.currentMatchLegs;

        // Collect key stats
        const avg = myStats.average ? parseFloat(myStats.average).toFixed(1) : '-';
        const first9 = myStats.first9_average ? parseFloat(myStats.first9_average).toFixed(1) : '-';
        const checkout = myStats.checkout_percentage ? parseFloat(myStats.checkout_percentage).toFixed(1) + '%' : '-';
        const legsWon = legs.filter(l => l.winner_player_id === myStats.player_id).length;
        const legsLost = legs.length - legsWon;
        const isWin = legsWon > legsLost;

        // Calculate 100+ and 140+ rates
        const points = turns.map(t => t.points || 0);
        const total = points.length;
        const c100plus = points.filter(p => p >= 100).length;
        const c140plus = points.filter(p => p >= 140).length;
        const c180 = points.filter(p => p === 180).length;

        // Calculate consistency (std dev)
        const avgPoints = total > 0 ? points.reduce((a, b) => a + b, 0) / total : 0;
        const variance = total > 0 ? points.reduce((s, p) => s + Math.pow(p - avgPoints, 2), 0) / total : 0;
        const stdDev = Math.sqrt(variance);

        // Build summary text
        let summary = [];
        let kpis = [];

        // Result summary
        if (isWin) {
            summary.push(`<span class="highlight-good">Sieg ${legsWon}:${legsLost}</span> gegen ${match.opponent || 'Gegner'}.`);
        } else {
            summary.push(`<span class="highlight-bad">Niederlage ${legsWon}:${legsLost}</span> gegen ${match.opponent || 'Gegner'}.`);
        }

        // Average assessment
        const avgNum = parseFloat(myStats.average) || 0;
        if (avgNum >= 80) {
            summary.push(`Starkes Match mit <span class="highlight-good">${avg}</span> Punkten Average.`);
        } else if (avgNum >= 60) {
            summary.push(`Solides Match mit <span class="highlight-neutral">${avg}</span> Punkten Average.`);
        } else if (avgNum > 0) {
            summary.push(`Ausbaufähig mit <span class="highlight-bad">${avg}</span> Punkten Average.`);
        }

        // First 9 vs overall comparison
        const first9Num = parseFloat(myStats.first9_average) || 0;
        if (first9Num > avgNum + 5) {
            summary.push(`First 9 Average (${first9}) deutlich stärker - <span class="highlight-bad">Leistungsabfall im Verlauf</span>.`);
        } else if (first9Num < avgNum - 5) {
            summary.push(`<span class="highlight-good">Warmgespielt:</span> Von ${first9} auf ${avg} Average gesteigert.`);
        }

        // Checkout assessment
        const checkoutNum = parseFloat(myStats.checkout_percentage) || 0;
        if (checkoutNum >= 40) {
            summary.push(`<span class="highlight-good">Exzellente Checkout-Quote von ${checkout}</span>.`);
        } else if (checkoutNum < 25 && checkoutNum > 0) {
            summary.push(`<span class="highlight-bad">Checkout-Quote ${checkout}</span> - Potential zur Verbesserung.`);
        }

        // Consistency assessment
        if (stdDev < 25) {
            summary.push(`<span class="highlight-good">Konstantes Scoring</span> (σ=${stdDev.toFixed(1)}).`);
        } else if (stdDev > 35) {
            summary.push(`<span class="highlight-bad">Schwankendes Scoring</span> (σ=${stdDev.toFixed(1)}).`);
        }

        // 180s
        if (c180 > 0) {
            summary.push(`🎯 ${c180}x 180!`);
        }

        // Build KPI grid
        kpis = [
            { label: 'Average', value: avg, class: avgNum >= 70 ? 'good' : avgNum >= 50 ? 'neutral' : 'bad' },
            { label: 'First 9', value: first9, class: first9Num >= 80 ? 'good' : first9Num >= 60 ? 'neutral' : 'bad' },
            { label: 'Checkout', value: checkout, class: checkoutNum >= 40 ? 'good' : checkoutNum >= 25 ? 'neutral' : 'bad' },
            { label: '100+ Rate', value: total > 0 ? ((c100plus / total) * 100).toFixed(1) + '%' : '-', class: (c100plus / total) >= 0.3 ? 'good' : 'neutral' },
            { label: '140+ Rate', value: total > 0 ? ((c140plus / total) * 100).toFixed(1) + '%' : '-', class: (c140plus / total) >= 0.1 ? 'good' : 'neutral' },
            { label: 'Konsistenz', value: '±' + stdDev.toFixed(1), class: stdDev < 25 ? 'good' : stdDev < 35 ? 'neutral' : 'bad' }
        ];

        // Render
        let html = '<p>' + summary.join(' ') + '</p>';
        html += '<div class="summary-kpi-grid">';
        kpis.forEach(kpi => {
            html += `<div class="summary-kpi">
                <span class="summary-kpi-label">${kpi.label}</span>
                <span class="summary-kpi-value ${kpi.class}">${kpi.value}</span>
            </div>`;
        });
        html += '</div>';

        container.innerHTML = html;
    }

    renderLegProgressionChart(myTurns, oppTurns, leg) {
        const ctx = document.getElementById('chart-leg-progression');
        if (!ctx) return;

        // Build score progression
        const startScore = 501;
        const myScores = [startScore];
        const oppScores = [startScore];

        myTurns.forEach(t => {
            if (t.score_remaining !== null) myScores.push(t.score_remaining);
        });

        oppTurns.forEach(t => {
            if (t.score_remaining !== null) oppScores.push(t.score_remaining);
        });

        const labels = Array.from({length: Math.max(myScores.length, oppScores.length)}, (_, i) => i === 0 ? 'Start' : `V${i}`);

        if (this.legProgressionChart) this.legProgressionChart.destroy();
        this.legProgressionChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    { label: 'Du', data: myScores, borderColor: CONFIG.COLORS.green, backgroundColor: 'rgba(16,185,129,0.1)', fill: true, tension: 0.3 },
                    { label: 'Gegner', data: oppScores, borderColor: CONFIG.COLORS.red, backgroundColor: 'rgba(239,68,68,0.1)', fill: true, tension: 0.3 }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'top', labels: { color: '#94a3b8' } } },
                scales: {
                    x: { grid: { color: 'rgba(255,255,255,0.1)' }, ticks: { color: '#94a3b8' } },
                    y: { grid: { color: 'rgba(255,255,255,0.1)' }, ticks: { color: '#94a3b8' }, reverse: false, min: 0, max: 520 }
                }
            }
        });
    }

    renderLegAveragesChart() {
        const ctx = document.getElementById('chart-leg-averages');
        if (!ctx || !this.currentMatchLegs) return;

        // Group throws by turn_id to count actual darts per turn
        const dartsByTurn = {};
        if (this.currentMyThrows) {
            this.currentMyThrows.forEach(th => {
                dartsByTurn[th.turn_id] = (dartsByTurn[th.turn_id] || 0) + 1;
            });
        }

        const labels = this.currentMatchLegs.map((l, i) => `L${i + 1}`);
        const myAvgs = this.currentMatchLegs.map(leg => {
            const turns = this.currentMyTurns.filter(t => t.leg_id === leg.id);
            const totalPoints = turns.reduce((s, t) => s + (t.points || 0), 0);
            let totalDarts = 0;
            turns.forEach(t => { totalDarts += dartsByTurn[t.id] || 3; });
            return totalDarts > 0 ? (totalPoints / totalDarts) * 3 : 0;
        });
        const oppAvgs = this.currentMatchLegs.map(leg => {
            const turns = this.currentOppTurns.filter(t => t.leg_id === leg.id);
            // For opponent, we don't have throws, so use turns * 3 as approximation
            return turns.length ? turns.reduce((s, t) => s + (t.points || 0), 0) / turns.length : 0;
        });
        // winner_player_id contains match_player.id, NOT user_id!
        const colors = this.currentMatchLegs.map(leg => leg.winner_player_id === this.currentMp?.id ? CONFIG.COLORS.green : CONFIG.COLORS.red);

        if (this.legAvgChart) this.legAvgChart.destroy();
        this.legAvgChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    { label: 'Dein Avg', data: myAvgs.map(a => a.toFixed(1)), backgroundColor: colors, borderRadius: 4 },
                    { label: 'Gegner Avg', data: oppAvgs.map(a => a.toFixed(1)), backgroundColor: 'rgba(148,163,184,0.5)', borderRadius: 4 }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'top', labels: { color: '#94a3b8' } } },
                scales: {
                    x: { grid: { display: false }, ticks: { color: '#94a3b8' } },
                    y: { grid: { color: 'rgba(255,255,255,0.1)' }, ticks: { color: '#94a3b8' }, suggestedMin: 20, suggestedMax: 60 }
                }
            }
        });
    }

    renderMatchScoringChart() {
        const ctx = document.getElementById('chart-match-scoring');
        if (!ctx || !this.currentMyTurns) return;

        let u40 = 0, s40 = 0, s60 = 0, s100 = 0, s140 = 0, s180 = 0;
        this.currentMyTurns.forEach(t => {
            if (t.points === null) return;
            if (t.points === 180) s180++;
            else if (t.points >= 140) s140++;
            else if (t.points >= 100) s100++;
            else if (t.points >= 60) s60++;
            else if (t.points >= 40) s40++;
            else u40++;
        });

        if (this.matchScoringChart) this.matchScoringChart.destroy();
        this.matchScoringChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['<40', '40-59', '60-99', '100-139', '140-179', '180'],
                datasets: [{
                    data: [u40, s40, s60, s100, s140, s180],
                    backgroundColor: ['#64748b', '#94a3b8', '#3b82f6', '#8b5cf6', '#f59e0b', '#10b981'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'right', labels: { color: '#94a3b8', font: { size: 11 } } }
                },
                cutout: '50%'
            }
        });
    }

    renderMatchFirst9Chart() {
        const ctx = document.getElementById('chart-match-first9');
        if (!ctx || !this.currentMyTurns) return;

        let f9 = 0, f9c = 0, r = 0, rc = 0;
        this.currentMyTurns.forEach(t => {
            if (t.points !== null) {
                if (t.round <= 3) { f9 += t.points; f9c++; }
                else { r += t.points; rc++; }
            }
        });

        if (this.matchFirst9Chart) this.matchFirst9Chart.destroy();
        this.matchFirst9Chart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['First 9', 'Rest'],
                datasets: [{
                    data: [f9c ? (f9 / f9c).toFixed(1) : 0, rc ? (r / rc).toFixed(1) : 0],
                    backgroundColor: [CONFIG.COLORS.green, CONFIG.COLORS.blue],
                    borderRadius: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: { grid: { display: false }, ticks: { color: '#94a3b8' } },
                    y: { grid: { color: 'rgba(255,255,255,0.1)' }, ticks: { color: '#94a3b8' }, suggestedMin: 30, suggestedMax: 60 }
                }
            }
        });
    }

    // ========== COLLAPSIBLE SECTIONS ==========
    toggleSection(headerEl) {
        const section = headerEl.closest('.section-collapsible');
        if (section) {
            section.classList.toggle('collapsed');
        }
    }

    // ========== MOMENTUM & ROLLING AVERAGE ==========
    renderMomentumAnalysis() {
        if (!this.currentMyTurns || this.currentMyTurns.length < 3) return;

        const points = this.currentMyTurns.map(t => t.points || 0);
        const total = points.length;

        // Calculate rates
        const c60plus = points.filter(p => p >= 60).length;
        const c100plus = points.filter(p => p >= 100).length;
        const c140plus = points.filter(p => p >= 140).length;

        document.getElementById('md-60plus-rate').textContent = ((c60plus / total) * 100).toFixed(1) + '%';
        document.getElementById('md-100plus-rate').textContent = ((c100plus / total) * 100).toFixed(1) + '%';
        document.getElementById('md-140plus-rate').textContent = ((c140plus / total) * 100).toFixed(1) + '%';

        // Calculate standard deviation (consistency)
        const avg = points.reduce((a, b) => a + b, 0) / total;
        const variance = points.reduce((s, p) => s + Math.pow(p - avg, 2), 0) / total;
        const stdDev = Math.sqrt(variance);

        const stdEl = document.getElementById('md-std-dev');
        stdEl.textContent = '±' + stdDev.toFixed(1);
        if (stdDev < 25) {
            stdEl.className = 'stat-value consistency-good';
        } else if (stdDev < 35) {
            stdEl.className = 'stat-value consistency-medium';
        } else {
            stdEl.className = 'stat-value consistency-bad';
        }

        // Find best and worst streaks (consecutive 60+ or 100+)
        let currentStreak = 0, bestStreak = 0, worstStreak = 0, currentBadStreak = 0;
        points.forEach(p => {
            if (p >= 60) {
                currentStreak++;
                bestStreak = Math.max(bestStreak, currentStreak);
                currentBadStreak = 0;
            } else {
                currentStreak = 0;
                currentBadStreak++;
                worstStreak = Math.max(worstStreak, currentBadStreak);
            }
        });

        document.getElementById('md-best-streak').textContent = bestStreak + 'x 60+';
        document.getElementById('md-worst-streak').textContent = worstStreak + 'x <60';

        // Rolling average chart
        this.renderRollingAverageChart(points);
    }

    renderRollingAverageChart(points) {
        const ctx = document.getElementById('chart-rolling-avg');
        if (!ctx) return;

        const windowSize = 5;
        const rollingAvg = [];
        const labels = [];

        for (let i = 0; i < points.length; i++) {
            const start = Math.max(0, i - windowSize + 1);
            const window = points.slice(start, i + 1);
            const avg = window.reduce((a, b) => a + b, 0) / window.length;
            rollingAvg.push(avg.toFixed(1));
            labels.push('V' + (i + 1));
        }

        // Calculate match average line
        const matchAvg = points.reduce((a, b) => a + b, 0) / points.length;

        if (this.rollingAvgChart) this.rollingAvgChart.destroy();
        this.rollingAvgChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Rolling Avg (5)',
                        data: rollingAvg,
                        borderColor: CONFIG.COLORS.green,
                        backgroundColor: 'rgba(16,185,129,0.1)',
                        fill: true,
                        tension: 0.3
                    },
                    {
                        label: 'Match Avg',
                        data: new Array(points.length).fill(matchAvg.toFixed(1)),
                        borderColor: CONFIG.COLORS.yellow,
                        borderDash: [5, 5],
                        fill: false,
                        pointRadius: 0
                    },
                    {
                        label: 'Einzelwürfe',
                        data: points,
                        borderColor: 'rgba(148,163,184,0.3)',
                        backgroundColor: 'rgba(148,163,184,0.1)',
                        fill: false,
                        tension: 0,
                        pointRadius: 3,
                        pointBackgroundColor: points.map(p => p >= 100 ? CONFIG.COLORS.green : p >= 60 ? CONFIG.COLORS.blue : CONFIG.COLORS.red)
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'top', labels: { color: '#94a3b8' } }
                },
                scales: {
                    x: { grid: { color: 'rgba(255,255,255,0.1)' }, ticks: { color: '#94a3b8', maxRotation: 0, autoSkip: true, maxTicksLimit: 20 } },
                    y: { grid: { color: 'rgba(255,255,255,0.1)' }, ticks: { color: '#94a3b8' }, suggestedMin: 0, suggestedMax: 180 }
                }
            }
        });
    }

    // ========== DOUBLES ANALYSIS ==========
    async renderDoublesAnalysis() {
        if (!this.currentMyThrows || this.currentMyThrows.length === 0) return;

        // Find checkout turns (score_remaining = 0)
        const checkoutTurns = this.currentMyTurns.filter(t => t.score_remaining === 0);
        const checkoutTurnIds = new Set(checkoutTurns.map(t => t.id));

        // Get double throws
        const doubleThrows = this.currentMyThrows.filter(t => t.segment_bed === 'Double');
        const doubleAttempts = {};
        const doubleHits = {};

        // Track attempts and hits by segment
        doubleThrows.forEach(t => {
            const name = 'D' + t.segment_number;
            doubleAttempts[name] = (doubleAttempts[name] || 0) + 1;

            // A hit is when it's in a checkout turn
            if (checkoutTurnIds.has(t.turn_id)) {
                doubleHits[name] = (doubleHits[name] || 0) + 1;
            }
        });

        // Calculate stats
        const totalAttempts = Object.values(doubleAttempts).reduce((a, b) => a + b, 0);
        const totalHits = checkoutTurns.length;

        document.getElementById('md-checkout-attempts').textContent = totalAttempts || '-';
        document.getElementById('md-checkout-hits').textContent = totalHits || '-';
        document.getElementById('md-checkout-rate-calc').textContent = totalAttempts > 0
            ? ((totalHits / totalAttempts) * 100).toFixed(1) + '%'
            : '-';

        // First dart checkouts (approximate - checkout in turn with only 1-2 doubles attempted)
        // This is a simplification; true first-dart CO would need dart-by-dart analysis
        const firstDartCO = checkoutTurns.filter(t => {
            const throwsInTurn = this.currentMyThrows.filter(th => th.turn_id === t.id);
            const doublesInTurn = throwsInTurn.filter(th => th.segment_bed === 'Double');
            return doublesInTurn.length === 1;
        }).length;

        document.getElementById('md-first-dart-co').textContent = firstDartCO || '0';

        // Render doubles chart
        this.renderMatchDoublesChart(doubleHits);

        // Render doubles heatmap
        this.renderDoublesHeatmap(doubleAttempts, doubleHits);
    }

    renderMatchDoublesChart(doubleHits) {
        const ctx = document.getElementById('chart-match-doubles');
        if (!ctx) return;

        const sorted = Object.entries(doubleHits)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 8);

        if (sorted.length === 0) {
            // No checkouts - show empty state
            if (this.matchDoublesChart) this.matchDoublesChart.destroy();
            return;
        }

        if (this.matchDoublesChart) this.matchDoublesChart.destroy();
        this.matchDoublesChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: sorted.map(d => d[0]),
                datasets: [{
                    data: sorted.map(d => d[1]),
                    backgroundColor: CONFIG.COLORS.green,
                    borderRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                indexAxis: 'y',
                plugins: { legend: { display: false } },
                scales: {
                    x: { grid: { color: 'rgba(255,255,255,0.1)' }, ticks: { color: '#94a3b8' } },
                    y: { grid: { display: false }, ticks: { color: '#94a3b8' } }
                }
            }
        });
    }

    renderDoublesHeatmap(attempts, hits) {
        const container = document.getElementById('doubles-heatmap');
        if (!container) return;

        // Standard doubles order (like on a dartboard)
        const doubles = [
            'D20', 'D1', 'D18', 'D4', 'D13',
            'D6', 'D10', 'D15', 'D2', 'D17',
            'D3', 'D19', 'D7', 'D16', 'D8',
            'D11', 'D14', 'D9', 'D12', 'D5',
            'D25' // Bull
        ];

        const maxAttempts = Math.max(...Object.values(attempts), 1);

        container.innerHTML = doubles.map(d => {
            const att = attempts[d] || 0;
            const hit = hits[d] || 0;
            const intensity = att / maxAttempts;
            const heatClass = att === 0 ? 'heat-0'
                : intensity < 0.2 ? 'heat-1'
                : intensity < 0.4 ? 'heat-2'
                : intensity < 0.6 ? 'heat-3'
                : intensity < 0.8 ? 'heat-4'
                : 'heat-5';

            return `<div class="double-cell ${heatClass}" title="${d}: ${hit}/${att}">
                <span class="double-name">${d}</span>
                <span class="double-stats">${hit}/${att}</span>
            </div>`;
        }).join('');
    }

    // ========== EXTENDED LEG STATS ==========
    renderLegOverviewExtended() {
        const grid = document.getElementById('leg-overview-grid');
        if (!grid || !this.currentMatchLegs) return;

        // Group throws by turn_id to count actual darts per turn
        const dartsByTurn = {};
        if (this.currentMyThrows) {
            this.currentMyThrows.forEach(th => {
                dartsByTurn[th.turn_id] = (dartsByTurn[th.turn_id] || 0) + 1;
            });
        }

        grid.innerHTML = this.currentMatchLegs.map((leg, i) => {
            const myTurns = this.currentMyTurns.filter(t => t.leg_id === leg.id);
            const points = myTurns.map(t => t.points || 0);
            const totalPoints = points.reduce((s, p) => s + p, 0);

            // Calculate actual darts thrown
            let totalDarts = 0;
            myTurns.forEach(t => {
                totalDarts += dartsByTurn[t.id] || 3;
            });

            // 3-Dart-Average
            const avg = totalDarts > 0 ? (totalPoints / totalDarts) * 3 : 0;

            // Extended stats for this leg
            const c60plus = points.filter(p => p >= 60).length;
            const c100plus = points.filter(p => p >= 100).length;
            const rate60 = points.length > 0 ? ((c60plus / points.length) * 100).toFixed(0) : 0;

            const won = leg.winner_player_id === this.currentMp?.id;
            const rankInfo = this.getLegRank(leg.id);
            const rankHtml = rankInfo ? this.getLegRankBadge(rankInfo.rank, rankInfo.total) : '';

            return `<div class="leg-card ${won ? 'won' : 'lost'}" data-leg-id="${leg.id}" onclick="window.app.selectLeg('${leg.id}')">
                <div class="leg-number">Leg ${leg.leg_number + 1}</div>
                <div class="leg-avg">${avg.toFixed(1)}</div>
                <div class="leg-darts">${totalDarts} Darts</div>
                <div class="leg-extra-stats">
                    <span>${rate60}% 60+</span>
                    <span>${c100plus}x 100+</span>
                </div>
                <div class="leg-rank">${rankHtml}</div>
                <div class="leg-result">${won ? '✅' : '❌'}</div>
            </div>`;
        }).join('');
    }

    // ========== STICKY HEADER ==========
    enableStickyHeader() {
        const header = document.getElementById('match-detail-header');
        if (header) {
            header.classList.add('sticky');
        }
    }

    // ========== LEG FILTER SYSTEM ==========
    renderLegFilterTabs() {
        const container = document.getElementById('leg-filter-tabs');
        if (!container || !this.currentMatchLegs) return;

        // Group throws by turn_id for dart counting
        const dartsByTurn = {};
        if (this.currentMyThrows) {
            this.currentMyThrows.forEach(th => {
                dartsByTurn[th.turn_id] = (dartsByTurn[th.turn_id] || 0) + 1;
            });
        }

        // Build leg tabs
        const legTabs = this.currentMatchLegs.map((leg, i) => {
            const myTurns = this.currentMyTurns.filter(t => t.leg_id === leg.id);
            const totalPoints = myTurns.reduce((s, t) => s + (t.points || 0), 0);
            let totalDarts = 0;
            myTurns.forEach(t => { totalDarts += dartsByTurn[t.id] || 3; });
            const avg = totalDarts > 0 ? (totalPoints / totalDarts) * 3 : 0;
            const won = leg.winner_player_id === this.currentMp?.id;

            return `<button class="leg-filter-tab ${won ? 'won' : 'lost'}" data-leg="${leg.id}" onclick="window.app.selectView('${leg.id}')">
                Leg ${leg.leg_number + 1} <small>(${avg.toFixed(0)})</small> ${won ? '✅' : '❌'}
            </button>`;
        }).join('');

        container.innerHTML = `
            <button class="leg-filter-tab active" data-leg="match" onclick="window.app.selectView('match')">
                📊 Gesamtes Match
            </button>
            ${legTabs}
        `;
    }

    selectView(viewId) {
        this.currentView = viewId;

        // Update tab active states
        document.querySelectorAll('.leg-filter-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.leg === viewId);
        });

        const isMatchView = viewId === 'match';
        const matchOnlySection = document.getElementById('match-only-charts');
        const legOnlySection = document.getElementById('leg-only-charts');

        // Toggle sections
        if (matchOnlySection) matchOnlySection.classList.toggle('hidden', !isMatchView);
        if (legOnlySection) legOnlySection.classList.toggle('hidden', isMatchView);

        // Update view indicators
        const viewLabel = isMatchView ? 'Match' : `Leg ${this.currentMatchLegs.find(l => l.id === viewId)?.leg_number + 1 || ''}`;
        document.querySelectorAll('.view-indicator').forEach(el => {
            el.textContent = viewLabel;
        });

        if (isMatchView) {
            // Render match-level charts
            this.renderMatchView();
        } else {
            // Render leg-specific charts
            this.renderLegView(viewId);
        }
    }

    renderMatchView() {
        // Show match summary section
        document.getElementById('match-summary-section').style.display = '';
        this.renderMatchSummary();

        // Match-level charts
        this.renderLegAveragesChart();
        this.renderMatchFirst9Chart();

        // Shared charts with full match data
        this.renderMomentumAnalysis();
        this.renderDoublesAnalysis();
        this.renderMatchScoringChart();
        this.renderT20Analysis(this.currentMyThrows);
    }

    renderLegView(legId) {
        const leg = this.currentMatchLegs.find(l => l.id === legId);
        if (!leg) return;

        // Hide match summary in leg view
        document.getElementById('match-summary-section').style.display = 'none';

        // Update title
        document.getElementById('score-chart-title').textContent = `- Leg ${leg.leg_number + 1}`;
        document.getElementById('leg-detail-title').textContent = `- Leg ${leg.leg_number + 1}`;

        // Get turns for this leg
        const myTurns = this.currentMyTurns.filter(t => t.leg_id === legId).sort((a,b) => a.turn - b.turn);
        const oppTurns = this.currentOppTurns.filter(t => t.leg_id === legId).sort((a,b) => a.turn - b.turn);

        // Get throws for this leg
        const turnIds = new Set(myTurns.map(t => t.id));
        const legThrows = this.currentMyThrows.filter(t => turnIds.has(t.turn_id));

        // Render leg-specific charts
        this.renderLegProgressionChart(myTurns, oppTurns, leg);
        this.renderLegDetailTable(myTurns, oppTurns);

        // Render shared charts with leg-filtered data
        this.renderMomentumAnalysisForData(myTurns);
        this.renderDoublesAnalysisForData(myTurns, legThrows);
        this.renderMatchScoringChartForData(myTurns);
        this.renderT20Analysis(legThrows);
    }

    // ========== LEG-FILTERED CHART METHODS ==========
    renderMomentumAnalysisForData(turns) {
        if (!turns || turns.length < 3) {
            document.getElementById('md-best-streak').textContent = '-';
            document.getElementById('md-worst-streak').textContent = '-';
            document.getElementById('md-std-dev').textContent = '-';
            document.getElementById('md-60plus-rate').textContent = '-';
            document.getElementById('md-100plus-rate').textContent = '-';
            document.getElementById('md-140plus-rate').textContent = '-';
            return;
        }

        const points = turns.map(t => t.points || 0);
        const total = points.length;

        // Calculate rates
        const c60plus = points.filter(p => p >= 60).length;
        const c100plus = points.filter(p => p >= 100).length;
        const c140plus = points.filter(p => p >= 140).length;

        document.getElementById('md-60plus-rate').textContent = ((c60plus / total) * 100).toFixed(1) + '%';
        document.getElementById('md-100plus-rate').textContent = ((c100plus / total) * 100).toFixed(1) + '%';
        document.getElementById('md-140plus-rate').textContent = ((c140plus / total) * 100).toFixed(1) + '%';

        // Calculate standard deviation (consistency)
        const avg = points.reduce((a, b) => a + b, 0) / total;
        const variance = points.reduce((s, p) => s + Math.pow(p - avg, 2), 0) / total;
        const stdDev = Math.sqrt(variance);

        const stdEl = document.getElementById('md-std-dev');
        stdEl.textContent = '±' + stdDev.toFixed(1);
        stdEl.className = stdDev < 25 ? 'stat-value consistency-good' : stdDev < 35 ? 'stat-value consistency-medium' : 'stat-value consistency-bad';

        // Find streaks
        let currentStreak = 0, bestStreak = 0, worstStreak = 0, currentBadStreak = 0;
        points.forEach(p => {
            if (p >= 60) { currentStreak++; bestStreak = Math.max(bestStreak, currentStreak); currentBadStreak = 0; }
            else { currentStreak = 0; currentBadStreak++; worstStreak = Math.max(worstStreak, currentBadStreak); }
        });

        document.getElementById('md-best-streak').textContent = bestStreak + 'x 60+';
        document.getElementById('md-worst-streak').textContent = worstStreak + 'x <60';

        this.renderRollingAverageChart(points);
    }

    renderDoublesAnalysisForData(turns, throws) {
        if (!throws || throws.length === 0) {
            document.getElementById('md-checkout-attempts').textContent = '-';
            document.getElementById('md-checkout-hits').textContent = '-';
            document.getElementById('md-checkout-rate-calc').textContent = '-';
            document.getElementById('md-first-dart-co').textContent = '-';
            return;
        }

        const checkoutTurns = turns.filter(t => t.score_remaining === 0);
        const checkoutTurnIds = new Set(checkoutTurns.map(t => t.id));
        const doubleThrows = throws.filter(t => t.segment_bed === 'Double');
        const doubleAttempts = {}, doubleHits = {};

        doubleThrows.forEach(t => {
            const name = 'D' + t.segment_number;
            doubleAttempts[name] = (doubleAttempts[name] || 0) + 1;
            if (checkoutTurnIds.has(t.turn_id)) { doubleHits[name] = (doubleHits[name] || 0) + 1; }
        });

        const totalAttempts = Object.values(doubleAttempts).reduce((a, b) => a + b, 0);
        const totalHits = checkoutTurns.length;

        document.getElementById('md-checkout-attempts').textContent = totalAttempts || '-';
        document.getElementById('md-checkout-hits').textContent = totalHits || '-';
        document.getElementById('md-checkout-rate-calc').textContent = totalAttempts > 0 ? ((totalHits / totalAttempts) * 100).toFixed(1) + '%' : '-';

        const firstDartCO = checkoutTurns.filter(t => {
            const throwsInTurn = throws.filter(th => th.turn_id === t.id);
            const doublesInTurn = throwsInTurn.filter(th => th.segment_bed === 'Double');
            return doublesInTurn.length === 1;
        }).length;
        document.getElementById('md-first-dart-co').textContent = firstDartCO || '0';

        this.renderMatchDoublesChart(doubleHits);
        this.renderDoublesHeatmap(doubleAttempts, doubleHits);
    }

    renderMatchScoringChartForData(turns) {
        const ctx = document.getElementById('chart-match-scoring');
        if (!ctx) return;

        let u40 = 0, s40 = 0, s60 = 0, s100 = 0, s140 = 0, s180 = 0;
        turns.forEach(t => {
            if (t.points === null) return;
            if (t.points === 180) s180++;
            else if (t.points >= 140) s140++;
            else if (t.points >= 100) s100++;
            else if (t.points >= 60) s60++;
            else if (t.points >= 40) s40++;
            else u40++;
        });

        if (this.matchScoreChart) this.matchScoreChart.destroy();
        this.matchScoreChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['<40', '40-59', '60-99', '100-139', '140-179', '180'],
                datasets: [{
                    data: [u40, s40, s60, s100, s140, s180],
                    backgroundColor: ['#64748b', '#94a3b8', '#3b82f6', '#8b5cf6', '#f59e0b', '#10b981'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'right', labels: { color: '#94a3b8', font: { size: 10 } } } },
                cutout: '50%'
            }
        });
    }
}

// Global reference for onclick handlers
window.app = null;
document.addEventListener('DOMContentLoaded', () => { window.app = new AutodartsStats(); });
