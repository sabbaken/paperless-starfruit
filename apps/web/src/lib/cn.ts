/** Join truthy class names. Zero-dependency; later classes win at the DOM level. */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}
