export function errorHandler(err, req, res, next) {
  console.error("💥 Fehler:", err);

  // Default: interner Fehler
  const status = err.status || 500;

  res.status(status).json({
    error: err.message || "Interner Serverfehler",
  });
}
