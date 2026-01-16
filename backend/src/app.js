import express from "express";
import cors from "cors";
import morgan from "morgan";
import path from "path";
import session from "express-session";
import SQLiteStoreFactory from "connect-sqlite3";

import healthRoutes from "./routes/health.routes.js";
import booksRoutes from "./routes/books.routes.js";
import userBooksRoutes from "./routes/userBooks.routes.js";
import googleBooksRoutes from "./routes/googleBooks.routes.js";
import authRoutes from "./routes/auth.routes.js";
import { errorHandler } from "./middlewares/errorHandler.js";

const app = express();

/* ================================
   Static Frontend (public/)
================================ */
app.use(express.static(path.join(process.cwd(), "public")));

/* ================================
   Basic Middlewares
================================ */
app.use(cors()); // für später ok (gleiches Origin)
app.use(express.json());
app.use(morgan("dev"));

/* ================================
   Session Setup (SQLite Store)
================================ */
const SQLiteStore = SQLiteStoreFactory(session);

app.use(
  session({
    store: new SQLiteStore({
      dir: "../database",
      db: "sessions.db",
    }),
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: false, // solange kein HTTPS
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 Tage
    },
  })
);

/* ================================
   API Routes
================================ */
app.use("/api", healthRoutes);
app.use("/api/books", booksRoutes);
app.use("/api/user-books", userBooksRoutes);
app.use("/api/google-books", googleBooksRoutes);
app.use("/api/auth", authRoutes);

/* ================================
   404 Handler
================================ */
app.use((req, res) => {
  res.status(404).json({ error: "Route nicht gefunden" });
});

/* ================================
   Global Error Handler
================================ */
app.use(errorHandler);

export default app;
