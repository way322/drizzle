import Link from "next/link";

export default function SecurityPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-28">
      <div className="rounded-[28px] border border-white/10 bg-black/20 p-6 md:p-8">
        <h1 className="mb-2 text-2xl font-bold text-white">Безопасность данных</h1>
        <p className="mb-6 text-sm text-gray-400">Последнее обновление: май 2026</p>

        <div className="space-y-4 text-sm leading-7 text-gray-300">
          <p>
            Мы не передаём ваши персональные данные третьим лицам для рекламы или
            продажи. Данные используются только для работы Kitsune.
          </p>
          <p>
            Пароли хранятся в зашифрованном виде (хеширование). Доступ к базе данных
            ограничен и защищён на уровне инфраструктуры.
          </p>
          <p>
            Соединение с сайтом защищено современными протоколами HTTPS там, где это
            поддерживается хостингом.
          </p>
          <p>
            Мы не публикуем ваш email и пароль в открытом доступе. Публичными остаются
            только те сведения, которые вы сами указываете в профиле (например, имя
            пользователя и аватар).
          </p>
          <p>
            При подозрении на несанкционированный доступ к аккаунту смените пароль и
            свяжитесь с администрацией проекта.
          </p>
        </div>

        <Link
          href="/auth/register"
          className="mt-8 inline-block text-sm text-purple-300 transition hover:text-white"
        >
          ← Вернуться к регистрации
        </Link>
      </div>
    </div>
  );
}
