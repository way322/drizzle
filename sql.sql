BEGIN;

-- Клинок, рассекающий демонов — Сезон 1
WITH inserted AS (
  INSERT INTO anime (
    title, description, release_year, status, external_url
  )
  VALUES (
    'Клинок, рассекающий демонов — Сезон 1',
    'Эпоха Тайсё. Тандзиро Камадо возвращается домой и находит семью убитой; его сестра Нэдзуко превращена в демона. Он отправляется в опасный путь, чтобы найти убийцу и вернуть сестре человечность.',
    2019,
    'completed',
    'https://tb2ah.anilib.top/public/iframe.php?id=8325'
  )
  RETURNING id
)
INSERT INTO anime_images (anime_id, image_url, is_poster)
SELECT inserted.id,
       'https://shiki.one/uploads/poster/animes/38000/main_alt-74d46d0a9d743c82998ce5769d0b88fa.jpeg',
       TRUE
FROM inserted;

-- Магическая битва — Сезон 1
WITH inserted AS (
  INSERT INTO anime (
    title, description, release_year, status, external_url
  )
  VALUES (
    'Магическая битва — Сезон 1',
    'В мире, где проклятия рождаются из человеческих негативных эмоций, школьник Юдзи Итадори оказывается втянут в мир магов после того, как становится носителем проклятого артефакта — пальца Сукуны.',
    2020,
    'completed',
    'https://tb2hl.anilib.top/public/iframe.php?id=8789'
  )
  RETURNING id
)
INSERT INTO anime_images (anime_id, image_url, is_poster)
SELECT inserted.id,
       'https://shiki.one/uploads/poster/animes/40748/main_alt-8253e205d8977a1c9bcb825a88284d1b.jpeg',
       TRUE
FROM inserted;

-- Монолог фармацевта — Сезон 1
WITH inserted AS (
  INSERT INTO anime (
    title, description, release_year, status, external_url
  )
  VALUES (
    'Монолог фармацевта — Сезон 1',
    '17-летнюю Маомао похищают и продают служанкой в императорский дворец. Когда дети императора заболевают, она применяет знания фармацевта и втягивается в придворные тайны и расследования.',
    2023,
    'completed',
    'https://tb2u7.anilib.top/public/iframe.php?id=9555'
  )
  RETURNING id
)
INSERT INTO anime_images (anime_id, image_url, is_poster)
SELECT inserted.id,
       'https://shiki.one/uploads/poster/animes/54492/main_alt-248d6761001179e877631ed2d8f7b65d.jpeg',
       TRUE
FROM inserted;

-- Бездомный бог — Сезон 1
WITH inserted AS (
  INSERT INTO anime (
    title, description, release_year, status, external_url
  )
  VALUES (
    'Бездомный бог — Сезон 1',
    'Бродячий бог Ято берётся за любые просьбы за 5 иен, мечтая о собственном храме. После несчастного случая школьница Хиёри начинает «выходить» из тела и просит Ято вернуть её в норму.',
    2014,
    'completed',
    'https://tb7p.anilib.top/public/iframe.php?id=485'
  )
  RETURNING id
)
INSERT INTO anime_images (anime_id, image_url, is_poster)
SELECT inserted.id,
       'https://shiki.one/uploads/poster/animes/20507/main_alt-e69cbab0d3683be27320f3ab6c20876c.jpeg',
       TRUE
FROM inserted;

-- Доктор Стоун — Сезон 1
WITH inserted AS (
  INSERT INTO anime (
    title, description, release_year, status, external_url
  )
  VALUES (
    'Доктор Стоун — Сезон 1',
    'Таинственная вспышка превращает всё человечество в камень. Спустя тысячи лет Тайдзю и гениальный Сэнку пробуждаются и решают возродить цивилизацию силой науки.',
    2019,
    'completed',
    'https://tb2bs.anilib.top/public/iframe.php?id=8398'
  )
  RETURNING id
)
INSERT INTO anime_images (anime_id, image_url, is_poster)
SELECT inserted.id,
       'https://shikimori.one/uploads/poster/animes/38691/main_alt-30181f0aa877d878e5d28ef93d7b3303.jpeg',
       TRUE
FROM inserted;

-- Сага о Винланде — Сезон 1
WITH inserted AS (
  INSERT INTO anime (
    title, description, release_year, status, external_url
  )
  VALUES (
    'Сага о Винланде — Сезон 1',
    '1002 год. Юный Торфинн живёт в Исландии и мечтает о приключениях, но война и столкновение с викингами переворачивают его жизнь и втягивают в жестокий мир сражений и мести.',
    2019,
    'completed',
    'https://tb2bs.anilib.top/public/iframe.php?id=8424'
  )
  RETURNING id
)
INSERT INTO anime_images (anime_id, image_url, is_poster)
SELECT inserted.id,
       'https://shiki.one/uploads/poster/animes/37521/main_alt-45c2412a70f690bdc82957fce96f63d0.jpeg',
       TRUE
FROM inserted;

COMMIT;




UPDATE users
SET role = 'admin'
WHERE email = 'iliyamalihin@yandex.ru';


BEGIN;

INSERT INTO genres (name) VALUES
('Экшен'),
('Приключения'),
('Комедия'),
('Драма'),
('Фэнтези'),
('Фантастика'),
('Мистика'),
('Ужасы'),
('Триллер'),
('Романтика'),
('Повседневность'),
('Школа'),
('Сёнэн'),
('Сёдзё'),
('Сэйнэн'),
('Дзёсэй'),
('Исекай'),
('Меха'),
('Спорт'),
('Музыка'),
('Идолы'),
('Историческое'),
('Военное'),
('Психологическое'),
('Детектив'),
('Сверхъестественное'),
('Вампиры'),
('Демоны'),
('Магия'),
('Боевые искусства'),
('Самураи'),
('Ниндзя'),
('Полиция'),
('Криминал'),
('Постапокалипсис'),
('Киберпанк'),
('Космос'),
('Пародия'),
('Сатира'),
('Игры'),
('Этти'),
('Сёнэн-ай'),
('Сёдзё-ай'),
('Трагедия'),
('Семейное'),
('Детское'),
('Суперсилы'),
('Выживание'),
('Работа'),
('Кулинария'),
('Медицина'),
('Перерождение'),
('Виртуальная реальность'),
('Исследования'),
('Философия'),
('Антиутопия'),
('Технофэнтези'),
('Тёмное фэнтези'),
('Готика'),
('Монстры'),
('Зомби'),
('Сказка'),
('Авангард'),
('Экспериментальное'),
('Отомэ'),
('Кооперативные игры'),
('Карточные игры'),
('Гонки')
ON CONFLICT (name) DO NOTHING;

-- Администратор: iliyamalihin@yandex.ru
-- Если пользователя ещё нет — создаётся с паролем KitsuneAdmin!2026 (смени после входа).
-- Если запись с этой почтой уже есть — только выставляется role = admin (пароль не затирается).
INSERT INTO users (username, email, password_hash, provider, role)
VALUES (
  'iliya',
  'iliyamalihin@yandex.ru',
  '$2b$10$vfmdBzuwz.lSpOIaBUxk1ew01gQFOQvVoDyUtEEs9SVsOeJ6ujJm6',
  'local',
  'admin'
)
ON CONFLICT (email) DO UPDATE SET
  role = 'admin';

COMMIT;


