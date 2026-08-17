# Grok Provider

Provider pour Grok via l'API OpenLux, permettant l'accès au modèle `claude-opus-5:stable`.

## Configuration

### Variables d'environnement

```bash
GROK_API_KEY=sk-O1XOv8M7uO9MhEx0js7kkdWe0GfZVwne9WojDnyT0byKqsVj
GROK_BASE_URL=https://api.openlux.ai/v1  # Optionnel, valeur par défaut
GROK_DEFAULT_MODEL=claude-opus-5:stable   # Optionnel, valeur par défaut
```

### Utilisation programmatique

```typescript
import { GrokProvider, AIProviderRegistry } from 'ai-engine';

// Configuration directe
const provider = new GrokProvider({
  apiKey: 'sk-O1XOv8M7uO9MhEx0js7kkdWe0GfZVwne9WojDnyT0byKqsVj',
  defaultModel: 'claude-opus-5:stable',
});

// Via le registry
const registry = AIProviderRegistry.fromEnv();
const grokProvider = registry.getProvider('grok');
```

## Fonctionnalités

### Chat (Non-streaming)

```typescript
const response = await provider.chat(
  [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: 'Hello!' }
  ],
  {
    model: 'claude-opus-5:stable',
    temperature: 0.7,
    maxTokens: 2048,
  }
);

console.log(response.content);
console.log(`Tokens: ${response.usage.totalTokens}`);
```

### Streaming

```typescript
for await (const chunk of provider.stream(
  [{ role: 'user', content: 'Write a poem' }],
  { model: 'claude-opus-5:stable' }
)) {
  if (chunk.content) {
    process.stdout.write(chunk.content);
  }
  if (chunk.done) {
    console.log('\n✓ Complete');
  }
}
```

### Vérification de disponibilité

```typescript
const isAvailable = await provider.isAvailable();
if (isAvailable) {
  console.log('Grok provider is available');
}
```

## Gestion des erreurs

Le provider inclut une logique de retry automatique pour les erreurs temporaires :

- **Erreurs 5xx** : Retry avec backoff exponentiel
- **Erreur 429 (Rate limit)** : Retry automatique
- **Erreurs réseau** : Retry configurable

### Configuration du retry

```typescript
const provider = new GrokProvider({
  apiKey: 'your-api-key',
  maxRetries: 3,        // Nombre de tentatives (défaut: 3)
  retryDelay: 1000,     // Délai initial en ms (défaut: 1000)
});
```

Le délai entre les tentatives suit un backoff exponentiel :
- Tentative 1 : 1000ms
- Tentative 2 : 2000ms
- Tentative 3 : 4000ms

### Gestion manuelle des erreurs

```typescript
import { AIProviderError } from 'ai-engine';

try {
  const response = await provider.chat(messages);
} catch (error) {
  if (error instanceof AIProviderError) {
    console.error('Provider:', error.providerId);
    console.error('Code:', error.code);
    console.error('Status:', error.statusCode);
    console.error('Message:', error.message);
  }
}
```

## Modèles disponibles

Le provider Grok via OpenLux API supporte principalement :

- `claude-opus-5:stable` (recommandé, défaut)

Pour vérifier les modèles disponibles via l'API :

```bash
curl https://api.openlux.ai/v1/models \
  -H "Authorization: Bearer $GROK_API_KEY"
```

## Intégration dans l'UI

Le provider Grok est automatiquement disponible dans les sélecteurs de modèles de l'application :

### Automations (ActionConfig.tsx)
```tsx
<select value={provider}>
  <option value="openai">OpenAI</option>
  <option value="anthropic">Anthropic</option>
  <option value="openrouter">OpenRouter</option>
  <option value="ollama">Ollama</option>
  <option value="grok">Grok</option>
</select>
```

### Types TypeScript
```typescript
type AIProvider = 'openai' | 'anthropic' | 'openrouter' | 'ollama' | 'grok';
```

## Performances

- **Latence** : ~2-5 secondes pour la première réponse (streaming)
- **Throughput** : Compatible streaming en temps réel
- **Limites** : Dépendent de votre clé API OpenLux

## Compatibilité

Le provider Grok implémente l'interface `AIProvider` standard et est compatible avec :

- ✅ Chat non-streaming
- ✅ Streaming SSE
- ✅ Retry automatique
- ✅ Error handling
- ✅ Configuration via env vars
- ✅ AIProviderRegistry

## Tests

```bash
# Lancer les tests unitaires
cd packages/ai-engine
bun test src/providers/__tests__/grok-provider.test.ts
```

Les tests couvrent :
- Configuration et initialisation
- Chat non-streaming
- Streaming
- Gestion des erreurs
- Logique de retry
- Vérification de disponibilité

## Dépannage

### Erreur : "Grok API key is required"
```typescript
// Vérifier la variable d'environnement
console.log(process.env.GROK_API_KEY);

// Ou passer la clé manuellement
const provider = new GrokProvider({ apiKey: 'your-key' });
```

### Erreur : "Invalid API key"
- Vérifier que la clé commence par `sk-`
- Vérifier la validité de la clé sur le dashboard OpenLux

### Timeouts
```typescript
// Augmenter les retries pour les connexions lentes
const provider = new GrokProvider({
  apiKey: 'your-key',
  maxRetries: 5,
  retryDelay: 2000,
});
```

## Exemples d'utilisation

### Exemple complet avec le Registry

```typescript
import { AIProviderRegistry } from 'ai-engine';

// Initialiser depuis l'environnement
const registry = AIProviderRegistry.fromEnv();

// Vérifier si Grok est disponible
const isGrokAvailable = await registry.isProviderAvailable('grok');

if (isGrokAvailable) {
  const grok = registry.getProvider('grok')!;
  
  const response = await grok.chat([
    { role: 'user', content: 'Explain quantum computing' }
  ]);
  
  console.log(response.content);
}
```

### Exemple avec streaming dans une app

```typescript
async function chatWithGrok(message: string) {
  const provider = new GrokProvider({
    apiKey: process.env.GROK_API_KEY!,
  });
  
  let fullResponse = '';
  
  for await (const chunk of provider.stream(
    [{ role: 'user', content: message }]
  )) {
    if (chunk.content) {
      fullResponse += chunk.content;
      // Update UI
      updateChatUI(fullResponse);
    }
  }
  
  return fullResponse;
}
```

## Ressources

- API OpenLux : https://api.openlux.ai/
- Documentation complète : Voir `/packages/ai-engine/README.md`
- Code source : `/packages/ai-engine/src/providers/grok-provider.ts`
