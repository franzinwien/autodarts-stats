# 🎯 Autodarts Stats Dashboard

Ein persönliches Dashboard für deine Autodarts-Statistiken.

## 🚀 Deployment auf GitHub Pages

### Schritt 1: GitHub Repository erstellen

1. Gehe zu https://github.com/new
2. Repository Name: `autodarts-stats` (oder was du willst)
3. Wähle **Public** (für GitHub Pages)
4. Klicke **Create repository**

### Schritt 2: Dateien hochladen

1. Klicke auf **"uploading an existing file"**
2. Ziehe alle Dateien aus diesem Ordner hinein:
   - `index.html`
   - `styles.css`
   - `config.js`
   - `app.js`
3. Klicke **Commit changes**

### Schritt 3: GitHub Pages aktivieren

1. Gehe zu **Settings** → **Pages**
2. Source: **Deploy from a branch**
3. Branch: **main** / **(root)**
4. Klicke **Save**
5. Warte 1-2 Minuten

Deine URL wird sein: `https://DEIN-USERNAME.github.io/autodarts-stats`

### Schritt 4: Supabase URL konfigurieren

1. Gehe zu Supabase → **Authentication** → **URL Configuration**
2. Setze **Site URL** auf: `https://DEIN-USERNAME.github.io/autodarts-stats`
3. Füge unter **Redirect URLs** hinzu: `https://DEIN-USERNAME.github.io/autodarts-stats`

## 🔐 Benutzer hinzufügen

Um weitere Spieler freizuschalten, führe in Supabase SQL Editor aus:

```sql
INSERT INTO allowed_users (email, autodarts_user_id, autodarts_username, is_admin)
VALUES ('email@example.com', 'UUID-DES-SPIELERS', 'spielername', false);
```

Die UUID findest du in der `users` Tabelle oder in den Match-Daten.

## 📊 Features

- **Übersicht**: Matches, Win Rate, Average, Checkout %
- **Matches**: Alle Matches mit Filter
- **Heatmap**: Wo landen deine Darts?
- **Gegner**: Statistik gegen jeden Gegner

## 🛠 Technologien

- Supabase (Datenbank + Auth)
- Chart.js (Grafiken)
- Vanilla JavaScript
- GitHub Pages (Hosting)
