PRAGMA foreign_keys = ON;

-- =========================================================
-- 1) USERS (Login / später Multi-User möglich)
-- =========================================================
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Optional: Ein "Default-User" für lokale Single-User-Phase
-- (Passwort-Hash musst du später im Backend richtig setzen)
-- INSERT INTO users (email, password_hash) VALUES ('becci@local', 'TEMP_HASH');

-- =========================================================
-- 2) BOOKS (Stammdaten - z.B. aus Google Books API)
-- =========================================================
CREATE TABLE IF NOT EXISTS books (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  isbn13 TEXT UNIQUE,
  title TEXT NOT NULL,
  cover_url TEXT,
  default_price REAL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- =========================================================
-- 3) AUTHORS + Zuordnung (n:m)
-- =========================================================
CREATE TABLE IF NOT EXISTS authors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS book_authors (
  book_id INTEGER NOT NULL,
  author_id INTEGER NOT NULL,
  PRIMARY KEY (book_id, author_id),
  FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
  FOREIGN KEY (author_id) REFERENCES authors(id) ON DELETE CASCADE
);

-- =========================================================
-- 4) GENRES + Zuordnung (n:m)
-- =========================================================
CREATE TABLE IF NOT EXISTS genres (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS book_genres (
  book_id INTEGER NOT NULL,
  genre_id INTEGER NOT NULL,
  PRIMARY KEY (book_id, genre_id),
  FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
  FOREIGN KEY (genre_id) REFERENCES genres(id) ON DELETE CASCADE
);

-- =========================================================
-- 5) FORMATS (separate Tabelle, wie besprochen)
-- =========================================================
CREATE TABLE IF NOT EXISTS formats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE
);

-- Initialwerte (idempotent dank UNIQUE + OR IGNORE)
INSERT OR IGNORE INTO formats (name) VALUES
  ('ebook'),
  ('hardcover'),
  ('paperback'),
  ('audiobook');

-- =========================================================
-- 6) USER_BOOKS (dein Regal pro User: Status, Bewertung, Notizen, Preis, Format...)
-- =========================================================
CREATE TABLE IF NOT EXISTS user_books (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  book_id INTEGER NOT NULL,

  -- Format als Foreign Key (z.B. ebook/hardcover/...)
  format_id INTEGER NOT NULL,

  -- Status: wir lassen es als TEXT (Validation macht dein Backend)
  status TEXT NOT NULL DEFAULT 'unread',  -- unread | reading | read

  rating INTEGER,          -- z.B. 1..5 (Validation im Backend)
  notes TEXT,

  price_paid REAL,         -- deine Ausgaben (Dashboard)
  started_at TEXT,
  finished_at TEXT,
  last_read_at TEXT,

  -- Ein User soll ein Buch nur einmal im Regal haben (MVP)
  UNIQUE (user_id, book_id),

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
  FOREIGN KEY (format_id) REFERENCES formats(id)
);

-- =========================================================
-- 7) LOANS (Ausleihen mit Historie; aktuell = returned_at IS NULL)
-- =========================================================
CREATE TABLE IF NOT EXISTS loans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,  -- Besitzer/Verleiher
  book_id INTEGER NOT NULL,

  borrower_name TEXT NOT NULL,

  loaned_at TEXT NOT NULL DEFAULT (datetime('now')),
  due_at TEXT,
  returned_at TEXT,

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
);

-- =========================================================
-- 8) INDEXE (Performance für Dashboard & Filter)
-- =========================================================
CREATE INDEX IF NOT EXISTS idx_books_isbn13 ON books(isbn13);
CREATE INDEX IF NOT EXISTS idx_authors_name ON authors(name);
CREATE INDEX IF NOT EXISTS idx_genres_name ON genres(name);

CREATE INDEX IF NOT EXISTS idx_user_books_user_status ON user_books(user_id, status);
CREATE INDEX IF NOT EXISTS idx_user_books_user_format ON user_books(user_id, format_id);
CREATE INDEX IF NOT EXISTS idx_user_books_book_id ON user_books(book_id);

CREATE INDEX IF NOT EXISTS idx_loans_user_returned ON loans(user_id, returned_at);
CREATE INDEX IF NOT EXISTS idx_loans_book_returned ON loans(book_id, returned_at);

-- =========================================================
-- 9) (Optional) VIEW für "aktuell ausgeliehen"
-- =========================================================
CREATE VIEW IF NOT EXISTS v_current_loans AS
SELECT
  l.id AS loan_id,
  l.user_id,
  l.book_id,
  l.borrower_name,
  l.loaned_at,
  l.due_at
FROM loans l
WHERE l.returned_at IS NULL;
