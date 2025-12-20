# Dashboard Redesign Konzept

## Status Quo - Analyse

### Aktuelle Struktur (9 Seiten)
| Seite | Zweck | Probleme |
|-------|-------|----------|
| **Overview** | KPIs + Charts | Zu viel auf einmal, 12 KPI-Cards |
| **Scoring** | T20/Scoring-Analyse | Redundant mit Overview & Match Detail |
| **Checkout** | Doubles-Statistik | Eigenständig, aber könnte integriert werden |
| **Matches** | Alle Matches (Tabelle) | OK, aber nur Match-Level |
| **Match Detail** | Einzelnes Match/Leg | Zu überladen, gute Leg-Ansicht versteckt |
| **Heatmap** | Dartboard-Visualisierung | Eigenständig, gut |
| **Opponents** | Gegner-Statistiken | Könnte in Matches integriert werden |
| **Advanced** | Zeit-Analyse | Nützlich, aber versteckt |
| **Head-to-Head** | Franz vs Bella | Spezialfall, bleibt |

### Identifizierte Redundanzen
| Metrik | Erscheint auf X Seiten |
|--------|------------------------|
| 3-Dart Average | 8 Seiten |
| Win Rate | 4 Seiten |
| Checkout Rate | 4 Seiten |
| 180er Count | 4 Seiten |
| 100+/140+ Rates | 3 Seiten |
| First 9 Average | 3 Seiten |

### Kernproblem: Match vs. Leg vs. Player Average
Aktuell werden diese Begriffe vermischt:
- **Player Average**: Durchschnitt über ALLE Legs/Matches eines Spielers
- **Match Average**: Durchschnitt innerhalb eines Matches
- **Leg Average**: Durchschnitt innerhalb eines Legs

---

## Neues Konzept: LEG-FOKUSSIERT

### Neue Navigation (5 Seiten statt 9)

```
┌─────────────────────────────────────────────────────────────┐
│  [Dashboard]  [Legs]  [Heatmap]  [Gegner]  [Head-to-Head]   │
└─────────────────────────────────────────────────────────────┘
```

### Globale Filter (erweitert)

```
┌──────────────────────────────────────────────────────────────────────┐
│ Spieler: [Franz ▼]  Zeitraum: [30 Tage ▼]  Typ: [Alle ▼]             │
│                                                                       │
│ Ansicht: (●) Legs  ( ) Matches    ← NEU: Toggle zwischen Leg/Match   │
└──────────────────────────────────────────────────────────────────────┘
```

Der **Ansicht-Toggle** bestimmt die Granularität ALLER Statistiken:
- **Legs**: Alle Stats basieren auf einzelnen Legs
- **Matches**: Alle Stats basieren auf Matches (wie bisher)

---

## Seite 1: Dashboard (ehemals Overview)

### Philosophie
- **Ein Blick = Alles Wichtige**
- Keine Deep-Dives, nur Top-Level KPIs
- Klare Trennung: Spieler-Stats vs. aktuelle Form

### Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│                         MEINE PERFORMANCE                            │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐        │
│  │ Average │ │ First 9 │ │Checkout │ │  180er  │ │Gewonnen │        │
│  │  68.4   │ │  72.1   │ │  34.2%  │ │   127   │ │  68.4%  │        │
│  │(gesamt) │ │(gesamt) │ │(gesamt) │ │(gesamt) │ │ Legs    │        │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘        │
├─────────────────────────────────────────────────────────────────────┤
│                        AKTUELLE FORM (Filter)                        │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐        │
│  │ Average │ │ First 9 │ │ Trend   │ │ Bestes  │ │Konstanz │        │
│  │  71.2   │ │  75.8   │ │   ↑     │ │  Leg    │ │   B+    │        │
│  │(Filter) │ │(Filter) │ │ +4.2%   │ │  94.3   │ │  σ=6.2  │        │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘        │
├─────────────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────┐  ┌──────────────────────────────┐ │
│  │     AVERAGE-TREND (LEGS)     │  │      SCORING-VERTEILUNG      │ │
│  │      [Line Chart]            │  │       [Doughnut Chart]       │ │
│  │                              │  │   180|140+|100+|60+|<60      │ │
│  └──────────────────────────────┘  └──────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────────┤
│                     LETZTE 10 LEGS/MATCHES                          │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ # │ Datum     │ Gegner  │ Avg  │ First9 │ CO% │ Rang │→     │   │
│  │ 1 │ 20.12.24  │ Bot 85  │ 72.1 │ 78.4   │ 50% │ #12  │ [→]  │   │
│  │ ...                                                          │   │
│  └──────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

### Änderungen vs. Alt
- **Entfernt**: 7 von 12 KPI-Cards (Redundanzen eliminiert)
- **Vereinfacht**: 2 Reihen KPIs statt 2 + Charts durcheinander
- **Klar getrennt**: "Gesamt" vs "aktueller Filter"
- **Leg-fokussiert**: Tabelle zeigt Legs (bei Leg-Ansicht)

---

## Seite 2: Legs (NEU - ersetzt Scoring + Matches + Match Detail)

### Philosophie
- **Zentrale Anlaufstelle für Leg-Analyse**
- Tabelle + Detail-View in einer Seite
- Ersetzt drei alte Seiten!

### Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│                           LEGS ÜBERSICHT                             │
│                                                                       │
│  Gruppierung: ( ) Einzeln  (●) Nach Match  ( ) Nach Tag              │
│                                                                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ # │ Datum     │ Match      │ Leg │ Avg  │ Darts │ CO  │Rang│→ │   │
│  │ 1 │ 20.12.24  │ vs Bot 85  │ 1/4 │ 94.3 │ 12    │ D16 │#1  │→ │   │
│  │ 2 │ 20.12.24  │ vs Bot 85  │ 2/4 │ 78.2 │ 15    │ D20 │#8  │→ │   │
│  │ 3 │ 20.12.24  │ vs Bot 85  │ 3/4 │ 65.4 │ 21    │ D8  │#45 │→ │   │
│  │ ...                                                          │   │
│  └──────────────────────────────────────────────────────────────┘   │
│  [Pagination: 1 2 3 ... 50]                                          │
│                                                                       │
├─────────────────────────────────────────────────────────────────────┤
│                        LEG DETAIL (wenn ausgewählt)                  │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ Leg #1 aus Match vs Bot 85 (20.12.2024)        [X schließen] │   │
│  ├──────────────────────────────────────────────────────────────┤   │
│  │ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ │   │
│  │ │ Average │ │ First 9 │ │  Darts  │ │Checkout │ │  Rang   │ │   │
│  │ │  94.3   │ │  100.0  │ │   12    │ │   D16   │ │  #1     │ │   │
│  │ └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘ │   │
│  ├──────────────────────────────────────────────────────────────┤   │
│  │         WURF-FÜR-WURF                                        │   │
│  │  ┌────────────────────────────────────────────────────────┐  │   │
│  │  │ Visit │ Score │ Remaining │ Darts          │           │  │   │
│  │  │   1   │  140  │    361    │ T20 T20 T20    │           │  │   │
│  │  │   2   │  100  │    261    │ T20 T20 S20    │           │  │   │
│  │  │   3   │  140  │    121    │ T20 T20 T20    │           │  │   │
│  │  │   4   │  121  │      0    │ T20 T11 D16 ✓  │           │  │   │
│  │  └────────────────────────────────────────────────────────┘  │   │
│  ├──────────────────────────────────────────────────────────────┤   │
│  │ ┌─────────────────────┐  ┌─────────────────────┐             │   │
│  │ │   SCORE-VERLAUF     │  │   WÜRFE (HEATMAP)   │             │   │
│  │ │   [Line Chart]      │  │   [Dartboard]       │             │   │
│  │ └─────────────────────┘  └─────────────────────┘             │   │
│  └──────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

### Match-Ansicht (wenn Toggle auf "Matches")

```
┌─────────────────────────────────────────────────────────────────────┐
│                         MATCHES ÜBERSICHT                            │
│                                                                       │
├─────────────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ # │ Datum     │ Gegner  │ Score │ Avg  │ CO%  │ Rang │  →   │   │
│  │ 1 │ 20.12.24  │ Bot 85  │ 3:1   │ 78.2 │ 42%  │ #5   │  →   │   │
│  │ ...                                                          │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                       │
├─────────────────────────────────────────────────────────────────────┤
│                      MATCH DETAIL (wenn ausgewählt)                  │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ Match vs Bot 85 (20.12.2024) - Sieg 3:1       [X schließen]  │   │
│  ├──────────────────────────────────────────────────────────────┤   │
│  │ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ │   │
│  │ │ Average │ │ First 9 │ │ Legs    │ │Checkout │ │  Rang   │ │   │
│  │ │  78.2   │ │  82.4   │ │  3:1    │ │  42%    │ │   #5    │ │   │
│  │ └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘ │   │
│  ├──────────────────────────────────────────────────────────────┤   │
│  │         LEG-ÜBERSICHT                                        │   │
│  │  ┌────────────────────────────────────────────────────────┐  │   │
│  │  │ Leg │ Winner │ Avg  │ First 9 │ Darts │ Checkout │     │  │   │
│  │  │  1  │  Ich   │ 94.3 │  100.0  │  12   │   D16    │ [→] │  │   │
│  │  │  2  │  Bot   │ 58.2 │   62.0  │  24   │    -     │ [→] │  │   │
│  │  │  3  │  Ich   │ 72.1 │   78.4  │  18   │   D20    │ [→] │  │   │
│  │  │  4  │  Ich   │ 68.4 │   72.1  │  21   │   D8     │ [→] │  │   │
│  │  └────────────────────────────────────────────────────────┘  │   │
│  ├──────────────────────────────────────────────────────────────┤   │
│  │ ┌─────────────────────┐  ┌─────────────────────┐             │   │
│  │ │  LEG-AVERAGES CHART │  │   SCORING-VERTEILUNG│             │   │
│  │ │   [Bar Chart]       │  │   [Doughnut]        │             │   │
│  │ └─────────────────────┘  └─────────────────────┘             │   │
│  └──────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

### Was hier konsolidiert wird
- **Matches-Seite** → In die Match-Ansicht integriert
- **Match Detail** → Wird zum Detail-View (aufklappbar)
- **Scoring-Page** → Scoring-Verteilung im Detail-View

---

## Seite 3: Heatmap (bleibt, mit Erweiterungen)

### Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│                            WURFANALYSE                               │
│                                                                       │
│  Bereich: [Alle ▼]   Quelle: (●) Alle Legs  ( ) Ausgewähltes Leg    │
│                              └── Wenn Leg ausgewählt auf Legs-Seite │
├─────────────────────────────────────────────────────────────────────┤
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐                    │
│  │Gruppier.│ │ Drift X │ │ Drift Y │ │ Würfe   │                    │
│  │  4.2mm  │ │   ← 2   │ │   ↑ 1   │ │  12847  │                    │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘                    │
├─────────────────────────────────────────────────────────────────────┤
│  ┌───────────────────────────────────┐  ┌─────────────────────────┐ │
│  │                                   │  │    T20 ANALYSE          │ │
│  │                                   │  │  ┌───────────────────┐  │ │
│  │         DARTBOARD                 │  │  │ Hit Rate: 42.1%   │  │ │
│  │         [Canvas]                  │  │  │ Scatter: [Mini]   │  │ │
│  │                                   │  │  └───────────────────┘  │ │
│  │                                   │  │    RICHTUNGS-HEATMAP   │ │
│  │                                   │  │  ┌───────────────────┐  │ │
│  └───────────────────────────────────┘  │  │   [8-Dir Grid]    │  │ │
│                                          │  └───────────────────┘  │ │
│                                          │    DISTANZ-ANALYSE     │ │
│                                          │  ┌───────────────────┐  │ │
│                                          │  │ 0-1cm: 42%        │  │ │
│                                          │  │ 1-2cm: 31%        │  │ │
│                                          │  │ 2-3cm: 18%        │  │ │
│                                          │  │ >3cm:   9%        │  │ │
│                                          │  └───────────────────┘  │ │
│                                          └─────────────────────────┘ │
├─────────────────────────────────────────────────────────────────────┤
│                        TOP SEGMENTE                                  │
│  D20: 847 | T20: 712 | S20: 684 | T19: 421 | ...                    │
└─────────────────────────────────────────────────────────────────────┘
```

### Neu
- **T20-Analyse** aus Match Detail hierher verschoben
- **Verknüpfung mit Legs-Seite**: Wenn ein Leg ausgewählt ist, kann man dessen Würfe isoliert anzeigen

---

## Seite 4: Gegner (konsolidiert Opponents + Advanced)

### Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│                            GEGNER & ANALYSE                          │
│                                                                       │
│  Tab: [Gegner] [Zeitanalyse]                                         │
│                                                                       │
├─────────────────────────────────────────────────────────────────────┤
│                         TAB: GEGNER                                  │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐                    │
│  │ Gegner  │ │ vs Bots │ │vs Mensch│ │ Nemesis │                    │
│  │   42    │ │  72.1%  │ │  58.4%  │ │  Thomas │                    │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘                    │
├─────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ Gegner     │ Spiele │ Siege │  %   │ Mein Ø │ Sein Ø │ Diff │    │
│  │ Bot 85     │   24   │  18   │ 75%  │  72.1  │  68.4  │ +3.7 │    │
│  │ Thomas     │   12   │   4   │ 33%  │  68.4  │  74.2  │ -5.8 │    │
│  │ ...                                                         │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                       │
│  ┌──────────────────────────┐  ┌──────────────────────────┐         │
│  │  WIN% NACH BOT-LEVEL    │  │   TOP 8 GEGNER           │         │
│  │  [Bar Chart]            │  │   [Stacked Bar]          │         │
│  └──────────────────────────┘  └──────────────────────────┘         │
│                                                                       │
├─────────────────────────────────────────────────────────────────────┤
│                       TAB: ZEITANALYSE                               │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐                    │
│  │Beste Zeit│ │Bester Tag│ │ Ø Legs │ │Spielzeit│                    │
│  │  Abend  │ │ Samstag │ │   4.2   │ │  127h   │                    │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘                    │
│                                                                       │
│  ┌──────────────────────────┐  ┌──────────────────────────┐         │
│  │  NACH UHRZEIT           │  │  NACH WOCHENTAG          │         │
│  │  [Bar Chart]            │  │  [Bar Chart]             │         │
│  └──────────────────────────┘  └──────────────────────────┘         │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                  KONSISTENZ-TREND                            │    │
│  │  [Rolling Std Dev Line Chart]                                │    │
│  └─────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
```

### Was konsolidiert wird
- **Opponents** → Tab "Gegner"
- **Advanced** → Tab "Zeitanalyse"

---

## Seite 5: Head-to-Head (bleibt unverändert)

Spezieller Use-Case für Franz vs Bella - keine Änderungen nötig.

---

## Zusammenfassung der Änderungen

### Vorher → Nachher

| Alt (9 Seiten) | Neu (5 Seiten) |
|----------------|----------------|
| Overview | → Dashboard (vereinfacht) |
| Scoring | → eliminiert (in Legs/Heatmap) |
| Checkout | → eliminiert (in Legs-Detail) |
| Matches | → Legs (Match-Ansicht) |
| Match Detail | → Legs (Detail-View) |
| Heatmap | → Heatmap (erweitert) |
| Opponents | → Gegner (Tab: Gegner) |
| Advanced | → Gegner (Tab: Zeitanalyse) |
| Head-to-Head | → Head-to-Head (unverändert) |

### Neue Filter-Logik

```
┌────────────────────────────────────────────────────────────────┐
│                    GLOBALE FILTER                              │
│                                                                │
│  Spieler: [Franz]   Zeitraum: [30 Tage]   Typ: [Alle]         │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  Ansicht:  (●) LEGS         ( ) MATCHES                  │ │
│  │                                                           │ │
│  │  Bei LEGS:                                                │ │
│  │  - Dashboard zeigt Leg-Statistiken                        │ │
│  │  - Legs-Seite zeigt einzelne Legs                         │ │
│  │  - Rankings basieren auf Leg-Average                      │ │
│  │                                                           │ │
│  │  Bei MATCHES:                                             │ │
│  │  - Dashboard zeigt Match-Statistiken                      │ │
│  │  - Legs-Seite zeigt Matches (mit Legs darin)              │ │
│  │  - Rankings basieren auf Match-Average                    │ │
│  └──────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────┘
```

### Klarstellung: Average-Typen

Im neuen Design wird IMMER klar angezeigt, welcher Average gemeint ist:

| Label | Bedeutung | Beispiel |
|-------|-----------|----------|
| **Average (gesamt)** | Über alle Daten des Spielers | "Dein Gesamtdurchschnitt" |
| **Average (Filter)** | Über gefilterte Daten | "Letzte 30 Tage" |
| **Leg-Average** | Average eines einzelnen Legs | "94.3 in diesem Leg" |
| **Match-Average** | Average eines Matches | "78.2 in diesem Match" |

---

## Implementierungs-Reihenfolge

### Phase 1: Filter-System
1. Toggle "Legs / Matches" zum globalen Filter hinzufügen
2. `getFilteredData()` erweitern für Leg-Level-Daten
3. Materialized Views nutzen (`leg_averages`)

### Phase 2: Dashboard vereinfachen
1. KPIs auf 10 reduzieren (5+5 Struktur)
2. "Gesamt" vs "Filter" Trennung
3. Charts anpassen

### Phase 3: Legs-Seite erstellen
1. Neue Tabelle mit Leg/Match-Toggle
2. Detail-View (Slide-in oder Modal)
3. Match Detail Funktionalität migrieren

### Phase 4: Heatmap erweitern
1. T20-Analyse aus Match Detail hierher
2. "Ausgewähltes Leg" Option

### Phase 5: Gegner konsolidieren
1. Tabs implementieren (Gegner / Zeitanalyse)
2. Opponents + Advanced zusammenführen

### Phase 6: Aufräumen
1. Alte Seiten entfernen (Scoring, Checkout, Matches, Match Detail, Advanced)
2. Navigation anpassen
3. CSS aufräumen

---

## Offene Fragen

1. **Checkout-Statistik**: Wo soll die detaillierte Doubles-Tabelle hin?
   - Option A: In Legs-Detail (pro Leg/Match)
   - Option B: Eigener Tab in Heatmap
   - Option C: Bleibt auf Dashboard als "Top Doubles"

2. **T20-Trend-Chart**: Soll der historische T20-Trend bleiben?
   - Aktuell auf Match Detail (letzte 100 Matches)
   - Könnte auf Heatmap als Option

3. **First 9 vs Rest Chart**: Behalten oder entfernen?
   - Aktuell auf Overview + Match Detail
   - Vielleicht nur auf Dashboard

---

## Nächste Schritte

Bitte bestätige das Konzept oder gib Feedback zu:
1. Navigation (5 Seiten OK?)
2. Legs/Matches Toggle (gut so?)
3. Offene Fragen (Checkout, T20-Trend, First 9)
4. Sonstige Wünsche
