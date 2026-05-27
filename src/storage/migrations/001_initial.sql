-- Migration 001: Initial schema
-- Tables: pages, posts, sdg_tags, scrape_jobs

-- ── Pages ───────────────────────────────────────────────────────────────────
-- Each row represents a social media page or website that the user wants to
-- scrape. A "page" is the unit of work for the scraper (e.g. a Facebook Page
-- or a WordPress site root URL).

CREATE TABLE IF NOT EXISTS pages (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  platform   TEXT    NOT NULL,              -- 'facebook' | 'wordpress'
  page_id    TEXT    NOT NULL,              -- platform-specific identifier
                                            -- (FB: numeric page id, WP: domain)
  url        TEXT    NOT NULL,
  label      TEXT,                          -- human-readable display name
  created_at TEXT    DEFAULT (datetime('now')),
  UNIQUE (platform, page_id)
);

-- ── Posts ────────────────────────────────────────────────────────────────────
-- Normalised post schema — platform-agnostic. All adapters write to this table.

CREATE TABLE IF NOT EXISTS posts (
  id         TEXT    PRIMARY KEY,           -- '{platform}:{pageId}:{nativeId}'
  platform   TEXT    NOT NULL,
  page_id    TEXT    NOT NULL,
  text       TEXT,                          -- cleaned plain-text body
  hashtags   TEXT,                          -- JSON array of hashtag strings
  date       TEXT,                          -- ISO-8601 datetime string
  url        TEXT,
  author     TEXT,
  raw_html   TEXT,                          -- original HTML (may be large)
  scraped_at TEXT    DEFAULT (datetime('now'))
);

-- ── SDG Tags ─────────────────────────────────────────────────────────────────
-- One row per (post, SDG) pair. A post can be tagged with multiple SDGs.
-- The confidence column records whether the match came from a hashtag
-- (higher confidence) or a keyword (lower confidence).

CREATE TABLE IF NOT EXISTS sdg_tags (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id    TEXT    NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  sdg_number INTEGER NOT NULL CHECK (sdg_number BETWEEN 1 AND 17),
  confidence TEXT    NOT NULL CHECK (confidence IN ('hashtag', 'keyword')),
  matched_on TEXT,                          -- the exact hashtag or keyword matched
  UNIQUE (post_id, sdg_number)
);

-- ── Scrape jobs ───────────────────────────────────────────────────────────────
-- Tracks the lifecycle of each scrape run. One job = one page scrape attempt.

CREATE TABLE IF NOT EXISTS scrape_jobs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  page_id     INTEGER NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  status      TEXT    NOT NULL DEFAULT 'pending'
              CHECK (status IN ('pending', 'running', 'done', 'error')),
  posts_found INTEGER DEFAULT 0,
  started_at  TEXT,
  finished_at TEXT,
  error       TEXT                          -- populated when status = 'error'
);

-- ── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_posts_platform  ON posts (platform);
CREATE INDEX IF NOT EXISTS idx_posts_page_id   ON posts (page_id);
CREATE INDEX IF NOT EXISTS idx_posts_date      ON posts (date DESC);
CREATE INDEX IF NOT EXISTS idx_sdg_tags_sdg    ON sdg_tags (sdg_number);
CREATE INDEX IF NOT EXISTS idx_sdg_tags_post   ON sdg_tags (post_id);
CREATE INDEX IF NOT EXISTS idx_jobs_page       ON scrape_jobs (page_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status     ON scrape_jobs (status);
