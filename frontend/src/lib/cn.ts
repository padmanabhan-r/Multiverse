/**
 * Tiny class-merge helper. Filters falsy values and joins with a single space.
 */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
