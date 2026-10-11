const PICKS = 'mnml-picks:';

export function picksOf(name: string): string[] {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(`${PICKS}${name}`) ?? '[]');
    return Array.isArray(raw) ? raw.filter((slot): slot is string => typeof slot === 'string') : [];
  } catch {
    return [];
  }
}

export function keepPicks(name: string, picks: ReadonlySet<string>): boolean {
  try {
    localStorage.setItem(`${PICKS}${name}`, JSON.stringify([...picks]));
    return true;
  } catch {
    return false;
  }
}
