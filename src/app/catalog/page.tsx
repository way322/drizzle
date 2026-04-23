// src/app/catalog/page.tsx
import { db } from "../../server/db";
import { genres as genresTable } from "../../server/db/schema";
import { asc } from "drizzle-orm";
import CatalogClient from "./CatalogClient";

type PageProps = {
  searchParams: Promise<{
    status?: string;
    sort?: string;
    ratingOrder?: string;
    yearOrder?: string;
    yearFrom?: string;
    yearTo?: string;
    genres?: string;
  }>;
};

function parseGenresParam(raw?: string): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, 20);
}

export default async function CatalogPage({ searchParams }: PageProps) {

  const sp = await searchParams;

  const status = (sp.status ?? "all") as any;
  const sort = (sp.sort ?? "new") as any;
  const ratingOrder = (sp.ratingOrder ?? "desc") as any;
  const yearOrder = (sp.yearOrder ?? "desc") as any;

  const yearFrom = (sp.yearFrom ?? "").trim();
  const yearTo = (sp.yearTo ?? "").trim();
  const selectedGenres = parseGenresParam(sp.genres);

  const allGenresRows = await db
    .select({ name: genresTable.name })
    .from(genresTable)
    .orderBy(asc(genresTable.name));

  const allGenres = allGenresRows.map((x) => x.name);

  return (
    <CatalogClient
      initialFilters={{
        status,
        sort,
        ratingOrder,
        yearOrder,
        yearFrom,
        yearTo,
        genres: selectedGenres,
      }}
      allGenres={allGenres}
      initialLimit={20}
    />
  );
}