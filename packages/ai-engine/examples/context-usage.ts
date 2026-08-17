// Exemple d'utilisation du gestionnaire de contexte

import { ContextManager } from '@cortex-ide/ai-engine';

// Exemple 1: Configuration de base
const manager = new ContextManager({
  defaultStrategy: 'auto',
  enablePrediction: true,
  enableCache: true,
  enableDifferential: true,
  enableCompression: true,
  maxTokens: 100000,
});

// Exemple 2: Chunking d'un fichier
async function chunkSourceFile() {
  const sourceCode = `
export class UserService {
  constructor(private db: Database) {}
  
  async getUser(id: string): Promise<User> {
    return this.db.findUser(id);
  }
  
  async createUser(data: UserData): Promise<User> {
    return this.db.insertUser(data);
  }
}

export class AuthService {
  constructor(private users: UserService) {}
  
  async login(email: string, password: string): Promise<Token> {
    const user = await this.users.getUser(email);
    // ... authentication logic
  }
}
  `;

  const chunks = await manager.chunkFile(sourceCode, 'services.ts', 'typescript');

  console.log(`Created ${chunks.length} chunks:`);
  chunks.forEach((chunk) => {
    console.log(`- ${chunk.id}: ${chunk.metadata.className || chunk.metadata.functionName}`);
    console.log(`  Tokens: ${chunk.tokens}`);
  });
}

// Exemple 3: Sélection de contexte avec stratégie spécifique
async function selectWithStrategy() {
  const availableChunks = await manager.chunkFile(
    sourceCode,
    'app.ts',
    'typescript'
  );

  // Stratégie incrémentale pour requête simple
  const result = await manager.selectContext(availableChunks, {
    budget: 5000,
    strategy: 'incremental',
    query: 'How does the login function work?',
  });

  console.log('Selected context:');
  console.log(`- Chunks: ${result.chunks.length}`);
  console.log(`- Tokens: ${result.stats.tokensUsed}`);
  console.log(`- From cache: ${result.fromCache}`);
  console.log(`- Predicted: ${result.predicted}`);
}

// Exemple 4: Session multi-tour avec contexte différentiel
async function differentialSession() {
  const initialChunks = await manager.chunkFile(code, 'file.ts', 'typescript');

  // Démarre la session
  const sessionId = manager.startDifferentialSession(initialChunks);
  console.log(`Session started: ${sessionId}`);

  // Tour 1: contexte complet
  let context = manager.getContextForTurn(initialChunks);
  console.log('Turn 1:', context.sendFullSnapshot ? 'Full snapshot' : 'Delta');

  // Simule des modifications
  const modifiedChunks = [...initialChunks];
  modifiedChunks[0] = {
    ...modifiedChunks[0],
    content: modifiedChunks[0].content + '\n// Added comment',
  };

  // Tour 2: delta uniquement
  context = manager.getContextForTurn(modifiedChunks);
  console.log('Turn 2:', context.sendFullSnapshot ? 'Full snapshot' : 'Delta');

  if (context.delta) {
    console.log(`  Added: ${context.delta.addedChunks.length} chunks`);
    console.log(`  Removed: ${context.delta.removedChunkIds.length} chunks`);
    console.log(`  Modified: ${context.delta.modifiedChunks.length} chunks`);
  }
}

// Exemple 5: Compression pour budget serré
async function compressForBudget() {
  const chunks = await manager.chunkFile(largeFile, 'large.ts', 'typescript');

  console.log('Original chunks:');
  const originalTokens = chunks.reduce((sum, c) => sum + c.tokens, 0);
  console.log(`  Total tokens: ${originalTokens}`);

  // Compresse avec ratio cible
  const compressed = await Promise.all(
    chunks.map((chunk) => manager.compressChunk(chunk, 0.3)) // 30% de la taille originale
  );

  const compressedTokens = compressed.reduce((sum, c) => sum + c.tokens, 0);
  console.log('Compressed chunks:');
  console.log(`  Total tokens: ${compressedTokens}`);
  console.log(`  Savings: ${((1 - compressedTokens / originalTokens) * 100).toFixed(1)}%`);
}

// Exemple 6: Utilisation du cache
async function cacheExample() {
  const chunks = await manager.chunkFile(code, 'cached.ts', 'typescript');
  const version = 'v1.0.0';

  // Première requête - cache miss
  console.time('First request');
  const result1 = await manager.selectContext(chunks, {
    budget: 10000,
    version,
    useCache: true,
  });
  console.timeEnd('First request');
  console.log(`From cache: ${result1.fromCache}`);

  // Deuxième requête - cache hit
  console.time('Second request');
  const result2 = await manager.selectContext(chunks, {
    budget: 10000,
    version,
    useCache: true,
  });
  console.timeEnd('Second request');
  console.log(`From cache: ${result2.fromCache}`);
}

// Exemple 7: Auto-sélection de stratégie
async function autoStrategySelection() {
  // Petit contexte -> incremental
  const smallChunks = await manager.chunkFile(smallFile, 'small.ts', 'typescript');
  const result1 = await manager.selectContext(smallChunks, {
    budget: 10000,
  });
  console.log(`Small file strategy: ${result1.stats}`);

  // Contexte moyen structuré -> semantic
  const mediumChunks = await manager.chunkFile(mediumFile, 'medium.ts', 'typescript');
  const result2 = await manager.selectContext(mediumChunks, {
    budget: 10000,
  });
  console.log(`Medium file strategy: ${result2.stats}`);

  // Très large contexte -> sliding window
  const largeChunks = Array.from({ length: 1000 }, (_, i) => ({
    id: `chunk-${i}`,
    content: 'x'.repeat(4000),
    tokens: 1000,
    type: 'code' as const,
    metadata: { importance: 0.5 },
  }));
  const result3 = await manager.selectContext(largeChunks, {
    budget: 100000,
  });
  console.log(`Large context strategy: ${result3.stats}`);
}

// Exemple 8: Monitoring et statistiques
async function monitoringExample() {
  // Effectue plusieurs requêtes
  for (let i = 0; i < 10; i++) {
    await manager.selectContext(chunks, {
      budget: 10000,
      query: `Query ${i}`,
      useCache: true,
      usePrediction: true,
    });
  }

  // Récupère les stats
  const stats = manager.getStats();

  console.log('Context Manager Statistics:');
  console.log('\nStrategies:');
  Object.entries(stats.strategies).forEach(([name, stratStats]) => {
    console.log(`  ${name}:`);
    console.log(`    Tokens used: ${stratStats.tokensUsed}`);
    console.log(`    Tokens saved: ${stratStats.tokensSaved}`);
    console.log(`    Compression ratio: ${(stratStats.compressionRatio * 100).toFixed(1)}%`);
  });

  if (stats.cache) {
    console.log('\nCache:');
    console.log(`  Hit rate: ${(stats.cache.hitRate * 100).toFixed(1)}%`);
    console.log(`  Total entries: ${stats.cache.totalEntries}`);
  }

  if (stats.predictor) {
    console.log('\nPredictor:');
    console.log(`  Patterns: ${stats.predictor.totalPatterns}`);
    console.log(`  History size: ${stats.predictor.historySize}`);
    console.log(`  Avg frequency: ${stats.predictor.avgFrequency.toFixed(1)}`);
  }
}

// Exemple 9: Nettoyage périodique
async function cleanupExample() {
  // Effectue des opérations...

  // Nettoie les données anciennes
  manager.cleanup();

  console.log('Cleanup completed');
}

// Exemple 10: Configuration dynamique
async function dynamicConfiguration() {
  // Commence avec config minimale
  manager.configure({
    enablePrediction: false,
    enableCache: false,
  });

  // ... après période d'apprentissage

  // Active les optimisations
  manager.configure({
    enablePrediction: true,
    enableCache: true,
  });

  console.log('Configuration updated');
}

// Export pour usage
export {
  chunkSourceFile,
  selectWithStrategy,
  differentialSession,
  compressForBudget,
  cacheExample,
  autoStrategySelection,
  monitoringExample,
  cleanupExample,
  dynamicConfiguration,
};
