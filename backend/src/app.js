import express from "express";
import cors from "cors";
import morgan from "morgan";

import healthRoutes from "./routes/health.routes.js";
import booksRoutes from "./routes/books.routes.js";
import userBooksRoutes from "./routes/userBooks.routes.js";
import { errorHandler } from "./middlewares/errorHandler.js";
import googleBooksRoutes from "./routes/googleBooks.routes.js";


const app = express();

// Middlewares
app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

// Routes
app.use("/api", healthRoutes);
app.use("/api/books", booksRoutes);
app.use("/api/user-books", userBooksRoutes);
app.use("/api/google-books", googleBooksRoutes);


// 404 für unbekannte Routen
app.use((req, res) => {
  res.status(404).json({ error: "Route nicht gefunden" });
});

// Zentraler Error-Handler
app.use(errorHandler);

export default app;
