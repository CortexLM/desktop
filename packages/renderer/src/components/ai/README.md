# ModelSelector Component

Smart AI model selector with visual badges and preset support.

## Components

### ModelSelector

Displays available models for a specific provider with visual indicators.

```tsx
import { ModelSelector } from '@cortex-ide/renderer/components/ai/ModelSelector';

<ModelSelector
  provider="openai"
  value={model}
  onChange={setModel}
  className="w-full"
/>
```

**Features:**
- 🏷️ Visual badges (Latest, Reasoning, Fast, Cheapest)
- 📊 Context window display
- 📝 Model descriptions
- 🎯 Smart dropdown with grouped options
- 🆕 Emoji indicators in dropdown

**Props:**
```typescript
interface ModelSelectorProps {
  provider: string;        // AI provider ID
  value: string;           // Current model ID
  onChange: (model: string) => void;
  className?: string;      // Optional CSS classes
}
```

### PresetSelector

Quick preset selection for common use cases.

```tsx
import { PresetSelector } from '@cortex-ide/renderer/components/ai/ModelSelector';

<PresetSelector
  value={preset}
  onChange={setPreset}
  className="mb-4"
/>
```

**Presets:**
- ⚡ **Fastest** - Ultra-fast responses
- 🧠 **Smartest** - Best quality
- 💰 **Cheapest** - Cost-effective
- 🔬 **Reasoning** - Complex tasks
- ⚙️ **Custom** - Manual selection

**Props:**
```typescript
interface PresetSelectorProps {
  value: 'fastest' | 'smartest' | 'cheapest' | 'reasoning' | 'custom';
  onChange: (preset) => void;
  className?: string;
}
```

## Usage Examples

### Basic Usage

```tsx
import { useState } from 'react';
import { ModelSelector } from '@cortex-ide/renderer/components/ai/ModelSelector';

function MyComponent() {
  const [model, setModel] = useState('gpt-4.5-turbo');

  return (
    <div>
      <label>Select Model</label>
      <ModelSelector
        provider="openai"
        value={model}
        onChange={setModel}
      />
    </div>
  );
}
```

### With Preset

```tsx
import { useState } from 'react';
import { PresetSelector, ModelSelector } from '@cortex-ide/renderer/components/ai/ModelSelector';
import { getModelForPreset } from '@cortex-ide/ai-engine';

function MyComponent() {
  const [preset, setPreset] = useState('smartest');
  const [provider, setProvider] = useState('openai');
  const [model, setModel] = useState('gpt-4.5-turbo');

  const handlePresetChange = (newPreset) => {
    setPreset(newPreset);
    if (newPreset !== 'custom') {
      const presetModel = getModelForPreset(newPreset, provider);
      if (presetModel) setModel(presetModel);
    }
  };

  return (
    <div className="space-y-4">
      <PresetSelector value={preset} onChange={handlePresetChange} />
      
      {preset === 'custom' && (
        <ModelSelector
          provider={provider}
          value={model}
          onChange={setModel}
        />
      )}
    </div>
  );
}
```

### Full Example with Provider Selection

```tsx
function AIConfiguration() {
  const [provider, setProvider] = useState('openai');
  const [model, setModel] = useState('gpt-4.5-turbo');

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-2">Provider</label>
        <select
          value={provider}
          onChange={(e) => setProvider(e.target.value)}
          className="w-full px-3 py-2 border border-border rounded-md"
        >
          <option value="openai">OpenAI</option>
          <option value="anthropic">Anthropic</option>
          <option value="openrouter">OpenRouter</option>
          <option value="grok">Grok</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Model</label>
        <ModelSelector
          provider={provider}
          value={model}
          onChange={setModel}
        />
      </div>
    </div>
  );
}
```

## Badge Colors

| Badge | Color | Meaning |
|-------|-------|---------|
| 🆕 Latest | Blue | Newest 2026 models |
| ⭐ Recommended | Green | Default recommendations |
| 🧠 Reasoning | Purple | Complex reasoning tasks |
| ⚡ Fast | Orange | Quick responses |
| 💰 Cheapest | Emerald | Cost-effective |

## Dependencies

- `@cortex-ide/ai-engine` - Model catalog and presets
- `../ui/badge` - Badge component

## Notes

- Models are loaded from `RECOMMENDED_MODELS` catalog
- Unknown models (custom) are preserved in dropdown
- Provider must be valid for badges to display
- Context window shown in K (thousands of tokens)
