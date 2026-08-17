/**
 * Exemples d'utilisation des modèles AI 2026
 */

import { AIProviderRegistry, getModelForPreset, RECOMMENDED_MODELS } from '@cortex-ide/ai-engine';

// ============================================================
// Exemple 1: Initialisation basique avec les nouveaux modèles
// ============================================================

async function basicUsage() {
  const registry = AIProviderRegistry.fromEnv();

  // Utiliser le provider par défaut avec le modèle le plus récent
  const provider = registry.getDefaultOrThrow();
  
  const response = await provider.chat([
    { role: 'user', content: 'Explain quantum computing in simple terms' }
  ]);

  console.log(response.content);
}

// ============================================================
// Exemple 2: Utilisation des presets
// ============================================================

async function presetsUsage() {
  const registry = AIProviderRegistry.fromEnv();

  // Tâche rapide : utiliser le preset "fastest"
  registry.setGlobalPreset('fastest');
  const fastProvider = registry.getProvider('openai');
  const quickAnswer = await fastProvider?.chat([
    { role: 'user', content: 'What is 2+2?' }
  ]);

  // Tâche complexe : utiliser le preset "smartest"
  registry.setGlobalPreset('smartest');
  const smartProvider = registry.getProvider('anthropic');
  const detailedAnswer = await smartProvider?.chat([
    { role: 'user', content: 'Design a microservices architecture for an e-commerce platform' }
  ]);

  // Tâche de raisonnement : utiliser le preset "reasoning"
  registry.setGlobalPreset('reasoning');
  const reasoningProvider = registry.getProvider('openai');
  const reasoning = await reasoningProvider?.chat([
    { role: 'user', content: 'Solve this logic puzzle: ...' }
  ]);

  console.log({ quickAnswer, detailedAnswer, reasoning });
}

// ============================================================
// Exemple 3: Sélection manuelle de modèles
// ============================================================

async function manualModelSelection() {
  const registry = AIProviderRegistry.fromEnv();

  // Utiliser GPT-4.5 Turbo pour une tâche spécifique
  const openai = registry.getProvider('openai');
  const response1 = await openai?.chat(
    [{ role: 'user', content: 'Generate API documentation' }],
    { model: 'gpt-4.5-turbo' }
  );

  // Utiliser Claude Opus 4.8 pour une analyse profonde
  const anthropic = registry.getProvider('anthropic');
  const response2 = await anthropic?.chat(
    [{ role: 'user', content: 'Analyze this codebase for security vulnerabilities' }],
    { model: 'claude-opus-4.8' }
  );

  // Utiliser O3-mini pour un raisonnement rapide
  const response3 = await openai?.chat(
    [{ role: 'user', content: 'Debug this algorithm' }],
    { model: 'o3-mini' }
  );

  console.log({ response1, response2, response3 });
}

// ============================================================
// Exemple 4: Exploration des modèles disponibles
// ============================================================

function exploreModels() {
  // Lister tous les modèles OpenAI
  const openaiModels = RECOMMENDED_MODELS.openai;
  console.log('OpenAI Models:');
  openaiModels.forEach(model => {
    console.log(`- ${model.name}: ${model.description}`);
    console.log(`  Tags: ${model.tags?.join(', ')}`);
    console.log(`  Context: ${model.contextWindow}K tokens`);
  });

  // Trouver tous les modèles de raisonnement
  const reasoningModels = Object.values(RECOMMENDED_MODELS)
    .flat()
    .filter(m => m.tags?.includes('reasoning'));
  
  console.log('\nReasoning Models:');
  reasoningModels.forEach(model => {
    console.log(`- ${model.provider}/${model.id}: ${model.name}`);
  });

  // Trouver les modèles les plus récents
  const latestModels = Object.values(RECOMMENDED_MODELS)
    .flat()
    .filter(m => m.tags?.includes('latest'));
  
  console.log('\nLatest Models (2026):');
  latestModels.forEach(model => {
    console.log(`- ${model.name} (${model.provider})`);
  });
}

// ============================================================
// Exemple 5: Fallback strategy
// ============================================================

async function fallbackStrategy() {
  const registry = AIProviderRegistry.fromEnv();

  const message = [{ role: 'user' as const, content: 'Hello, how are you?' }];

  try {
    // Essayer avec le modèle le plus récent
    const provider = registry.getProvider('openai');
    const response = await provider?.chat(message, { 
      model: 'gpt-4.5-turbo' 
    });
    console.log('Success with gpt-4.5-turbo:', response?.content);
  } catch (error) {
    console.log('gpt-4.5-turbo failed, trying fallback...');
    
    try {
      // Fallback vers gpt-4o
      const provider = registry.getProvider('openai');
      const response = await provider?.chat(message, { 
        model: 'gpt-4o-2024-11-20' 
      });
      console.log('Success with fallback:', response?.content);
    } catch (fallbackError) {
      console.error('All OpenAI models failed');
      
      // Dernier recours : essayer Anthropic
      const anthropic = registry.getProvider('anthropic');
      const response = await anthropic?.chat(message);
      console.log('Success with Anthropic:', response?.content);
    }
  }
}

// ============================================================
// Exemple 6: Utilisation contextuelle selon le use case
// ============================================================

async function contextualUsage() {
  const registry = AIProviderRegistry.fromEnv();

  // Use case 1: Code generation (qualité > vitesse)
  async function generateCode(prompt: string) {
    const model = getModelForPreset('smartest', 'openai');
    const provider = registry.getProvider('openai');
    return await provider?.chat([{ role: 'user', content: prompt }], { model });
  }

  // Use case 2: Simple Q&A (vitesse > qualité)
  async function quickAnswer(question: string) {
    const model = getModelForPreset('fastest', 'anthropic');
    const provider = registry.getProvider('anthropic');
    return await provider?.chat([{ role: 'user', content: question }], { model });
  }

  // Use case 3: Complex reasoning (raisonnement optimisé)
  async function solveComplexProblem(problem: string) {
    const model = getModelForPreset('reasoning', 'openai');
    const provider = registry.getProvider('openai');
    return await provider?.chat([{ role: 'user', content: problem }], { model });
  }

  // Use case 4: Batch processing (coût > performance)
  async function batchProcess(items: string[]) {
    const model = getModelForPreset('cheapest', 'openrouter');
    const provider = registry.getProvider('openrouter');
    
    const results = [];
    for (const item of items) {
      const response = await provider?.chat([{ role: 'user', content: item }], { model });
      results.push(response);
    }
    return results;
  }

  // Exemples d'utilisation
  await generateCode('Create a REST API in TypeScript');
  await quickAnswer('What is the capital of France?');
  await solveComplexProblem('Design a distributed caching system');
  await batchProcess(['Task 1', 'Task 2', 'Task 3']);
}

// ============================================================
// Exemple 7: Streaming avec les nouveaux modèles
// ============================================================

async function streamingUsage() {
  const registry = AIProviderRegistry.fromEnv();
  const provider = registry.getProvider('anthropic');

  if (!provider) {
    throw new Error('Provider not available');
  }

  console.log('Streaming response from Claude Opus 4.8:');
  
  for await (const chunk of provider.stream(
    [{ role: 'user', content: 'Write a short story about AI' }],
    { model: 'claude-opus-4.8' }
  )) {
    process.stdout.write(chunk.content);
    
    if (chunk.done) {
      console.log('\n[Stream completed]');
    }
  }
}

// ============================================================
// Exemple 8: Configuration dynamique
// ============================================================

function dynamicConfiguration() {
  // Configuration selon l'environnement
  const isDevelopment = process.env.NODE_ENV === 'development';
  const isProduction = process.env.NODE_ENV === 'production';

  const registry = new AIProviderRegistry({
    openai: {
      apiKey: process.env.OPENAI_API_KEY,
      // En dev : modèle moins cher, en prod : meilleur modèle
      defaultModel: isDevelopment ? 'gpt-4o-2024-11-20' : 'gpt-4.5-turbo',
    },
    anthropic: {
      apiKey: process.env.ANTHROPIC_API_KEY,
      defaultModel: isDevelopment ? 'claude-sonnet-4.5' : 'claude-opus-4.8',
    },
    defaultProvider: isProduction ? 'anthropic' : 'openai',
  });

  return registry;
}

// Exporter les exemples
export {
  basicUsage,
  presetsUsage,
  manualModelSelection,
  exploreModels,
  fallbackStrategy,
  contextualUsage,
  streamingUsage,
  dynamicConfiguration,
};
