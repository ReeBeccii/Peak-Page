// backend/public/js/formats.js

// ==================================================
// FORMAT-HILFSWERTE
// Zuständig für die Übersetzung von DB-Formaten in UI-Anzeigen (Deutsch)
// ==================================================

/**
 * Mapping von internen DB-Formatwerten zu
 * benutzerfreundlichen deutschen Bezeichnungen.
 *
 * DB (canonical values):
 * - ebook
 * - hardcover
 * - paperback
 * - audiobook
 *
 * UI-Anzeige:
 * - E-Book
 * - Hardcover
 * - Taschenbuch
 * - Hörbuch
 */
window.FORMAT_LABELS_DE = {
  ebook: "E-Book",
  hardcover: "Hardcover",
  paperback: "Taschenbuch",
  audiobook: "Hörbuch",
};

// ==================================================
// FORMAT-OPTIONEN (Dropdown)
// Zuständig für einheitliche Select-Optionen im Frontend
// ==================================================

/**
 * Erzeugt eine Liste von { value, label } Objekten
 * für Dropdown-Menüs.
 *
 * value  -> DB-Wert (z. B. "paperback")
 * label  -> UI-Text (z. B. "Taschenbuch")
 */
window.FORMAT_OPTIONS = Object.entries(window.FORMAT_LABELS_DE).map(
  ([value, label]) => ({ value, label })
);

// ==================================================
// FORMAT-ANZEIGE
// Zuständig für die Ausgabe des richtigen Labels im UI
// ==================================================

/**
 * Gibt das passende deutsche Label für ein Format zurück.
 *
 * @param {string|null|undefined} value - Formatwert aus der DB
 * @returns {string} Benutzerfreundliche Anzeige für das UI
 */
window.formatLabel = function formatLabel(value) {
  return window.FORMAT_LABELS_DE[value] ?? value ?? "";
};