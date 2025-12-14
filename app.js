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
        byDirection[d] = { close: [], far: [] }; // close: 0-5mm, far: >5mm
    });

    const results = {
        total: t20Area.length,
        hits: 0,
        misses: [],
        byDirection,
        byDistance: { '0-2mm': 0, '2-5mm': 0, '5-10mm': 0, '>10mm': 0 }
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

            // Nach Richtung und Nähe gruppieren
            if (distMm <= 5) {
                results.byDirection[direction].close.push(distMm);
            } else {
                results.byDirection[direction].far.push(distMm);
            }

            // Distanz-Kategorien
            if (distMm <= 2) results.byDistance['0-2mm']++;
            else if (distMm <= 5) results.byDistance['2-5mm']++;
            else if (distMm <= 10) results.byDistance['5-10mm']++;
            else results.byDistance['>10mm']++;
        }
    });

    return results;
}

class AutodartsStats {
    constructor() { this.user = null; this.currentPlayerId = null; this.allPlayers = []; this.allMatchPlayers = []; this.allMatches = []; this.opponentMap = {}; this.overallAverage = 0; this.matchRankings = []; this.filters = { time: 'all', type: '', variant: 'X01' }; this.init(); }
    
    async init() { const { data: { session } } = await supabase.auth.getSession(); if (session) await this.handleAuthSuccess(session.user); else { const hp = new URLSearchParams(window.location.hash.substring(1)); if (hp.get('access_token')) { const { data: { session: ns } } = await supabase.auth.getSession(); if (ns) { await this.handleAuthSuccess(ns.user); window.history.replaceState({}, document.title, window.location.pathname); } } } supabase.auth.onAuthStateChange(async (e, s) => { if (e === 'SIGNED_IN' && s) await this.handleAuthSuccess(s.user); else if (e === 'SIGNED_OUT') this.showLoginScreen(); }); this.setupEventListeners(); }
    
    setupEventListeners() { document.getElementById('send-magic-link')?.addEventListener('click', () => this.sendMagicLink()); document.getElementById('email-input')?.addEventListener('keypress', (e) => { if (e.key === 'Enter') this.sendMagicLink(); }); document.getElementById('logout-btn')?.addEventListener('click', () => this.logout()); document.querySelectorAll('.nav-btn').forEach(btn => btn.addEventListener('click', () => this.navigateTo(btn.dataset.page))); document.getElementById('apply-filters')?.addEventListener('click', () => this.applyFilters()); document.getElementById('heatmap-target')?.addEventListener('change', () => this.loadHeatmapData()); document.getElementById('global-filter-player')?.addEventListener('change', (e) => this.switchPlayer(e.target.value)); }
    
    async switchPlayer(pid) { if (pid === this.currentPlayerId) return; this.currentPlayerId = pid; await this.loadPlayerData(pid); this.applyFilters(); }
    applyFilters() { this.filters.time = document.getElementById('global-filter-time').value; this.filters.type = document.getElementById('global-filter-type').value; this.filters.variant = document.getElementById('global-filter-variant').value; this.navigateTo(document.querySelector('.nav-btn.active')?.dataset.page || 'overview'); }
    getFilteredData() { let d = this.allMatchPlayers.map(mp => ({...mp, match: this.allMatches.find(m => m.id === mp.match_id)})).filter(mp => mp.match); if (this.filters.time !== 'all') { const days = parseInt(this.filters.time), cutoff = new Date(); cutoff.setDate(cutoff.getDate() - days); d = d.filter(mp => new Date(mp.match.finished_at) >= cutoff); } if (this.filters.type) d = d.filter(mp => mp.match.type === this.filters.type); if (this.filters.variant) d = d.filter(mp => mp.match.variant === this.filters.variant); return d.sort((a, b) => new Date(b.match.finished_at) - new Date(a.match.finished_at)); }
    
    async sendMagicLink() { const email = document.getElementById('email-input').value.trim(), msg = document.getElementById('login-message'); if (!email) { msg.textContent = 'Bitte Email eingeben'; msg.className = 'login-message error'; return; } try { const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: location.origin + location.pathname } }); if (error) throw error; msg.textContent = 'Magic Link gesendet!'; msg.className = 'login-message success'; } catch (e) { msg.textContent = e.message; msg.className = 'login-message error'; } }
    
    async handleAuthSuccess(user) { this.user = user; this.showLoading(); try { const { data: players } = await supabase.from('allowed_users').select('*'); this.allPlayers = players || []; const cu = this.allPlayers.find(p => p.email === user.email); if (!cu) { alert('Zugang nicht erlaubt.'); await this.logout(); return; } this.currentPlayerId = cu.autodarts_user_id; document.getElementById('user-name').textContent = cu.autodarts_username || user.email; const sel = document.getElementById('global-filter-player'); if (sel) sel.innerHTML = this.allPlayers.map(p => '<option value="'+p.autodarts_user_id+'"'+(p.autodarts_user_id===cu.autodarts_user_id?' selected':'')+'>'+(p.autodarts_username||p.email)+'</option>').join(''); document.getElementById('global-filter-variant').value = 'X01'; this.filters.variant = 'X01'; await this.loadPlayerData(this.currentPlayerId); this.showDashboard(); this.navigateTo('overview'); } catch (e) { console.error(e); } finally { this.hideLoading(); } }
    
    async loadPlayerData(pid) { const { data: mp } = await supabase.from('match_players').select('*').eq('user_id', pid); this.allMatchPlayers = mp || []; if (!this.allMatchPlayers.length) return; const mids = [...new Set(this.allMatchPlayers.map(m => m.match_id))]; this.allMatches = []; for (let i = 0; i < mids.length; i += 50) { const { data } = await supabase.from('matches').select('*').in('id', mids.slice(i, i+50)); if (data) this.allMatches.push(...data); } this.opponentMap = {}; for (let i = 0; i < mids.length; i += 50) { const { data } = await supabase.from('match_players').select('*').in('match_id', mids.slice(i, i+50)); data?.forEach(p => { if (p.user_id !== pid && !this.opponentMap[p.match_id]) this.opponentMap[p.match_id] = p; }); } const avgs = this.allMatchPlayers.filter(m => m.average > 0).map(m => m.average); this.overallAverage = avgs.length ? avgs.reduce((a,b)=>a+b,0)/avgs.length : 0; }
    
    async loadTurns(mpIds) { if (!mpIds.length) return []; let r = []; for (let i = 0; i < mpIds.length; i += 50) { const batch = mpIds.slice(i,i+50); const { data, error } = await supabase.from('turns').select('id,points,round,match_player_id,created_at,score_remaining').in('match_player_id', batch); if (error) console.error('loadTurns error:', error, 'batch:', batch); if (data) r.push(...data); } return r; }
    async loadThrows(tids, lim=5000) { if (!tids.length) return []; let r = []; for (let i = 0; i < Math.min(tids.length,lim); i += 100) { const { data } = await supabase.from('throws').select('*').in('turn_id', tids.slice(i,i+100)); if (data) r.push(...data); } return r; }
    
    // Calculate average from turns for a match_player
    calcAvgFromTurns(turns, mpId) { const t = turns.filter(x => x.match_player_id === mpId && x.points !== null); return t.length ? t.reduce((s,x) => s + x.points, 0) / t.length : 0; }
    
    // Calculate rankings client-side
    calcRankings(matchesWithAvg) { const sorted = [...matchesWithAvg].sort((a,b) => b.calcAvg - a.calcAvg); sorted.forEach((m, i) => m.avgRank = i + 1); const byScore = [...matchesWithAvg].sort((a,b) => { const scoreA = a.calcAvg * 0.4 + (a.isWin ? 10 : 0); const scoreB = b.calcAvg * 0.4 + (b.isWin ? 10 : 0); return scoreB - scoreA; }); byScore.forEach((m, i) => m.matchRank = i + 1); return matchesWithAvg; }
    
    getRankBadge(rank, total) { if (rank === 1) return '<span class="rank-badge rank-gold">🥇 1</span>'; if (rank === 2) return '<span class="rank-badge rank-silver">🥈 2</span>'; if (rank === 3) return '<span class="rank-badge rank-bronze">🥉 3</span>'; if (rank <= 10) return '<span class="rank-badge rank-top10">#' + rank + '</span>'; return '<span class="rank-badge rank-normal">#' + rank + '</span>'; }
    
    async logout() { await supabase.auth.signOut(); this.showLoginScreen(); }
    showLoginScreen() { document.getElementById('login-screen').classList.remove('hidden'); document.getElementById('dashboard-screen').classList.add('hidden'); }
    showDashboard() { document.getElementById('login-screen').classList.add('hidden'); document.getElementById('dashboard-screen').classList.remove('hidden'); }
    showLoading() { document.getElementById('loading-overlay')?.classList.remove('hidden'); }
    hideLoading() { document.getElementById('loading-overlay')?.classList.add('hidden'); }
    navigateTo(page) { document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.page === page)); document.querySelectorAll('.page').forEach(p => p.classList.toggle('active', p.id === 'page-'+page)); ({overview:()=>this.loadOverviewData(),scoring:()=>this.loadScoringData(),checkout:()=>this.loadCheckoutData(),matches:()=>this.loadMatchesPage(),matchdetail:()=>this.loadMatchDetailPage(),heatmap:()=>this.loadHeatmapData(),opponents:()=>this.loadOpponentsData(),advanced:()=>this.loadAdvancedData(),headtohead:()=>this.loadH2HData()})[page]?.(); }

    // ========== OVERVIEW ==========
    async loadOverviewData() { this.showLoading(); try { const matches = this.getFilteredData(), mpIds = matches.map(m=>m.id), total = matches.length; let wins=0, checkoutSum=0, checkoutCnt=0, bestAvg=0, highFin=0; matches.forEach(mp => { if(mp.match.winner===mp.player_index)wins++; if(mp.checkout_rate>0){checkoutSum+=mp.checkout_rate;checkoutCnt++;} if(mp.average>bestAvg)bestAvg=mp.average; }); const turns = await this.loadTurns(mpIds); let pts=0,cnt=0,f9pts=0,f9cnt=0,c180=0,scorePts=0,scoreCnt=0; const byMp={}; turns.forEach(t=>{if(t.points!==null){pts+=t.points;cnt++;if(t.points===180)c180++;if(t.round<=3){f9pts+=t.points;f9cnt++;}if(t.score_remaining===null||t.score_remaining>100){scorePts+=t.points;scoreCnt++;}if(!byMp[t.match_player_id])byMp[t.match_player_id]=[];byMp[t.match_player_id].push(t.points);}}); turns.filter(t=>t.score_remaining===0).forEach(t=>{if(t.points>highFin)highFin=t.points;}); 
    // Calc per-match averages and rankings
    const matchData = matches.map(mp => { const t = byMp[mp.id] || []; const calcAvg = t.length ? t.reduce((a,b)=>a+b,0)/t.length : (mp.average || 0); return {...mp, calcAvg, isWin: mp.match.winner === mp.player_index }; });
    this.matchRankings = this.calcRankings(matchData);
    const bestMatch = this.matchRankings.find(m => m.avgRank === 1);
    const mAvgs=Object.values(byMp).map(a=>a.reduce((x,y)=>x+y,0)/a.length), avg=mAvgs.length?mAvgs.reduce((a,b)=>a+b,0)/mAvgs.length:0, std=Math.sqrt(mAvgs.length?mAvgs.reduce((s,a)=>s+Math.pow(a-avg,2),0)/mAvgs.length:0); const now=new Date(),w1=new Date(now-7*864e5),w2=new Date(now-14*864e5); const rec=matches.filter(m=>new Date(m.match.finished_at)>=w1&&m.average>0),prev=matches.filter(m=>{const d=new Date(m.match.finished_at);return d>=w2&&d<w1&&m.average>0;}); const recAvg=rec.length?rec.reduce((s,m)=>s+m.average,0)/rec.length:0,prevAvg=prev.length?prev.reduce((s,m)=>s+m.average,0)/prev.length:0,trend=prevAvg?recAvg-prevAvg:0; document.getElementById('stat-matches').textContent=total; document.getElementById('stat-winrate').textContent=(total?((wins/total)*100).toFixed(1):0)+'%'; document.getElementById('stat-average').textContent=cnt?(pts/cnt).toFixed(1):'-'; document.getElementById('stat-first9').textContent=f9cnt?(f9pts/f9cnt).toFixed(1):'-'; document.getElementById('stat-checkout').textContent=checkoutCnt?((checkoutSum/checkoutCnt)*100).toFixed(1)+'%':'-'; document.getElementById('stat-180s').textContent=c180; document.getElementById('stat-avg-to-100').textContent=scoreCnt?(scorePts/scoreCnt).toFixed(1):'-'; document.getElementById('stat-best-leg').textContent='-'; document.getElementById('stat-highest-finish').textContent=highFin||'-'; document.getElementById('stat-best-match-avg').textContent=bestMatch?bestMatch.calcAvg.toFixed(1):'-'; const tEl=document.getElementById('stat-trend'); tEl.textContent=trend>0?'↑ +'+trend.toFixed(1):trend<0?'↓ '+trend.toFixed(1):'→ 0'; tEl.className='stat-value '+(trend>0?'trend-up':trend<0?'trend-down':''); document.getElementById('stat-consistency').textContent=(std<3?'A+':std<5?'A':std<7?'B':std<10?'C':'D')+' (±'+std.toFixed(1)+')'; this.renderAvgChart(matches,turns); this.renderResultsChart(wins,total-wins); this.renderFirst9Chart(turns); this.renderScoringChart(turns); this.renderHighScoresChart(turns); this.renderRecentMatches(this.matchRankings.slice(0,10)); }catch(e){console.error(e);}finally{this.hideLoading();} }

    renderAvgChart(matches,turns){const ctx=document.getElementById('chart-avg-comparison');if(!ctx)return;const byMp={};turns.forEach(t=>{if(t.points!==null){if(!byMp[t.match_player_id])byMp[t.match_player_id]={all:[],sc:[]};byMp[t.match_player_id].all.push(t.points);if(t.score_remaining===null||t.score_remaining>100)byMp[t.match_player_id].sc.push(t.points);}});const md=matches.map(mp=>{const d=byMp[mp.id]||{all:[],sc:[]};return{date:new Date(mp.match.finished_at),avgAll:d.all.length?d.all.reduce((a,b)=>a+b,0)/d.all.length:null,avgSc:d.sc.length?d.sc.reduce((a,b)=>a+b,0)/d.sc.length:null};}).filter(m=>m.avgAll!==null).sort((a,b)=>a.date-b.date);if(!md.length)return;const days=Math.ceil((md[md.length-1].date-md[0].date)/864e5);let dp;if(days>180){const byM={};md.forEach(m=>{const k=m.date.toISOString().slice(0,7);if(!byM[k])byM[k]={all:[],sc:[]};byM[k].all.push(m.avgAll);if(m.avgSc)byM[k].sc.push(m.avgSc);});dp=Object.entries(byM).sort((a,b)=>a[0].localeCompare(b[0])).map(([m,d])=>({l:new Date(m+'-01').toLocaleDateString('de-DE',{month:'short',year:'2-digit'}),a:d.all.reduce((x,y)=>x+y,0)/d.all.length,s:d.sc.length?d.sc.reduce((x,y)=>x+y,0)/d.sc.length:null}));}else{dp=md.slice(-30).map(m=>({l:m.date.toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit'}),a:m.avgAll,s:m.avgSc}));}if(this.avgCompChart)this.avgCompChart.destroy();this.avgCompChart=new Chart(ctx,{type:'line',data:{labels:dp.map(d=>d.l),datasets:[{label:'Avg bis 100',data:dp.map(d=>d.s?.toFixed(1)),borderColor:CONFIG.COLORS.blue,fill:false,tension:.3},{label:'Match Avg',data:dp.map(d=>d.a.toFixed(1)),borderColor:CONFIG.COLORS.green,backgroundColor:'rgba(16,185,129,.1)',fill:true,tension:.3}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'top',labels:{color:'#94a3b8'}}},scales:{x:{grid:{color:'rgba(255,255,255,.1)'},ticks:{color:'#94a3b8',maxRotation:45,font:{size:10}}},y:{grid:{color:'rgba(255,255,255,.1)'},ticks:{color:'#94a3b8'},suggestedMin:30,suggestedMax:55}}}});}
    renderResultsChart(w,l){const ctx=document.getElementById('chart-results');if(!ctx)return;if(this.resChart)this.resChart.destroy();this.resChart=new Chart(ctx,{type:'doughnut',data:{labels:['Siege','Niederl.'],datasets:[{data:[w,l],backgroundColor:[CONFIG.COLORS.green,CONFIG.COLORS.red],borderWidth:0}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom',labels:{color:'#94a3b8'}}},cutout:'65%'}});}
    renderFirst9Chart(turns){const ctx=document.getElementById('chart-first9-comparison');if(!ctx)return;let f9=0,f9c=0,r=0,rc=0;turns.forEach(t=>{if(t.points!==null){if(t.round<=3){f9+=t.points;f9c++;}else{r+=t.points;rc++;}}});if(this.f9Chart)this.f9Chart.destroy();this.f9Chart=new Chart(ctx,{type:'bar',data:{labels:['First 9','Rest'],datasets:[{data:[f9c?(f9/f9c).toFixed(1):0,rc?(r/rc).toFixed(1):0],backgroundColor:[CONFIG.COLORS.green,CONFIG.COLORS.blue],borderRadius:8}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{grid:{display:false},ticks:{color:'#94a3b8'}},y:{grid:{color:'rgba(255,255,255,.1)'},ticks:{color:'#94a3b8'},suggestedMin:30,suggestedMax:50}}}});}
    renderScoringChart(turns){const ctx=document.getElementById('chart-scoring-distribution');if(!ctx)return;let u40=0,s40=0,s60=0,s100=0,s140=0,s180=0;turns.forEach(t=>{if(t.points===null)return;if(t.points===180)s180++;else if(t.points>=140)s140++;else if(t.points>=100)s100++;else if(t.points>=60)s60++;else if(t.points>=40)s40++;else u40++;});if(this.scorChart)this.scorChart.destroy();this.scorChart=new Chart(ctx,{type:'doughnut',data:{labels:['<40','40-59','60-99','100-139','140-179','180'],datasets:[{data:[u40,s40,s60,s100,s140,s180],backgroundColor:['#64748b','#94a3b8','#3b82f6','#8b5cf6','#f59e0b','#10b981'],borderWidth:0}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'right',labels:{color:'#94a3b8',font:{size:11}}}},cutout:'50%'}});}
    renderHighScoresChart(turns){const ctx=document.getElementById('chart-high-scores');if(!ctx)return;const mon={};turns.forEach(t=>{if(t.points===null||!t.created_at)return;const m=t.created_at.slice(0,7);if(!mon[m])mon[m]={s180:0,s140:0,s100:0};if(t.points===180)mon[m].s180++;else if(t.points>=140)mon[m].s140++;else if(t.points>=100)mon[m].s100++;});const ms=Object.keys(mon).sort().slice(-8);if(this.hsChart)this.hsChart.destroy();this.hsChart=new Chart(ctx,{type:'bar',data:{labels:ms.map(m=>new Date(m+'-01').toLocaleDateString('de-DE',{month:'short'})),datasets:[{label:'180s',data:ms.map(m=>mon[m].s180),backgroundColor:CONFIG.COLORS.green},{label:'140+',data:ms.map(m=>mon[m].s140),backgroundColor:CONFIG.COLORS.yellow},{label:'100+',data:ms.map(m=>mon[m].s100),backgroundColor:CONFIG.COLORS.blue}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'top',labels:{color:'#94a3b8',font:{size:10}}}},scales:{x:{stacked:true,grid:{display:false},ticks:{color:'#94a3b8'}},y:{stacked:true,grid:{color:'rgba(255,255,255,.1)'},ticks:{color:'#94a3b8'}}}}});}
    renderRecentMatches(matches){const tb=document.querySelector('#recent-matches-table tbody');if(!tb)return;const total=this.matchRankings.length;tb.innerHTML=matches.map(mp=>{const m=mp.match,d=new Date(m.finished_at),w=m.winner===mp.player_index,opp=this.opponentMap[mp.match_id],on=opp?(opp.is_bot?'🤖 Bot '+Math.round((opp.cpu_ppr||40)/10):opp.name||'Gegner'):'?',avg=mp.calcAvg||0,pc=avg>this.overallAverage+5?'perf-great':avg>this.overallAverage?'perf-good':avg>this.overallAverage-5?'perf-ok':'perf-bad',pt=avg>this.overallAverage+5?'🔥 Super':avg>this.overallAverage?'✅ Gut':avg>this.overallAverage-5?'➖ Ok':'❌ Schwach';return'<tr><td>'+d.toLocaleDateString('de-DE')+'</td><td>'+on+'</td><td class="'+(w?'result-win':'result-loss')+'">'+(w?'✅':'❌')+'</td><td>'+avg.toFixed(1)+'</td><td class="'+pc+'">'+pt+'</td><td>'+this.getRankBadge(mp.avgRank,total)+'</td></tr>';}).join('');}

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
            // Get all matches where both players participated
            const { data: franzMatches } = await supabase.from('match_players').select('match_id').eq('user_id', FRANZ_ID);
            const { data: bellaMatches } = await supabase.from('match_players').select('match_id').eq('user_id', BELLACIAO_ID);
            
            if (!franzMatches || !bellaMatches) { this.hideLoading(); return; }
            
            const franzMatchIds = new Set(franzMatches.map(m => m.match_id));
            const commonMatchIds = bellaMatches.filter(m => franzMatchIds.has(m.match_id)).map(m => m.match_id);
            
            if (commonMatchIds.length === 0) {
                document.getElementById('h2h-total-matches').textContent = '0';
                this.hideLoading();
                return;
            }
            
            // Load match details
            let matches = [];
            for (let i = 0; i < commonMatchIds.length; i += 50) {
                const batch = commonMatchIds.slice(i, i + 50);
                const { data } = await supabase.from('matches').select('*').in('id', batch);
                if (data) matches.push(...data);
            }
            
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
            
            // Load match_players for these matches
            let allPlayers = [];
            for (let i = 0; i < filteredMatchIds.length; i += 50) {
                const batch = filteredMatchIds.slice(i, i + 50);
                const { data } = await supabase.from('match_players').select('*').in('match_id', batch);
                if (data) allPlayers.push(...data);
            }
            
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

            // Load from leg_averages view by match_id (fewer batches than by mp_id)
            let allLegAvgs = [];
            for (let i = 0; i < filteredMatchIds.length; i += 100) {
                const { data, error } = await supabase
                    .from('leg_averages')
                    .select('*')
                    .in('match_id', filteredMatchIds.slice(i, i + 100));
                if (data) allLegAvgs.push(...data);
            }

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

        // Setup event listeners
        select.onchange = () => this.loadMatchDetail(select.value);
        document.getElementById('match-detail-prev')?.addEventListener('click', () => this.navigateMatch(-1));
        document.getElementById('match-detail-next')?.addEventListener('click', () => this.navigateMatch(1));

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
            const { data: legs } = await supabase.from('legs').select('*').eq('match_id', matchId).order('leg_number');

            // Load turns for both players
            const { data: myTurns } = await supabase.from('turns').select('*').eq('match_player_id', mp.id).order('created_at');
            let oppTurns = [];
            if (oppMp) {
                const { data } = await supabase.from('turns').select('*').eq('match_player_id', oppMp.id).order('created_at');
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

            // Show match ranking if available
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

            // Ton+ rate (visits >= 100 points)
            const tonPlusVisits = (myTurns || []).filter(t => t.points >= 100).length;
            const totalVisits = (myTurns || []).length;
            document.getElementById('md-ton-plus').textContent = totalVisits ? ((tonPlusVisits / totalVisits) * 100).toFixed(1) + '%' : '-';

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

            // Render leg overview
            this.renderLegOverview();
            this.renderLegAveragesChart();
            this.renderMatchScoringChart();
            this.renderMatchFirst9Chart();

            // Render T20 Streuungsanalyse
            this.renderT20Analysis(myThrows);

            // Select first leg
            if (this.currentMatchLegs.length > 0) {
                this.selectLeg(this.currentMatchLegs[0].id);
            }

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

        // 8 Direction stats
        const directions = ['links-oben', 'links-mitte', 'links-unten', 'oben', 'unten', 'rechts-oben', 'rechts-mitte', 'rechts-unten'];
        directions.forEach(dir => {
            const el = document.getElementById(`t20-miss-${dir}`);
            if (el) {
                const data = analysis.byDirection[dir];
                const closeCount = data.close.length;
                const farCount = data.far.length;
                const total = closeCount + farCount;

                if (total > 0) {
                    el.querySelector('.direction-value').textContent = total;
                    el.querySelector('.direction-detail').textContent = `≤5mm: ${closeCount} | >5mm: ${farCount}`;
                } else {
                    el.querySelector('.direction-value').textContent = '-';
                    el.querySelector('.direction-detail').textContent = '';
                }
            }
        });

        // Center (T20 hits)
        const centerEl = document.getElementById('t20-miss-center');
        if (centerEl) {
            centerEl.querySelector('.direction-value').textContent = analysis.hits || '0';
        }

        // Distance breakdown bars (now in mm)
        const totalMisses = analysis.misses.length || 1;
        const distMapping = {
            '0-2mm': { fillId: 'dist-0-2', countId: 'dist-count-0-2' },
            '2-5mm': { fillId: 'dist-2-5', countId: 'dist-count-2-5' },
            '5-10mm': { fillId: 'dist-5-10', countId: 'dist-count-5-10' },
            '>10mm': { fillId: 'dist-10plus', countId: 'dist-count-10plus' }
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
}

// Global reference for onclick handlers
window.app = null;
document.addEventListener('DOMContentLoaded', () => { window.app = new AutodartsStats(); });
