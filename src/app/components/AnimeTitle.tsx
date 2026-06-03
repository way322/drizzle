import { parseAnimeTitle } from "@/lib/animeTitle";

type AnimeTitleProps = {
  title: string;
  as?: "h1" | "h2" | "h3" | "div";
  variant?: "page" | "card";
  className?: string;
};

export default function AnimeTitle({
  title,
  as: Tag = "div",
  variant = "card",
  className = "",
}: AnimeTitleProps) {
  const { main, meta } = parseAnimeTitle(title);

  if (variant === "page") {
    return (
      <Tag className={className}>
        <span className="block break-words">{main}</span>
        {meta ? (
          <span className="mt-2 block whitespace-nowrap text-xl font-semibold tracking-tight text-purple-200/95 sm:text-2xl">
            {meta}
          </span>
        ) : null}
      </Tag>
    );
  }

  return (
    <Tag className={className}>
      <span className="block break-words leading-snug">{main}</span>
      {meta ? (
        <span className="mt-1 block whitespace-nowrap text-sm font-medium leading-snug text-purple-200/90">
          {meta}
        </span>
      ) : null}
    </Tag>
  );
}
