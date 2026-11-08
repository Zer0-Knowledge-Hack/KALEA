/** Dependency-free string helpers, safe to import from islands without pulling in the dictionaries. */

/** Fills `{name}` placeholders. */
export const fill = (template: string, values: Record<string, string>): string =>
  template.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match);

/** Inline list without a serial comma: "a, b and c". */
export const joinList = (items: string[], and: string): string =>
  items.length < 2 ? (items[0] ?? "") : `${items.slice(0, -1).join(", ")} ${and} ${items[items.length - 1]}`;
