import type { Bike, Sticker } from "../types/database";

// A sticker as the Adesivos tab shows it: where it stands today and, when it
// is on a bike, whose bike it is.
export type StickerState = "reserve" | "active" | "inactive";

export type BikeSummary = Pick<
  Bike,
  "id" | "tag_number" | "owner_name" | "unit_block" | "brand_model" | "status"
>;

export interface StickerRow {
  tag_number: string;
  state: StickerState;
  bike: BikeSummary | null;
}

// Joins the sticker pool with the bikes. A bike that got its tag number before
// the sticker pool existed has no stickers row, so it is added from the bikes
// table: its printed sticker can still be damaged and need a reprint.
export function buildStickerRows(stickers: Sticker[], bikes: BikeSummary[]): StickerRow[] {
  const bikeById = new Map(bikes.map((bike) => [bike.id, bike]));
  const rows = new Map<string, StickerRow>();

  for (const sticker of stickers) {
    const bike = sticker.bike_id ? bikeById.get(sticker.bike_id) ?? null : null;
    rows.set(sticker.tag_number, {
      tag_number: sticker.tag_number,
      state: stateFor(sticker.status === "available" ? null : bike, sticker.status),
      bike,
    });
  }

  for (const bike of bikes) {
    const tag = bike.tag_number;
    if (!tag || rows.has(tag)) continue;
    rows.set(tag, { tag_number: tag, state: stateFor(bike, "assigned"), bike });
  }

  return [...rows.values()].sort((a, b) => tagValue(a.tag_number) - tagValue(b.tag_number));
}

function stateFor(bike: BikeSummary | null, status: Sticker["status"]): StickerState {
  if (status === "available") return "reserve";
  return bike && bike.status === "inactive" ? "inactive" : "active";
}

function tagValue(tag: string): number {
  const n = Number.parseInt(tag, 10);
  return Number.isNaN(n) ? Number.MAX_SAFE_INTEGER : n;
}

// The longest range one entry may name, so a typo like "1-99999" cannot
// freeze the page.
export const MAX_RANGE = 500;

export interface ParsedTags {
  numbers: number[];
  invalid: string[];
}

// Reads what the admin typed in "Selecionar números": numbers and ranges split
// by commas, semicolons or spaces, e.g. "002, 3; 010-015". Leading zeros do
// not matter ("2" and "002" are the same sticker).
export function parseTagList(input: string): ParsedTags {
  const numbers = new Set<number>();
  const invalid: string[] = [];

  for (const part of input.split(/[\s,;]+/).filter(Boolean)) {
    const range = part.match(/^(\d+)-(\d+)$/);
    if (range) {
      const start = Number(range[1]);
      const end = Number(range[2]);
      if (end < start || end - start + 1 > MAX_RANGE) {
        invalid.push(part);
        continue;
      }
      for (let n = start; n <= end; n++) numbers.add(n);
    } else if (/^\d+$/.test(part)) {
      numbers.add(Number(part));
    } else {
      invalid.push(part);
    }
  }

  return { numbers: [...numbers].sort((a, b) => a - b), invalid };
}

// Matches parsed numbers to existing tags. Numbers with no sticker come back
// in `missing`, padded the way tags are written, so the admin sees "099".
export function matchTags(numbers: number[], rows: StickerRow[]): { tags: string[]; missing: string[] } {
  const byValue = new Map(rows.map((row) => [tagValue(row.tag_number), row.tag_number]));
  const tags: string[] = [];
  const missing: string[] = [];
  for (const n of numbers) {
    const tag = byValue.get(n);
    if (tag) tags.push(tag);
    else missing.push(String(n).padStart(3, "0"));
  }
  return { tags, missing };
}
