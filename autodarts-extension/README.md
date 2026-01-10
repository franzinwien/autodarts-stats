# Autodarts Stats Tracker - Chrome Extension

Diese Chrome Extension synchronisiert automatisch deine Autodarts Match-Daten in deine Supabase Datenbank.

## 🚀 Installation

### Schritt 1: Extension in Chrome laden

1. Öffne Chrome und gehe zu: `chrome://extensions/`
2. Aktiviere oben rechts den **"Developer mode"** (Entwicklermodus)
3. Klicke auf **"Load unpacked"** (Entpackte Erweiterung laden)
4. Wähle den `autodarts-extension` Ordner aus
5. Die Extension sollte jetzt in deiner Toolbar erscheinen 🎯

### Schritt 2: Matches synchronisieren

1. Gehe zu **https://play.autodarts.io**
2. Logge dich ein (falls nötig)
3. Gehe zu **Match History** (Linke Seite → "Match history")
4. Klicke auf den grünen **"Sync Stats"** Button unten rechts
5. Warte bis alle Matches synchronisiert sind ✅

## 📊 Was wird gespeichert?

- **Matches**: Datum, Typ (Online/Local/Tournament), Variante, Ergebnis
- **Spieler**: Name, Land, Stats zum Zeitpunkt des Matches
- **Legs**: Jedes einzelne Leg mit Gewinner
- **Aufnahmen**: Jede Aufnahme mit Punkten und verbleibendem Score
- **Würfe**: Jeder einzelne Wurf mit Segment und Koordinaten (für Heatmaps!)

## 🔧 Konfiguration

Die Supabase-Verbindungsdaten sind in `supabase.js` gespeichert:
- `SUPABASE_URL`: Deine Supabase Project URL
- `SUPABASE_ANON_KEY`: Dein öffentlicher API Key
- `MY_USER_ID`: Deine Autodarts User ID

## 🐛 Troubleshooting

**"Error: Failed to fetch match"**
→ Stelle sicher, dass du auf autodarts.io eingeloggt bist

**Matches werden nicht gefunden**
→ Gehe zur Match History Seite und klicke dort auf Sync

**Extension erscheint nicht**
→ Prüfe ob Developer Mode aktiviert ist und lade die Seite neu

## 📈 Nächste Schritte

Nachdem deine Daten synchronisiert sind, kannst du:
1. In Supabase unter "Table Editor" deine Daten ansehen
2. Ein Dashboard bauen (z.B. mit GitHub Pages + Chart.js)
3. SQL-Abfragen für Statistiken schreiben

Beispiel-Abfragen findest du in der Supabase SQL Editor.
