export function extractDomain(input: string): string {
  let cleaned = input.trim().toLowerCase();
  if (cleaned.includes('@')) {
    cleaned = cleaned.split('@').pop() || cleaned;
  }
  cleaned = cleaned.replace(/^https?:\/\//, '').split('/')[0];
  return cleaned;
}
