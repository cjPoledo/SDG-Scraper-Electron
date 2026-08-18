-- Migration 002: Add 'taxonomy' as a valid sdg_tags.confidence value
-- Some WordPress sites expose a dedicated, editorially-curated SDG taxonomy
-- (e.g. a site with an "sdg" taxonomy registered, distinct from post_tag).
-- The tagging engine treats that as higher-confidence than hashtag/keyword
-- matches, since a human explicitly assigned it. Not every site has this
-- taxonomy — posts from sites without it simply produce no 'taxonomy' rows.
--
-- SQLite has no ALTER TABLE ... ALTER CHECK, so the table is rebuilt.

CREATE TABLE sdg_tags_new (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id    TEXT    NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  sdg_number INTEGER NOT NULL CHECK (sdg_number BETWEEN 1 AND 17),
  confidence TEXT    NOT NULL CHECK (confidence IN ('taxonomy', 'hashtag', 'keyword')),
  matched_on TEXT,
  UNIQUE (post_id, sdg_number)
);

INSERT INTO sdg_tags_new (id, post_id, sdg_number, confidence, matched_on)
  SELECT id, post_id, sdg_number, confidence, matched_on FROM sdg_tags;

DROP TABLE sdg_tags;
ALTER TABLE sdg_tags_new RENAME TO sdg_tags;

CREATE INDEX IF NOT EXISTS idx_sdg_tags_sdg  ON sdg_tags (sdg_number);
CREATE INDEX IF NOT EXISTS idx_sdg_tags_post ON sdg_tags (post_id);
