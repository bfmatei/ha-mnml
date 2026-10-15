export function pick<T>(
  tables: ReadonlyMap<string, T>,
  language: string | undefined,
  english: T,
): T {
  if (language === undefined) {
    return english;
  }
  return tables.get(language) ?? tables.get(language.split('-')[0] ?? '') ?? english;
}
