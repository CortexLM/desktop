/**
 * Tests pour les model presets et configurations 2026
 */

import { describe, it, expect } from 'vitest';
import {
  RECOMMENDED_MODELS,
  MODEL_PRESETS,
  getModelForPreset,
  getModelInfo,
  getModelsByTag,
  getProviderModels,
} from '../src/model-presets';

describe('Model Presets 2026', () => {
  describe('RECOMMENDED_MODELS', () => {
    it('should have models for all providers', () => {
      expect(RECOMMENDED_MODELS.openai).toBeDefined();
      expect(RECOMMENDED_MODELS.anthropic).toBeDefined();
      expect(RECOMMENDED_MODELS.openrouter).toBeDefined();
      expect(RECOMMENDED_MODELS.grok).toBeDefined();
      expect(RECOMMENDED_MODELS.ollama).toBeDefined();
    });

    it('should have latest OpenAI models', () => {
      const openaiModels = RECOMMENDED_MODELS.openai;
      expect(openaiModels.find(m => m.id === 'gpt-4.5-turbo')).toBeDefined();
      expect(openaiModels.find(m => m.id === 'o3-mini')).toBeDefined();
      expect(openaiModels.find(m => m.id === 'gpt-4o-2024-11-20')).toBeDefined();
    });

    it('should have latest Anthropic models', () => {
      const anthropicModels = RECOMMENDED_MODELS.anthropic;
      expect(anthropicModels.find(m => m.id === 'claude-opus-4.8')).toBeDefined();
      expect(anthropicModels.find(m => m.id === 'claude-sonnet-4.5')).toBeDefined();
    });

    it('should have correct tags on models', () => {
      const gpt45 = RECOMMENDED_MODELS.openai.find(m => m.id === 'gpt-4.5-turbo');
      expect(gpt45?.tags).toContain('latest');
      expect(gpt45?.tags).toContain('recommended');

      const o3mini = RECOMMENDED_MODELS.openai.find(m => m.id === 'o3-mini');
      expect(o3mini?.tags).toContain('reasoning');
    });

    it('should have context window information', () => {
      const models = Object.values(RECOMMENDED_MODELS).flat();
      models.forEach(model => {
        expect(model.contextWindow).toBeGreaterThan(0);
      });
    });
  });

  describe('MODEL_PRESETS', () => {
    it('should have all presets defined', () => {
      expect(MODEL_PRESETS.fastest).toBeDefined();
      expect(MODEL_PRESETS.smartest).toBeDefined();
      expect(MODEL_PRESETS.cheapest).toBeDefined();
      expect(MODEL_PRESETS.reasoning).toBeDefined();
    });

    it('fastest preset should use fast models', () => {
      const fastest = MODEL_PRESETS.fastest;
      expect(fastest.models.openai).toBe('o3-mini');
      expect(fastest.models.anthropic).toBe('claude-sonnet-4.5');
    });

    it('smartest preset should use most capable models', () => {
      const smartest = MODEL_PRESETS.smartest;
      expect(smartest.models.openai).toBe('gpt-4.5-turbo');
      expect(smartest.models.anthropic).toBe('claude-opus-4.8');
    });

    it('reasoning preset should use reasoning-optimized models', () => {
      const reasoning = MODEL_PRESETS.reasoning;
      expect(reasoning.models.openai).toBe('o3-mini');
      expect(reasoning.models.openrouter).toBe('deepseek/deepseek-r1');
    });

    it('cheapest preset should use cost-effective models', () => {
      const cheapest = MODEL_PRESETS.cheapest;
      expect(cheapest.models.openrouter).toBe('deepseek/deepseek-r1');
    });
  });

  describe('getModelForPreset', () => {
    it('should return correct model for preset and provider', () => {
      expect(getModelForPreset('fastest', 'openai')).toBe('o3-mini');
      expect(getModelForPreset('smartest', 'anthropic')).toBe('claude-opus-4.8');
      expect(getModelForPreset('reasoning', 'openrouter')).toBe('deepseek/deepseek-r1');
    });

    it('should return undefined for invalid provider', () => {
      expect(getModelForPreset('fastest', 'invalid')).toBeUndefined();
    });
  });

  describe('getModelInfo', () => {
    it('should return model information', () => {
      const info = getModelInfo('openai', 'gpt-4.5-turbo');
      expect(info).toBeDefined();
      expect(info?.name).toBe('GPT-4.5 Turbo');
      expect(info?.provider).toBe('openai');
    });

    it('should return undefined for non-existent model', () => {
      expect(getModelInfo('openai', 'nonexistent')).toBeUndefined();
    });

    it('should return undefined for invalid provider', () => {
      expect(getModelInfo('invalid', 'gpt-4')).toBeUndefined();
    });
  });

  describe('getModelsByTag', () => {
    it('should return all models with latest tag', () => {
      const latest = getModelsByTag('latest');
      expect(latest.length).toBeGreaterThan(0);
      expect(latest.every(m => m.tags?.includes('latest'))).toBe(true);
    });

    it('should return all reasoning models', () => {
      const reasoning = getModelsByTag('reasoning');
      expect(reasoning.length).toBeGreaterThan(0);
      expect(reasoning.every(m => m.tags?.includes('reasoning'))).toBe(true);
    });

    it('should return all recommended models', () => {
      const recommended = getModelsByTag('recommended');
      expect(recommended.length).toBeGreaterThan(0);
    });

    it('should return empty array for non-existent tag', () => {
      expect(getModelsByTag('nonexistent')).toEqual([]);
    });
  });

  describe('getProviderModels', () => {
    it('should return all models for a provider', () => {
      const openaiModels = getProviderModels('openai');
      expect(openaiModels.length).toBeGreaterThan(0);
      expect(openaiModels.every(m => m.provider === 'openai')).toBe(true);
    });

    it('should return empty array for invalid provider', () => {
      expect(getProviderModels('invalid')).toEqual([]);
    });
  });

  describe('Model consistency', () => {
    it('all preset models should exist in RECOMMENDED_MODELS', () => {
      Object.values(MODEL_PRESETS).forEach(preset => {
        Object.entries(preset.models).forEach(([providerId, modelId]) => {
          if (modelId) {
            const providerModels = RECOMMENDED_MODELS[providerId];
            const modelExists = providerModels?.some(m => m.id === modelId);
            expect(modelExists).toBe(true);
          }
        });
      });
    });

    it('all models should have required fields', () => {
      Object.values(RECOMMENDED_MODELS).flat().forEach(model => {
        expect(model.id).toBeTruthy();
        expect(model.name).toBeTruthy();
        expect(model.provider).toBeTruthy();
        expect(model.description).toBeTruthy();
      });
    });

    it('latest models should be in recommended list', () => {
      const latest = getModelsByTag('latest');
      expect(latest.some(m => m.id === 'gpt-4.5-turbo')).toBe(true);
      expect(latest.some(m => m.id === 'claude-opus-4.8')).toBe(true);
    });
  });
});
