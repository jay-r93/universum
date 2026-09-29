export type BehaviorProfile = 'sarcastic' | 'humorous' | 'strict' | 'creative';

export type AiModelConfig = {
  model: 'standard' | 'companion' | 'master';
  behaviorProfile: BehaviorProfile;
  memoryMode: 'persistent' | 'isolated';
  masterEnabled: boolean;
  writingSamples: string[];
};

const phoneticCorrections: Array<{ pattern: RegExp; replacement: string; context: string[] }> = [
  { pattern: /\bfahren\b/gi, replacement: 'Garen', context: ['kochen', 'topf', 'suppe', 'reis', 'wasser', 'brühe', 'bruehe', 'nudeln', 'ofen', 'backen', 'gericht'] },
  { pattern: /\bfahre\b/gi, replacement: 'Gare', context: ['kochen', 'topf', 'suppe', 'reis', 'wasser', 'brühe', 'bruehe', 'nudeln', 'ofen'] },
  { pattern: /\bweiß\b/gi, replacement: 'Fleisch', context: ['kochen', 'braten', 'suppe', 'gericht', 'sauce', 'soße'] },
  { pattern: /\bstrauch\b/gi, replacement: 'Straße', context: ['weg', 'fahren', 'auto', 'haus', 'dorf', 'richtung'] },
  { pattern: /\bnotiz\b/gi, replacement: 'notiert', context: ['habe', 'bin', 'schon', 'auch'] },
];

const moodMap: Array<{ triggers: string[]; mood: string; response: string }> = [
  { triggers: ['traurig', 'weinen', 'geweint', 'weine', 'tränen', 'traenen', 'kummer', 'leid', 'verlust', 'gestorben', 'eingeschläfert', 'einschlaefern'], mood: 'trauer', response: 'Das tut mir sehr leid. Ich bin hier – nimm dir alle Zeit, die du brauchst.' },
  { triggers: ['wütend', 'wuetend', 'ärger', 'aerger', 'sauer', 'frust', 'verrückt', 'verrueckt', 'hass'], mood: 'wut', response: 'Ich verstehe, dass dich das aufregt. Lass uns gemeinsam anschauen, was passiert ist.' },
  { triggers: ['froh', 'glücklich', 'gluecklich', 'freue', 'freut', 'toll', 'super', 'großartig', 'grossartig', 'perfekt'], mood: 'freude', response: 'Wie schön! Das freut mich echt mit dir.' },
  { triggers: ['müde', 'muede', 'erschöpft', 'erschoepft', 'kaputt', 'keine kraft', 'energielos'], mood: 'erschöpfung', response: 'Du hast viel geleistet. Vielleicht gönnst du dir heute einen ruhigen Moment?' },
  { triggers: ['sorge', 'sorger', 'ängstlich', 'aengstlich', 'angst', 'besorgt', 'besorgt', 'panik'], mood: 'sorge', response: 'Ich bin hier. Lass uns gemeinsam schauen, was dir Sorgen bereitet.' },
  { triggers: ['stolz', 'geschafft', 'erfolg', 'gewonnen', 'preis', 'sieger'], mood: 'stolz', response: 'Das ist großartig – du hast allen Grund, stolz zu sein!' },
];

export function correctTranscript(text: string): string {
  let corrected = text;
  for (const rule of phoneticCorrections) {
    if (rule.context.some((ctx) => corrected.toLowerCase().includes(ctx))) {
      corrected = corrected.replace(rule.pattern, rule.replacement);
    }
  }
  return corrected;
}

export function detectMood(text: string): { mood: string; intro: string } | null {
  const lower = text.toLowerCase();
  for (const entry of moodMap) {
    if (entry.triggers.some((trigger) => lower.includes(trigger))) {
      return { mood: entry.mood, intro: entry.response };
    }
  }
  return null;
}

const knowledgeBase: Array<{ keywords: string[]; answer: string; source: { title: string; url: string } }> = [
  {
    keywords: ['wasser', 'trinken', 'tag', 'liter', 'flüssigkeit'],
    answer: 'Ein erwachsener Mensch sollte täglich etwa 2 bis 3 Liter Flüssigkeit zu sich nehmen, am besten Wasser oder ungesüßte Getränke.',
    source: { title: 'DGE · Ernährungsrichtlinien', url: 'https://www.dge.de' },
  },
  {
    keywords: ['schlaf', 'stunden', 'schlafen', 'müde', 'ausgeruht'],
    answer: 'Erwachsene benötigen durchschnittlich 7 bis 9 Stunden Schlaf pro Nacht, um sich optimal zu erholen.',
    source: { title: 'National Sleep Foundation · Sleep Duration', url: 'https://www.sleepfoundation.org' },
  },
  {
    keywords: ['tomate', 'tomaten', 'gießen', 'giessen', 'wasser', 'bewässerung'],
    answer: 'Tomaten sollten regelmäßig und tief gegossen werden, idealerweise morgens. Staunässe vermeiden, aber den Ballon nicht austrocknen lassen. Blätter trocken halten, um Kraut- und Braunfäule vorzubeugen.',
    source: { title: 'Gartenakademie · Tomatenanbau', url: 'https://www.lwg.bayern.de/gartenakademie' },
  },
  {
    keywords: ['kompost', 'kompostieren', 'komposthaufen'],
    answer: 'Ein guter Kompost braucht ein Verhältnis von etwa 2:1 zwischen feuchtem Grünmaterial (Gras, Gemüseabfälle) und trockenem Braunmaterial (Laub, Stroh, Papier). Umschichten beschleunigt den Abbau.',
    source: { title: 'Bundesgütegemeinschaft Kompost · Ratgeber', url: 'https://www.bgkev.de' },
  },
];

const behaviorIntros: Record<BehaviorProfile, string> = {
  sarcastic: 'Gut, dass du fragst – denn das hätte dir auch selbst auffallen können:',
  humorous: 'Da muss ich schmunzeln. Aber ernsthaft:',
  strict: 'Sachlich geprüft, ohne Umschweife:',
  creative: 'Lass uns das mal von einer anderen Seite betrachten:',
};

function analyzeWritingStyle(samples: string[]): { avgSentenceLen: number; favoriteWords: string[]; tone: string } {
  const allText = samples.join(' ').trim();
  if (!allText) return { avgSentenceLen: 15, favoriteWords: [], tone: 'neutral' };
  const sentences = allText.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  const avgSentenceLen = Math.round(sentences.reduce((sum, s) => sum + s.trim().split(/\s+/).length, 0) / Math.max(sentences.length, 1));
  const wordFreq: Record<string, number> = {};
  const stopWords = new Set(['der', 'die', 'das', 'und', 'ist', 'in', 'zu', 'den', 'von', 'mit', 'für', 'auf', 'ein', 'eine', 'ich', 'dir', 'mir', 'nicht', 'auch', 'schon', 'noch', 'aber', 'oder', 'wenn']);
  for (const word of allText.toLowerCase().split(/\s+/)) {
    const clean = word.replace(/[^a-zäöüß]/g, '');
    if (clean.length > 3 && !stopWords.has(clean)) wordFreq[clean] = (wordFreq[clean] ?? 0) + 1;
  }
  const favoriteWords = Object.entries(wordFreq).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([w]) => w);
  const exclamations = (allText.match(/!/g) ?? []).length;
  const questions = (allText.match(/\?/g) ?? []).length;
  const tone = exclamations > questions ? 'expressiv' : questions > exclamations ? 'fragend' : 'ruhig';
  return { avgSentenceLen, favoriteWords, tone };
}

function applyMasterStyle(baseText: string, samples: string[]): string {
  const style = analyzeWritingStyle(samples);
  let styled = baseText;
  if (style.tone === 'expressiv' && !styled.endsWith('!')) styled = styled.replace(/[.]\s*$/, '!');
  if (style.favoriteWords.length > 0 && !styled.includes(style.favoriteWords[0])) {
    styled = styled.replace(/\.(\s*)$/, ` – ${style.favoriteWords[0]} ist dabei übrigens wichtig.$1`);
  }
  return styled;
}

export function generateChatResponse(
  userText: string,
  history: { role: string; text: string }[],
  userName = '',
  config: AiModelConfig = { model: 'standard', behaviorProfile: 'creative', memoryMode: 'persistent', masterEnabled: false, writingSamples: [] },
): { text: string; sources: { title: string; url: string }[] } {
  const sources: { title: string; url: string }[] = [];
  const mood = detectMood(userText);
  const lower = userText.toLowerCase();
  const urlInMessage = userText.match(/https?:\/\/[^\s]+|(?:www\.)?[a-z0-9.-]+\.[a-z]{2,}(?:\/[^\s]*)?/i);

  const parts: string[] = [];

  const useMemory = config.memoryMode === 'persistent';

  if (config.model === 'companion') {
    parts.push(behaviorIntros[config.behaviorProfile]);
  }

  if (config.model === 'master' && config.masterEnabled && mood) {
    parts.push(mood.intro);
  } else if (mood && config.model !== 'companion') {
    parts.push(mood.intro);
  }

  if (urlInMessage) {
    const url = urlInMessage[0].startsWith('http') ? urlInMessage[0] : `https://${urlInMessage[0]}`;
    parts.push(`Ich habe den Link (${url}) notiert. Eine automatische Analyse der Webseite ist aktuell nicht verfügbar.`);
    sources.push({ title: 'Verlinkte Quelle', url });
  }

  const match = knowledgeBase.find((entry) => entry.keywords.some((kw) => lower.includes(kw)));
  if (match) {
    if (config.model === 'master' && config.masterEnabled) {
      parts.push(applyMasterStyle(match.answer, config.writingSamples));
    } else {
      parts.push(match.answer);
    }
    sources.push(match.source);
  }

  if (parts.length <= (config.model === 'companion' ? 1 : 0)) {
    const isQuestion = userText.includes('?') || /^(was|wie|warum|wann|wo|welche|welcher|welches|kann|ist|sind|hat|haben)\b/i.test(userText);
    if (isQuestion) {
      if (config.model === 'companion' && config.behaviorProfile === 'sarcastic') {
        parts.push('Gute Frage – hättest du aber auch selbst googeln können. Aber gut, ich schaue es für dich nach.');
      } else if (config.model === 'companion' && config.behaviorProfile === 'strict') {
        parts.push('Frage erkannt. Faktenbasierter Abruf aus der Universum-Wissensbasis:');
      } else if (config.model === 'master' && config.masterEnabled) {
        parts.push(applyMasterStyle('Das schaue ich für dich nach – aus dem Kontext und der Fachdatenbank.', config.writingSamples));
      } else {
        parts.push('Das ist eine gute Frage. Ich schaue das für dich nach – hier ist, was ich aus dem Kontext und der Fachdatenbank finde.');
      }
      sources.push({ title: 'Universum-Wissensbasis', url: 'https://www.dge.de' });
    } else {
      const lastAssistant = [...history].reverse().find((m) => m.role === 'assistant');
      if (lastAssistant && useMemory) {
        if (config.model === 'companion' && config.behaviorProfile === 'humorous') {
          parts.push('Alles klar, ich notiere mir das. Brauchst du noch einen Witz dazu oder lieber Fakten?');
        } else if (config.model === 'master' && config.masterEnabled) {
          parts.push(applyMasterStyle('Verstehe – ich notiere mir das. Möchtest du, dass ich dazu weitere Details oder eine Faktenprüfung mache?', config.writingSamples));
        } else {
          parts.push('Verstehe – ich notiere mir das. Möchtest du, dass ich dazu weitere Details oder eine Faktenprüfung mache?');
        }
      } else if (!useMemory && lastAssistant) {
        parts.push('Notiert. Ohne Gedächtnis-Funktion behalte ich das nicht über diesen Chat hinaus.');
      } else {
        if (config.model === 'companion' && config.behaviorProfile === 'creative') {
          parts.push(`Hallo ${userName}! Ich bin dein Sparringspartner. Erzähl mir, was dich beschäftigt – wir können brainstormen, Fakten prüfen oder einfach nachdenken.`);
        } else if (config.model === 'master' && config.masterEnabled) {
          parts.push(applyMasterStyle(`Hallo ${userName}! Ich bin dein digitaler Zwilling. Ich kenne deinen Stil und deine Themen – frag mich einfach.`, config.writingSamples));
        } else {
          parts.push(`Hallo ${userName}! Ich bin dein Universum-Begleiter. Erzähl mir, was dich beschäftigt – ich denke mit und prüfe Fakten, wenn du möchtest.`);
        }
      }
    }
  }

  return { text: parts.join('\n\n'), sources };
}
