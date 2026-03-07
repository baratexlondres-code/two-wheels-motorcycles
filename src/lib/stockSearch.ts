export interface StockSearchableItem {
  name: string;
  sku?: string | null;
  category?: string | null;
}

const normalizeText = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

const compactText = (value: string) => normalizeText(value).replace(/[^a-z0-9]/g, "");

const tokenizeText = (value: string) =>
  normalizeText(value)
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter(Boolean);

const scoreStockItemMatch = (item: StockSearchableItem, query: string): number | null => {
  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery) return 0;

  const queryCompact = compactText(query);
  const queryTokens = tokenizeText(query);

  const name = normalizeText(item.name || "");
  const sku = normalizeText(item.sku || "");
  const category = normalizeText(item.category || "");
  const searchable = [name, sku, category].filter(Boolean).join(" ");
  const searchableCompact = compactText(searchable);

  if (sku && (sku === normalizedQuery || compactText(sku) === queryCompact)) return 0;
  if (queryCompact && sku && compactText(sku).startsWith(queryCompact)) return 1;
  if (queryCompact && searchableCompact.includes(queryCompact)) return 2;

  if (queryTokens.length > 0) {
    const tokenHits = queryTokens.filter((token) => searchable.includes(token)).length;
    if (tokenHits === queryTokens.length) return 3;
    if (tokenHits > 0) return 6 + (queryTokens.length - tokenHits);
  }

  if (searchable.includes(normalizedQuery)) return 5;

  return null;
};

export const rankStockItems = <T extends StockSearchableItem>(items: T[], query: string): T[] => {
  const scored = items
    .map((item) => ({ item, score: scoreStockItemMatch(item, query) }))
    .filter((entry): entry is { item: T; score: number } => entry.score !== null)
    .sort((a, b) => a.score - b.score || a.item.name.localeCompare(b.item.name));

  return scored.map((entry) => entry.item);
};
