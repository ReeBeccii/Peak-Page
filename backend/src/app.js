import express from "express";
import cors from "cors";
import morgan from "morgan";
import path from "path";
import session from "express-session";
import SQLiteStoreFactory from "connect-sqlite3";
import dotenv from "dotenv";

import healthRoutes from "./routes/health.routes.js";
import booksRoutes from "./routes/books.routes.js";
import userBooksRoutes from "./routes/userBooks.routes.js";
import googleBooksRoutes from "./routes/googleBooks.routes.js";
import authRoutes from "./routes/auth.routes.js";
import libraryRoutes from "./routes/library.routes.js";
import dashboardRoutes from "./routes/dashboard.routes.js";

import { errorHandler } from "./middlewares/errorHandler.js";

dotenv.config();

const app = express();

// ✅ verhindert 304 bei API-Responses (ETag)
app.set("etag", false);

/* ✅ Frontend aus public/ ausliefern */
app.use(express.static(path.join(process.cwd(), "public")));

// Middlewares
app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

const SQLiteStore = SQLiteStoreFactory(session);

// ✅ Session-DB immer im Projekt-Ordner /database (eine Ebene über /backend)
const sessionsDir = path.resolve(process.cwd(), "../database");

app.use(
  session({
    store: new SQLiteStore({ dir: sessionsDir, db: "sessions.db" }),
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      maxAge: 1000 * 60 * 60 * 24 * 7,
    },
  })
);


// Routes
app.use("/api", healthRoutes);
app.use("/api/books", booksRoutes);
app.use("/api/user-books", userBooksRoutes);
app.use("/api/google-books", googleBooksRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/dashboard", dashboardRoutes);

// ✅ NEU: Bibliothek-API
app.use("/api/library", libraryRoutes);

// 404 für unbekannte Routen
app.use((req, res) => {
  res.status(404).json({ error: "Route nicht gefunden" });
});

// Zentraler Error-Handler
app.use(errorHandler);

export default app;
