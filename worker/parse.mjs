// Parses github.com/trending HTML (there is no official API). Regex, not a DOM:
// a plugin worker is plain Node. shortcut: breaks if GitHub changes the
// Box-row markup; test/parse.test.mjs fails first when that happens.
const text = (s) =>
  s
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
const num = (s) => Number(String(s ?? '0').replace(/,/g, '')) || 0

export function parseTrending(html) {
  return html
    .split('<article class="Box-row')
    .slice(1)
    .map((row) => {
      const fullName = row.match(/<h2[\s\S]*?href="\/([^"/]+\/[^"/]+)"/)?.[1]
      if (!fullName) return null
      const count = (path) =>
        num(text(row.match(new RegExp(`href="/${fullName}/${path}"[^>]*>([\\s\\S]*?)</a>`))?.[1] ?? '0'))
      return {
        fullName,
        url: `https://github.com/${fullName}`,
        description: text(row.match(/<p class="col-9[^"]*">([\s\S]*?)<\/p>/)?.[1] ?? ''),
        language: text(row.match(/itemprop="programmingLanguage"[^>]*>([\s\S]*?)<\/span>/)?.[1] ?? ''),
        stars: count('stargazers'),
        forks: count('forks'),
        starsInPeriod: num(text(row).match(/([\d,]+)\s+stars?\s+(?:today|this week|this month)/i)?.[1])
      }
    })
    .filter(Boolean)
}
