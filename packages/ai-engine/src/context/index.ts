// Système de contexte simplifié : seuls les composants prouvés efficaces

export * from './types';
export * from './simple-minifier';

// Ré-export explicite : `semantic-chunker` exporte aussi `estimateTokens`, tout
// comme `prompts/compression`. Les deux sont la même approximation (~4 chars par
// token) et `src/index.ts` réunit les deux barrels, donc un `export *` créerait
// une ambiguïté (TS2308). La version de `prompts` reste l'export public ; celle
// du chunker reste accessible via son module direct.
export { SemanticChunker, detectLanguage } from './chunking/semantic-chunker';
