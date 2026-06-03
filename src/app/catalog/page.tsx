// src/app/catalog/page.tsx
import { db } from "../../server/db";
import { genres as genresTable } from "../../server/db/schema";
import { asc } from "drizzle-orm";
import { filterVisibleGenreNames } from "@/lib/genreFilters";
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

const STATUS_VALUES = ["all", "ongoing", "completed", "hiatus"] as const;
const SORT_VALUES = ["new", "rating", "year"] as const;
const ORDER_VALUES = ["asc", "desc"] as const;

type StatusKey = (typeof STATUS_VALUES)[number];
type SortKey = (typeof SORT_VALUES)[number];
type OrderKey = (typeof ORDER_VALUES)[number];

function parseEnum<T extends readonly string[]>(
  value: string | undefined,
  allowed: T,
  fallback: T[number]
): T[number] {
  return value && (allowed as readonly string[]).includes(value) ? value : fallback;
}

export default async function CatalogPage({ searchParams }: PageProps) {

  const sp = await searchParams;

  const status: StatusKey = parseEnum(sp.status, STATUS_VALUES, "all");
  const sort: SortKey = parseEnum(sp.sort, SORT_VALUES, "new");
  const ratingOrder: OrderKey = parseEnum(sp.ratingOrder, ORDER_VALUES, "desc");
  const yearOrder: OrderKey = parseEnum(sp.yearOrder, ORDER_VALUES, "desc");

  const yearFrom = (sp.yearFrom ?? "").trim();
  const yearTo = (sp.yearTo ?? "").trim();
  const selectedGenres = parseGenresParam(sp.genres);

  const allGenresRows = await db
    .select({ name: genresTable.name })
    .from(genresTable)
    .orderBy(asc(genresTable.name));

  const allGenres = filterVisibleGenreNames(allGenresRows.map((x) => x.name));

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