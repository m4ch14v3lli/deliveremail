export interface ParsedBulkItem {
  domain: string;
  phone?: string;
}

export function parseBulkInputLines(text: string): ParsedBulkItem[] {
  if (!text || !text.trim()) return [];
  const lines = text.split(/\r?\n/);
  const items: ParsedBulkItem[] = [];
  const seenDomains = new Set<string>();

  const domainRegex = /(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}/i;
  // Matches phone numbers like +1 469-591-7663, (469) 591-7663, 469-591-7663, +44 20 7946 0919, etc.
  const phoneRegex = /(?:\+?\d{1,3}[-.\s]?)?(?:\(?\d{2,4}\)?[-.\s]?)?\d{3,4}[-.\s]?\d{3,5}/;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    const domainMatch = line.match(domainRegex);
    if (!domainMatch) continue;

    const domain = domainMatch[0].toLowerCase().trim();
    if (seenDomains.has(domain)) continue;

    let phone: string | undefined = undefined;

    // Check if line contains a dash/separator like domain - phone
    const sepSplit = line.split(/\s*[-–—|;,]\s*/);
    if (sepSplit.length > 1) {
      for (const piece of sepSplit) {
        const pMatch = piece.match(phoneRegex);
        if (pMatch && !piece.includes(domainMatch[0])) {
          phone = piece.trim();
          break;
        }
      }
    }

    if (!phone) {
      // Try searching whole line minus the domain
      const remainingLine = line.replace(domainMatch[0], '').trim();
      const pMatch = remainingLine.match(phoneRegex);
      if (pMatch && pMatch[0].replace(/\D/g, '').length >= 7) {
        phone = pMatch[0].trim();
      }
    }

    seenDomains.add(domain);
    items.push({ domain, phone: phone || undefined });
  }

  return items;
}
