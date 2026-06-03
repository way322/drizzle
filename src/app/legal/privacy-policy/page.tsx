import Link from "next/link";

export default function PrivacyPolicyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-28">
      <div className="rounded-[28px] border border-white/10 bg-black/20 p-6 md:p-8">
        <h1 className="mb-2 text-2xl font-bold text-white">Политика пользователя</h1>
        <p className="mb-6 text-sm text-gray-400">Последнее обновление: май 2026</p>

        <div className="space-y-4 text-sm leading-7 text-gray-300">
          <p>
            Регистрируясь на Kitsune, вы предоставляете нам персональные данные: имя
            пользователя, адрес электронной почты и данные для входа в аккаунт.
          </p>
          <p>
            Мы обрабатываем эти данные для создания и обслуживания вашего аккаунта,
            авторизации, сохранения настроек профиля, истории просмотра и вашей
            активности на сайте (комментарии, оценки, статусы аниме).
          </p>
          <p>
            Обработка осуществляется на законных основаниях: исполнение пользовательского
            соглашения и ваше согласие, выраженное при регистрации.
          </p>
          <p>
            Вы можете запросить изменение или удаление данных, обратившись в поддержку
            через контакты, указанные на сайте.
          </p>
          <p>
            Продолжая пользоваться сервисом после регистрации, вы подтверждаете, что
            ознакомились с настоящей политикой.
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
