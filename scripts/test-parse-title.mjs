import { parseAnimeTitle } from "../src/lib/animeTitle.ts";

const titles = [
  "Клинок, рассекающий демонов — Сезон 1",
  "Монолог фармацевта — Сезон 1",
  "Клинок, рассекающий демонов - Сезон 1",
  "Атака титанов Сезон 2",
];

for (const t of titles) {
  console.log(JSON.stringify({ title: t, parsed: parseAnimeTitle(t) }));
}
