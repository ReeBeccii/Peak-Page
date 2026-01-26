
# Backend – Peak & Page ⚙️

Dieses Verzeichnis enthält das Backend der Anwendung **Peak & Page**.
Das Backend stellt eine REST-API bereit und verwaltet Authentifizierung, Sessions und Datenbankzugriffe.

---

## 🚀 Backend starten

```bash
npm install
npm start

Der Server läuft standardmäßig auf:
http://localhost:3000

---

## ➕ API-Hinweis
Das Backend stellt eine REST-API bereit zur:
- Benutzerregistrierung & Login
- Verwaltung von Buchdaten
- Session-basierter Authentifizierung

---

## 📁 Verzeichnisstruktur

```text
backend/
├─ src/
│  ├─ routes/        → API-Routen
│  ├─ controllers/   → Logik zur Verarbeitung der Anfragen
│  ├─ db/            → Datenbank-Zugriffe (SQLite)
│  ├─ middlewares/   → Error-Handling & Validierung
│  ├─ app.js         → Express-App
│  └─ server.js      → Server-Start
├─ public/           → Statisches Frontend
├─ package.json
└─ README.md
