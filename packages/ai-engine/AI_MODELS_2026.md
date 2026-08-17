# AI Models Update - 2026

## Modèles mis à jour

### OpenAI Provider
- **Modèle par défaut** : `gpt-4.5-turbo` (2026)
- **Fallback** : `gpt-4o-2024-11-20`
- **Nouveau** : `o3-mini` - Modèle de raisonnement optimisé

### Anthropic Provider
- **Modèle par défaut** : `claude-opus-4.8` (2026)
- **Nouveau** : `claude-sonnet-4.5` - Option rapide

### OpenRouter Provider
Modèles recommandés :
- `anthropic/claude-opus-4.8-fast`
- `openai/gpt-4.5-turbo`
- `google/gemini-2.5-pro`
- `deepseek/deepseek-r1` - Open source reasoning

### Grok Provider
- `claude-opus-5:stable` via OpenLux API

## Model Presets

Le système propose maintenant des presets intelligents :

### 🚀 Fastest
Réponses ultra-rapides avec bonne qualité
- OpenAI: `o3-mini`
- Anthropic: `claude-sonnet-4.5`
- OpenRouter: `anthropic/claude-opus-4.8-fast`

### 🧠 Smartest
Meilleure qualité pour tâches complexes
- OpenAI: `gpt-4.5-turbo`
- Anthropic: `claude-opus-4.8`
- OpenRouter: `anthropic/claude-opus-4.8-fast`

### 💰 Cheapest
Prix minimal, qualité correcte
- OpenAI: `gpt-4o-2024-11-20`
- Anthropic: `claude-sonnet-4.5`
- OpenRouter: `deepseek/deepseek-r1`

### 🔬 Reasoning
Optimisé pour raisonnement complexe
- OpenAI: `o3-mini`
- Anthropic: `claude-opus-4.8`
- OpenRouter: `deepseek/deepseek-r1`

## Utilisation

### Via Registry

```typescript
import { AIProviderRegistry } from '@cortex-ide/ai-engine';

const registry = AIProviderRegistry.fromEnv();

// Utiliser un preset sur un provider spécifique
registry.setProviderPreset('openai', 'fastest');

// Appliquer un preset global
registry.setGlobalPreset('smartest');

// Obtenir le modèle d'un preset
const model = registry.getModelForPreset('reasoning', 'anthropic');
```

### Via Code

```typescript
import { getModelForPreset, RECOMMENDED_MODELS } from '@cortex-ide/ai-engine';

// Récupérer un modèle selon le preset
const model = getModelForPreset('fastest', 'openai'); // 'o3-mini'

// Lister les modèles d'un provider
const models = RECOMMENDED_MODELS.openai;

// Filtrer par tag
import { getModelsByTag } from '@cortex-ide/ai-engine';
const latestModels = getModelsByTag('latest');
const reasoningModels = getModelsByTag('reasoning');
```

### Via UI

Le composant `ModelSelector` affiche maintenant :
- ✨ Badges pour les modèles `latest`, `recommended`, `reasoning`, `fast`, `cheapest`
- 📊 Informations sur le context window
- 🎨 Description de chaque modèle

```tsx
import { ModelSelector, PresetSelector } from '@cortex-ide/renderer/components/ai/ModelSelector';

<PresetSelector
  value={preset}
  onChange={setPreset}
/>

<ModelSelector
  provider="openai"
  value={model}
  onChange={setModel}
/>
```

## Variables d'environnement

```bash
# OpenAI
OPENAI_API_KEY=sk-...
OPENAI_DEFAULT_MODEL=gpt-4.5-turbo

# Anthropic
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_DEFAULT_MODEL=claude-opus-4.8

# OpenRouter
OPENROUTER_API_KEY=sk-or-...
OPENROUTER_DEFAULT_MODEL=anthropic/claude-opus-4.8-fast

# Grok
GROK_API_KEY=...
GROK_DEFAULT_MODEL=claude-opus-5:stable

# Provider par défaut
DEFAULT_AI_PROVIDER=anthropic
```

## Tags disponibles

- **latest** : Modèles les plus récents (2026)
- **recommended** : Modèles recommandés par défaut
- **reasoning** : Optimisés pour le raisonnement complexe
- **fast** : Réponses rapides
- **cheapest** : Prix minimal
- **stable** : Versions stables éprouvées
- **long-context** : Context window étendu
- **open-source** : Modèles open source

## Migration

Si vous utilisiez les anciens modèles :

- `gpt-4` ou `gpt-4o` → `gpt-4.5-turbo`
- `claude-3-5-sonnet-20241022` → `claude-opus-4.8`
- `anthropic/claude-3.5-sonnet` → `anthropic/claude-opus-4.8-fast`

Les anciens modèles continuent de fonctionner mais ne sont plus recommandés.
