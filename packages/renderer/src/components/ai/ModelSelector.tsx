/**
 * Model Selector Component
 * Sélecteur de modèles AI avec badges et presets
 */

import React from 'react';
import { Badge } from '../ui/badge';
import { RECOMMENDED_MODELS, ModelInfo } from '@cortex-ide/ai-engine/model-presets';

interface ModelSelectorProps {
  provider: string;
  value: string;
  onChange: (model: string) => void;
  className?: string;
}

export const ModelSelector: React.FC<ModelSelectorProps> = ({
  provider,
  value,
  onChange,
  className = '',
}) => {
  const models = RECOMMENDED_MODELS[provider] || [];

  const getModelBadges = (model: ModelInfo) => {
    if (!model.tags || model.tags.length === 0) return null;

    return (
      <div className="flex gap-1 ml-2">
        {model.tags.map((tag) => {
          let variant: 'default' | 'secondary' | 'outline' | 'destructive' = 'secondary';
          let color = '';

          switch (tag) {
            case 'latest':
              variant = 'default';
              color = 'bg-blue-500 text-white';
              break;
            case 'recommended':
              variant = 'default';
              color = 'bg-green-500 text-white';
              break;
            case 'reasoning':
              variant = 'outline';
              color = 'border-purple-500 text-purple-500';
              break;
            case 'fast':
              variant = 'outline';
              color = 'border-orange-500 text-orange-500';
              break;
            case 'cheapest':
              variant = 'outline';
              color = 'border-emerald-500 text-emerald-500';
              break;
            default:
              variant = 'secondary';
          }

          return (
            <Badge
              key={tag}
              variant={variant}
              className={`text-[10px] px-1 py-0 ${color}`}
            >
              {tag}
            </Badge>
          );
        })}
      </div>
    );
  };

  return (
    <div className={className}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 border border-border rounded-md bg-background"
      >
        {models.length > 0 ? (
          <>
            <optgroup label="Recommended Models">
              {models.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.name} {model.tags?.includes('latest') ? '🆕' : ''}
                  {model.tags?.includes('reasoning') ? '🧠' : ''}
                  {model.tags?.includes('fast') ? '⚡' : ''}
                </option>
              ))}
            </optgroup>
            <optgroup label="Custom">
              {!models.find((m) => m.id === value) && (
                <option value={value}>{value}</option>
              )}
              <option value="">Enter custom model...</option>
            </optgroup>
          </>
        ) : (
          <option value={value}>{value || 'Enter model name...'}</option>
        )}
      </select>

      {/* Model info display */}
      {models.length > 0 && (
        <div className="mt-2 space-y-1">
          {models
            .filter((m) => m.id === value)
            .map((model) => (
              <div
                key={model.id}
                className="flex items-center justify-between text-xs text-muted-foreground"
              >
                <div className="flex items-center gap-2">
                  <span>{model.description}</span>
                  {getModelBadges(model)}
                </div>
                {model.contextWindow && (
                  <span className="text-[10px]">
                    {(model.contextWindow / 1000).toFixed(0)}K context
                  </span>
                )}
              </div>
            ))}
        </div>
      )}
    </div>
  );
};

interface PresetSelectorProps {
  value: 'fastest' | 'smartest' | 'cheapest' | 'reasoning' | 'custom';
  onChange: (preset: 'fastest' | 'smartest' | 'cheapest' | 'reasoning' | 'custom') => void;
  className?: string;
}

export const PresetSelector: React.FC<PresetSelectorProps> = ({
  value,
  onChange,
  className = '',
}) => {
  return (
    <div className={className}>
      <label className="block text-sm font-medium mb-2">Model Preset</label>
      <select
        value={value}
        onChange={(e) =>
          onChange(
            e.target.value as 'fastest' | 'smartest' | 'cheapest' | 'reasoning' | 'custom'
          )
        }
        className="w-full px-3 py-2 border border-border rounded-md bg-background"
      >
        <option value="fastest">⚡ Fastest - Ultra-fast responses</option>
        <option value="smartest">🧠 Smartest - Best quality</option>
        <option value="cheapest">💰 Cheapest - Minimal cost</option>
        <option value="reasoning">🔬 Reasoning - Complex tasks</option>
        <option value="custom">⚙️ Custom - Manual selection</option>
      </select>
      
      <div className="mt-2 text-xs text-muted-foreground">
        {value === 'fastest' && 'Optimized for speed with good quality'}
        {value === 'smartest' && 'Best models for complex reasoning'}
        {value === 'cheapest' && 'Cost-effective options'}
        {value === 'reasoning' && 'Specialized reasoning models'}
        {value === 'custom' && 'Choose your own model'}
      </div>
    </div>
  );
};
