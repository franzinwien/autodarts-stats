// Background Service Worker for Autodarts Stats Tracker
importScripts('supabase.js');

// Listen for messages from content script or popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'syncMatches') {
        syncMatches(request.matches)
            .then(result => sendResponse({ success: true, result }))
            .catch(error => sendResponse({ success: false, error: error.message }));
        return true; // Keep channel open for async response
    }
    
    if (request.action === 'syncSingleMatch') {
        syncSingleMatch(request.matchId)
            .then(result => sendResponse({ success: true, result }))
            .catch(error => sendResponse({ success: false, error: error.message }));
        return true;
    }
    
    if (request.action === 'getStats') {
        getStats()
            .then(result => sendResponse({ success: true, result }))
            .catch(error => sendResponse({ success: false, error: error.message }));
        return true;
    }
    
    if (request.action === 'checkMatch') {
        checkMatchExists(request.matchId)
            .then(exists => sendResponse({ exists }))
            .catch(error => sendResponse({ exists: false, error: error.message }));
        return true;
    }
});

// Check if match already exists in database
async function checkMatchExists(matchId) {
    const result = await supabase.select('matches', `id=eq.${matchId}&select=id`);
    return result.length > 0;
}

// Sync a single match with full details
async function syncSingleMatch(matchId) {
    console.log(`Syncing match ${matchId}...`);
    
    // Fetch full match details from Autodarts API
    const response = await fetch(`https://api.autodarts.io/as/v0/matches/${matchId}`, {
        credentials: 'include'
    });
    
    if (!response.ok) {
        throw new Error(`Failed to fetch match: ${response.status}`);
    }
    
    const match = await response.json();
    return await saveMatchToSupabase(match);
}

// Save complete match data to Supabase
async function saveMatchToSupabase(match) {
    console.log('Saving match:', match.id);
    
    // 1. Upsert users
    const users = [];
    for (const player of match.players) {
        if (player.user && player.userId) {
            users.push({
                id: player.userId,
                name: player.user.name?.trim() || player.name,
                avatar_url: player.user.avatarUrl || null,
                country: player.user.country || null,
                updated_at: new Date().toISOString()
            });
        }
    }
    
    if (users.length > 0) {
        await supabase.upsert('users', users);
    }
    
    // 2. Insert match
    const settings = match.games?.[0]?.settings || {};
    const matchData = {
        id: match.id,
        created_at: match.createdAt,
        finished_at: match.finishedAt,
        type: match.type,
        variant: match.variant,
        base_score: settings.baseScore || null,
        in_mode: settings.inMode || null,
        out_mode: settings.outMode || null,
        bull_mode: settings.bullMode || null,
        max_rounds: settings.maxRounds || null,
        target_sets: match.targetSets || null,
        target_legs: match.targetLegs || null,
        winner: match.winner,
        host_id: match.hostId || null,
        imported_at: new Date().toISOString()
    };
    
    await supabase.upsert('matches', [matchData]);
    
    // 3. Insert match players
    const matchPlayers = match.players.map(player => ({
        id: player.id,
        match_id: match.id,
        user_id: player.userId || null,
        player_index: player.index,
        name: player.name?.trim() || 'Unknown',
        is_bot: player.cpuPPR !== null,
        cpu_ppr: player.cpuPPR || null,
        sets_won: match.scores?.[player.index]?.sets || 0,
        legs_won: match.scores?.[player.index]?.legs || 0,
        average: player.user?.average || null,
        average_until_170: player.user?.averageUntil170 || null,
        first_9_average: player.user?.first9Average || null,
        checkout_rate: player.user?.checkoutRate || null,
        legs_played: player.user?.legsPlayed || null,
        total_180s: player.user?.total180s || null
    }));
    
    await supabase.upsert('match_players', matchPlayers);
    
    // 4. Insert legs (games)
    if (match.games && match.games.length > 0) {
        const legs = match.games.map(game => ({
            id: game.id,
            match_id: match.id,
            set_number: game.set,
            leg_number: game.leg,
            created_at: game.createdAt,
            finished_at: game.finishedAt,
            winner: game.winner,
            winner_player_id: game.winnerPlayerId || null,
            variant: game.variant
        }));
        
        await supabase.upsert('legs', legs);
        
        // 5. Insert turns and throws
        for (const game of match.games) {
            if (game.turns && game.turns.length > 0) {
                // Find the match_player_id for each turn
                const playerIdMap = {};
                for (const player of match.players) {
                    playerIdMap[player.id] = player.id;
                }
                
                const turns = game.turns.map(turn => ({
                    id: turn.id,
                    leg_id: game.id,
                    match_player_id: turn.playerId || null,
                    round: turn.round,
                    turn: turn.turn,
                    created_at: turn.createdAt,
                    finished_at: turn.finishedAt,
                    score_remaining: turn.score,
                    points: turn.points,
                    busted: turn.busted || false
                }));
                
                await supabase.upsert('turns', turns);
                
                // Insert throws
                const allThrows = [];
                for (const turn of game.turns) {
                    if (turn.throws && turn.throws.length > 0) {
                        for (const t of turn.throws) {
                            allThrows.push({
                                id: t.id,
                                turn_id: turn.id,
                                throw_index: t.throw,
                                created_at: t.createdAt,
                                segment_name: t.segment?.name || null,
                                segment_number: t.segment?.number || null,
                                segment_bed: t.segment?.bed || null,
                                segment_multiplier: t.segment?.multiplier || null,
                                coord_x: t.coords?.x || null,
                                coord_y: t.coords?.y || null,
                                entry: t.entry || null
                            });
                        }
                    }
                }
                
                if (allThrows.length > 0) {
                    // Insert in batches of 100
                    for (let i = 0; i < allThrows.length; i += 100) {
                        const batch = allThrows.slice(i, i + 100);
                        await supabase.upsert('throws', batch);
                    }
                }
            }
        }
    }
    
    return { matchId: match.id, success: true };
}

// Sync multiple matches (from history list)
async function syncMatches(matchIds) {
    const results = [];
    
    for (const matchId of matchIds) {
        try {
            // Check if already exists
            const exists = await checkMatchExists(matchId);
            if (exists) {
                results.push({ matchId, status: 'skipped', reason: 'already exists' });
                continue;
            }
            
            const result = await syncSingleMatch(matchId);
            results.push({ matchId, status: 'synced' });
            
            // Small delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 200));
        } catch (error) {
            results.push({ matchId, status: 'error', error: error.message });
        }
    }
    
    return results;
}

// Get stats summary
async function getStats() {
    const matches = await supabase.select('matches', 'select=id&order=finished_at.desc');
    return {
        totalMatches: matches.length
    };
}
