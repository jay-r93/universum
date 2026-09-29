export type FactFinding = { claim: string; correction: string; correctedText: string; matchedText: string; source: string; url?: string };

type RangeRule = {
  subject: string[];
  property: string[];
  unit: string[];
  min: number;
  max: number;
  source: string;
  url: string;
  context: string;
};

type MythRule = {
  triggers: string[];
  claim: string;
  correction: string;
  correctedText: string;
  matchedText: string;
  source: string;
  url: string;
};

const numberWords: Record<string, number> = {
  null: 0, eins: 1, eine: 1, ein: 1, zwei: 2, drei: 3, vier: 4, fünf: 5, fuenf: 5, füf: 5, sechs: 6, sieben: 7, acht: 8, neun: 9, zehn: 10, elf: 11, zwölf: 12, zwolf: 12, dreizehn: 13, vierzehn: 14, fünfzehn: 15, fuenfzehn: 15, zwanzig: 20, dreissig: 30, dreißig: 30, vierzig: 40, fünfzig: 50, fuenfzig: 50, sechzig: 60, siebzig: 70, achtzig: 80, neunzig: 90, hundert: 100, tausend: 1000,
};

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[.,!?;:()"„"«»]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseNumber(token: string): number | null {
  const direct = parseInt(token, 10);
  if (!isNaN(direct)) return direct;
  const cleaned = token.replace(/[^a-z]/g, '');
  if (numberWords[cleaned] !== undefined) return numberWords[cleaned];
  const match = cleaned.match(/(\w+)und(\w+)/);
  if (match) {
    const ones = numberWords[match[1]];
    const tens = numberWords[match[2]];
    if (ones !== undefined && tens !== undefined) return tens + ones;
  }
  return null;
}

function levenshtein(a: string, b: string): number {
  const matrix: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      matrix[i][j] = a[i - 1] === b[j - 1]
        ? matrix[i - 1][j - 1]
        : Math.min(matrix[i - 1][j], matrix[i][j - 1], matrix[i - 1][j - 1]) + 1;
    }
  }
  return matrix[a.length][b.length];
}

function fuzzyIncludes(text: string, trigger: string, tolerance = 1): boolean {
  if (text.includes(trigger)) return true;
  const words = text.split(' ');
  const triggerWords = trigger.split(' ');
  return triggerWords.every((tw) => words.some((w) => levenshtein(w, tw) <= tolerance));
}

const myths: MythRule[] = [
  { triggers: ['acht gläser', '8 gläser', 'acht glaser', '2 liter wasser', '3 liter wasser'], claim: '„Man muss täglich 8 Gläser Wasser trinken."', correction: 'Es gibt keine feste Regel. Etwa 2 bis 3 Liter Flüssigkeit pro Tag sind empfohlen, auch aus Tee und fester Nahrung. Der Bedarf hängt von Aktivität und Klima ab.', correctedText: '2 bis 3 Liter je nach Bedarf', matchedText: '', source: 'DGE · Ernährungsrichtlinien', url: 'https://www.dge.de' },
  { triggers: ['nur süßwasser', 'nicht salz', 'salz verboten'], claim: '„Salz ist immer ungesund."', correction: 'Natrium ist essenziell. Die DGE empfiehlt maximal 6 g Salz pro Tag – zu viel ist schädlich, zu wenig ebenfalls problematisch.', correctedText: 'maximal 6 g pro Tag', matchedText: '', source: 'DGE · Referenzwerte Natrium', url: 'https://www.dge.de/wissenschaft/referenzwerte/' },
  { triggers: ['nur 5 stunden', '5 stunden schlaf', 'fünf stunden schlaf'], claim: '„5 Stunden Schlaf reichen aus."', correction: 'Erwachsene benötigen 7 bis 9 Stunden Schlaf. Chronisch zu wenig Schlaf erhöht das Risiko für Herz-Kreislauf- und Stoffwechsel-Erkrankungen.', correctedText: '7 bis 9 Stunden', matchedText: '', source: 'National Sleep Foundation', url: 'https://www.sleepfoundation.org' },
  { triggers: ['egal', 'kalorien', 'nur kalorien', 'nur menge'], claim: '„Kalorien sind alle gleich."', correction: 'Nicht nur die Menge, auch die Qualität zählt. 200 kcal aus Gemüse sättigen länger und liefern mehr Nährstoffe als 200 kcal aus Zucker.', correctedText: 'Qualität der Kalorien zählt', matchedText: '', source: 'DGE · Vollwertige Ernährung', url: 'https://www.dge.de' },
];

const rangeRules: RangeRule[] = [
  { subject: ['wasser', 'trinken', 'flüssigkeit', 'fluessigkeit'], property: ['liter', 'trinken', 'flüssigkeit'], unit: ['liter', 'l'], min: 0, max: 10, source: 'DGE · Ernährungsrichtlinien', url: 'https://www.dge.de', context: 'Tagesflüssigkeit' },
  { subject: ['schlaf', 'stunden', 'nächtlich'], property: ['stunden', 'schlafen', 'schläft'], unit: ['stunden', 'h'], min: 3, max: 14, source: 'National Sleep Foundation', url: 'https://www.sleepfoundation.org', context: 'Schlafdauer' },
];

function checkPlausibility(normalized: string): FactFinding[] {
  const findings: FactFinding[] = [];
  const tokens = normalized.split(' ');
  for (const rule of rangeRules) {
    const hasSubject = rule.subject.some((s) => normalized.includes(s));
    if (!hasSubject) continue;
    const hasProperty = rule.property.some((p) => normalized.includes(p));
    if (!hasProperty) continue;
    for (let i = 0; i < tokens.length; i++) {
      const num = parseNumber(tokens[i]);
      if (num === null) continue;
      const nextToken = tokens[i + 1] ?? '';
      const hasUnit = rule.unit.some((u) => nextToken.includes(u) || tokens.slice(Math.max(0, i - 1), i + 2).join(' ').includes(u));
      if (!hasUnit && rule.unit[0] !== 'kg') continue;
      if (num < rule.min || num > rule.max) {
        findings.push({
          claim: `${rule.context}: ${num} ${rule.unit[0]}`,
          correction: `Der Wert ${num} liegt außerhalb des plausiblen Bereichs (${rule.min}–${rule.max} ${rule.unit[0]}).`,
          correctedText: `${rule.min}–${rule.max}`,
          matchedText: `${num} ${rule.unit[0]}`,
          source: rule.source,
          url: rule.url,
        });
      }
    }
  }
  return findings;
}

function findMatchedSnippet(text: string, triggers: string[]): string {
  const lower = text.toLowerCase();
  for (const trigger of triggers) {
    const idx = lower.indexOf(trigger);
    if (idx >= 0) {
      const start = Math.max(0, idx);
      const end = Math.min(text.length, idx + trigger.length);
      return text.slice(start, end);
    }
  }
  return triggers[0] ?? '';
}

export function checkFacts(text: string): FactFinding[] {
  if (!text.trim()) return [];
  const normalized = normalize(text);
  const findings: FactFinding[] = [];
  const seen = new Set<string>();

  for (const myth of myths) {
    const matched = myth.triggers.some((trigger) => fuzzyIncludes(normalized, trigger, 1));
    if (matched) {
      const key = myth.claim;
      if (!seen.has(key)) {
        seen.add(key);
        const matchedText = myth.matchedText || findMatchedSnippet(text, myth.triggers);
        findings.push({ claim: myth.claim, correction: myth.correction, correctedText: myth.correctedText, matchedText, source: myth.source, url: myth.url });
      }
    }
  }

  for (const finding of checkPlausibility(normalized)) {
    if (!seen.has(finding.claim)) {
      seen.add(finding.claim);
      findings.push(finding);
    }
  }

  return findings;
}
