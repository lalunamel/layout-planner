const NUMBER = String.raw`(\d+(?:\.\d+)?)`;
const FEET_INCHES = new RegExp(String.raw`^(?:${NUMBER}\s*')?\s*-?\s*(?:${NUMBER}\s*")?$`);
const BARE_NUMBER = new RegExp(String.raw`^${NUMBER}$`);

/** Parse a length the way floor-plan listings print it (8'6", 8' 6",
 * 8'-6", 8ft 6in, 8.5 …) into feet. A bare number means feet. Returns
 * null for empty, malformed, or non-positive input. */
export function parseFeetInches(input: string): number | null {
  const normalized = input
    .trim()
    .toLowerCase()
    .replace(/[’′]/g, "'")
    .replace(/[”″]/g, '"')
    .replace(/\s*(?:feet|foot|ft)\b/g, "'")
    .replace(/\s*(?:inches|inch|in)\b/g, '"');
  if (!normalized) return null;

  let feet: number;
  const bare = BARE_NUMBER.exec(normalized);
  if (bare) {
    feet = Number(bare[1]);
  } else {
    const match = FEET_INCHES.exec(normalized);
    if (!match || (match[1] === undefined && match[2] === undefined)) return null;
    feet = Number(match[1] ?? 0) + Number(match[2] ?? 0) / 12;
  }
  return Number.isFinite(feet) && feet > 0 ? feet : null;
}
