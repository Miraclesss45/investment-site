const SEARCH_TOKEN_PATTERN = /[\p{L}\p{N}@._+-]{2,}/gu;
const MAX_TOKENS_PER_MESSAGE = 120;
const MAX_QUERY_TERMS = 8;

export function getSupportSearchTokens(...values) {
  const tokens = new Set();
  for (const value of values) {
    const normalized = String(value || "").normalize("NFKC").toLowerCase();
    for (const match of normalized.matchAll(SEARCH_TOKEN_PATTERN)) {
      const token = match[0].replace(/^[._+-]+|[._+-]+$/g, "");
      if (token.length < 2) continue;
      tokens.add(token);
      const components = token.split(/[@._+-]+/u).filter((part) => part.length >= 3);
      for (const component of components) {
        tokens.add(component);
        if (/^[\p{L}\p{N}]+$/u.test(component)) {
          for (let length = 2; length < Math.min(component.length, 18); length += 1) {
            tokens.add(component.slice(0, length));
          }
        }
      }
      if (tokens.size >= MAX_TOKENS_PER_MESSAGE) return [...tokens];
    }
  }
  return [...tokens];
}

export function getSupportSearchQueryTerms(value) {
  return [...new Set(String(value || "").normalize("NFKC").toLowerCase().match(SEARCH_TOKEN_PATTERN) || [])]
    .map((term) => term.replace(/^[._+-]+|[._+-]+$/g, ""))
    .filter((term) => term.length >= 2)
    .slice(0, MAX_QUERY_TERMS);
}

export function conversationMatchesSupportSearch(data, queryTerms) {
  if (!queryTerms.length) return true;
  const indexed = new Set(Array.isArray(data.searchTokens) ? data.searchTokens : []);
  const legacyText = [data.userName, data.userEmail, data.userId, data.lastMessage]
    .filter(Boolean)
    .join(" ")
    .normalize("NFKC")
    .toLowerCase();
  return queryTerms.every((term) => indexed.has(term) || legacyText.includes(term));
}
