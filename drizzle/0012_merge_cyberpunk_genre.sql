-- Слить дубликат жанра «киберпанк» в каноничный «Киберпанк»
DO $$
DECLARE
  dup_id integer;
  canon_id integer;
BEGIN
  SELECT id INTO dup_id FROM genres WHERE name = 'киберпанк';
  SELECT id INTO canon_id FROM genres WHERE name = 'Киберпанк';

  IF dup_id IS NOT NULL AND canon_id IS NOT NULL THEN
    INSERT INTO anime_genres (anime_id, genre_id)
    SELECT ag.anime_id, canon_id
    FROM anime_genres ag
    WHERE ag.genre_id = dup_id
    ON CONFLICT DO NOTHING;

    DELETE FROM anime_genres WHERE genre_id = dup_id;
    DELETE FROM genres WHERE id = dup_id;
  ELSIF dup_id IS NOT NULL AND canon_id IS NULL THEN
    UPDATE genres SET name = 'Киберпанк' WHERE id = dup_id;
  END IF;
END $$;
