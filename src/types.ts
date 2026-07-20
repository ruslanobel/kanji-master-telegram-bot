export type KanjiExample = {
  word: string;
  reading: string;
  gloss: string;
};

export type KanjiEntry = {
  literal: string;
  codepoint: string;
  on: string[];
  kun: string[];
  meaningsRu: string[];
  meaningsEn: string[];
  examples: KanjiExample[];
  jlpt?: number;
  grade?: number;
  strokeCount?: number;
};

export type SearchIndex = {
  version: 1;
  generatedAt: string;
  entries: KanjiEntry[];
};
