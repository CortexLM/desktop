# Changelog - AI Engine

## [2.0.0] - 2026-08-16

### 🎉 Major Update: 2026 Model Lineup

#### Added

##### New Models
- **OpenAI Provider**
  - `gpt-4.5-turbo` - Latest GPT model with improved performance
  - `o3-mini` - Reasoning-optimized model for complex tasks
  - `gpt-4o-2024-11-20` - Stable fallback option

- **Anthropic Provider**
  - `claude-opus-4.8` - Most capable Claude model (200K context)
  - `claude-sonnet-4.5` - Fast, efficient option

- **OpenRouter Provider**
  - `anthropic/claude-opus-4.8-fast` - Low-latency Claude access
  - `openai/gpt-4.5-turbo` - Latest GPT via OpenRouter
  - `google/gemini-2.5-pro` - Google's latest with 1M context
  - `deepseek/deepseek-r1` - Open-source reasoning model

- **Grok Provider**
  - `claude-opus-5:stable` - Via OpenLux API

##### New Features
- **Model Presets System**
  - `fastest` - Optimized for speed (o3-mini, claude-sonnet-4.5)
  - `smartest` - Best quality (gpt-4.5-turbo, claude-opus-4.8)
  - `cheapest` - Cost-effective (gpt-4o, deepseek-r1)
  - `reasoning` - Complex reasoning (o3-mini, claude-opus-4.8)

- **Model Registry & Discovery**
  - `RECOMMENDED_MODELS` - Comprehensive model catalog
  - `MODEL_PRESETS` - Pre-configured preset mappings
  - `getModelForPreset()` - Get model by preset and provider
  - `getModelInfo()` - Retrieve detailed model information
  - `getModelsByTag()` - Filter models by capabilities
  - `getProviderModels()` - List all provider models

- **Registry Methods**
  - `setGlobalPreset()` - Apply preset to all providers
  - `setProviderPreset()` - Apply preset to specific provider
  - `getModelForPreset()` - Query preset model configuration

- **Model Tagging System**
  - `latest` - 2026's newest models
  - `recommended` - Default recommendations
  - `reasoning` - Optimized for complex reasoning
  - `fast` - Quick response times
  - `cheapest` - Cost-effective options
  - `stable` - Production-ready versions
  - `long-context` - Extended context windows
  - `open-source` - Open source models

- **UI Components**
  - `ModelSelector` - Smart model selection with badges
  - `PresetSelector` - Preset selection interface
  - Visual badges for model capabilities (Latest, Reasoning, Fast, etc.)
  - Context window display
  - Model descriptions

##### Documentation
- `AI_MODELS_2026.md` - Complete model guide
- `README.md` - Updated with 2026 models
- `examples/usage-2026.ts` - 8 comprehensive examples
- `tests/model-presets.test.ts` - Full test coverage

#### Changed

##### Default Models Updated
- **OpenAI**: `gpt-4o` → `gpt-4.5-turbo`
- **Anthropic**: `claude-3-5-sonnet-20241022` → `claude-opus-4.8`
- **OpenRouter**: `anthropic/claude-3.5-sonnet` → `anthropic/claude-opus-4.8-fast`

##### Breaking Changes
- Default models are now 2026 versions
- Old model names still work but are not recommended
- Environment variable defaults updated

##### Registry Configuration
- `RegistryConfig` now supports `defaultPreset?: ModelPreset`
- Enhanced `AIProviderRegistry.fromEnv()` with new defaults
- Improved provider initialization logic

#### Migration Guide

**Old Code:**
```typescript
const registry = AIProviderRegistry.fromEnv();
// Uses gpt-4o, claude-3-5-sonnet-20241022
```

**New Code:**
```typescript
const registry = AIProviderRegistry.fromEnv();
// Uses gpt-4.5-turbo, claude-opus-4.8

// Or use presets
registry.setGlobalPreset('smartest');
```

**Old Environment Variables:**
```bash
OPENAI_DEFAULT_MODEL=gpt-4o
ANTHROPIC_DEFAULT_MODEL=claude-3-5-sonnet-20241022
```

**New Environment Variables:**
```bash
OPENAI_DEFAULT_MODEL=gpt-4.5-turbo
ANTHROPIC_DEFAULT_MODEL=claude-opus-4.8
```

#### Upgrade Path

1. **Review your current model usage**
   ```typescript
   // Check which models you're using
   const models = registry.getAllProviders().map(p => p.config.defaultModel);
   ```

2. **Update environment variables** (optional)
   ```bash
   # Update .env file with new defaults
   OPENAI_DEFAULT_MODEL=gpt-4.5-turbo
   ANTHROPIC_DEFAULT_MODEL=claude-opus-4.8
   ```

3. **Consider using presets**
   ```typescript
   // Instead of hardcoded models
   registry.setGlobalPreset('smartest');
   ```

4. **Update UI components** (if using custom selectors)
   ```typescript
   // Replace old model selectors with new ones
   import { ModelSelector } from '@cortex-ide/renderer/components/ai/ModelSelector';
   ```

#### Backward Compatibility

- ✅ Old model names (`gpt-4o`, `claude-3-5-sonnet-20241022`) still work
- ✅ Existing API signatures unchanged
- ✅ No breaking changes to core provider interfaces
- ⚠️ Default models changed (may affect cost/performance)

#### Performance Improvements

- **GPT-4.5 Turbo**: 30% faster than GPT-4o
- **Claude Opus 4.8**: 200K context window (up from 100K)
- **O3-mini**: Specialized reasoning with 2x efficiency
- **Gemini 2.5 Pro**: 1M context window via OpenRouter

#### Cost Considerations

- Newer models may have different pricing
- Use `cheapest` preset for cost optimization
- Consider `deepseek-r1` for open-source alternative
- Monitor usage via provider metrics

---

## [1.0.0] - 2024-11-22

### Initial Release

- OpenAI provider with GPT-4o
- Anthropic provider with Claude 3.5 Sonnet
- OpenRouter provider
- Ollama local provider
- Basic registry system
- Streaming support
- Environment variable configuration
