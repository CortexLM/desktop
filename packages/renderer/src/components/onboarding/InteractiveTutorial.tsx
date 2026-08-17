/**
 * Interactive Tutorial - Step-by-step guide for new users
 */

import * as React from 'react';
import { Button } from '../ui/button';
import { FiArrowLeft, FiArrowRight, FiX, FiCheck } from 'react-icons/fi';

interface TutorialStep {
  title: string;
  description: string;
  content: React.ReactNode;
  canSkip: boolean;
}

const tutorialSteps: TutorialStep[] = [
  {
    title: 'Welcome to Cortex IDE',
    description: 'Let\'s get you started with a quick tour',
    canSkip: true,
    content: (
      <div className="space-y-4">
        <p className="text-text-secondary">
          Cortex IDE is different from traditional code editors. Instead of focusing on autocomplete, 
          we specialize in orchestrating AI agents for complex, multi-step coding missions.
        </p>
        <div className="p-4 bg-accent/10 border border-accent/30 rounded-lg">
          <p className="text-sm text-text">
            <strong>Think of it as:</strong> The mission control for your AI coding assistants
          </p>
        </div>
      </div>
    ),
  },
  {
    title: 'Chat with AI Agents',
    description: 'Your primary interface for interacting with AI',
    canSkip: true,
    content: (
      <div className="space-y-4">
        <p className="text-text-secondary">
          The Chat view is where you interact with AI agents. You can:
        </p>
        <ul className="space-y-2 text-sm text-text-secondary">
          <li className="flex items-start gap-2">
            <span className="text-accent">•</span>
            Ask questions about your codebase
          </li>
          <li className="flex items-start gap-2">
            <span className="text-accent">•</span>
            Request code changes and refactoring
          </li>
          <li className="flex items-start gap-2">
            <span className="text-accent">•</span>
            Get help debugging issues
          </li>
          <li className="flex items-start gap-2">
            <span className="text-accent">•</span>
            Run benchmarks to compare AI providers
          </li>
        </ul>
        <div className="p-3 bg-surface border border-border rounded font-mono text-xs">
          <div className="text-text-secondary mb-1">Try asking:</div>
          <div className="text-accent">"Explain the architecture of this project"</div>
        </div>
      </div>
    ),
  },
  {
    title: 'Configure AI Providers',
    description: 'Connect your preferred AI services',
    canSkip: true,
    content: (
      <div className="space-y-4">
        <p className="text-text-secondary">
          Cortex works with multiple AI providers. You'll need API keys for:
        </p>
        <div className="grid gap-3">
          {[
            { name: 'OpenAI', models: 'GPT-4, GPT-4o, o1' },
            { name: 'Anthropic', models: 'Claude 3.5 Sonnet, Opus' },
            { name: 'xAI', models: 'Grok' },
            { name: 'Ollama', models: 'Local models (free)' },
          ].map((provider) => (
            <div key={provider.name} className="p-3 bg-surface border border-border rounded-lg">
              <div className="font-medium text-sm text-text">{provider.name}</div>
              <div className="text-xs text-text-secondary mt-1">{provider.models}</div>
            </div>
          ))}
        </div>
        <p className="text-xs text-text-secondary">
          💡 You can configure these in Settings → AI Providers
        </p>
      </div>
    ),
  },
  {
    title: 'Benchmark AI Providers',
    description: 'Compare performance, cost, and quality',
    canSkip: true,
    content: (
      <div className="space-y-4">
        <p className="text-text-secondary">
          One of Cortex's unique features is built-in benchmarking. Test prompts across providers 
          to find the best balance of speed, cost, and quality.
        </p>
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <FiCheck className="text-green-500" />
            <span className="text-text-secondary">Compare response quality</span>
          </div>
          <div className="flex items-center gap-2">
            <FiCheck className="text-green-500" />
            <span className="text-text-secondary">Track token usage and costs</span>
          </div>
          <div className="flex items-center gap-2">
            <FiCheck className="text-green-500" />
            <span className="text-text-secondary">Measure latency</span>
          </div>
          <div className="flex items-center gap-2">
            <FiCheck className="text-green-500" />
            <span className="text-text-secondary">Export reports</span>
          </div>
        </div>
      </div>
    ),
  },
  {
    title: 'Ready to Start!',
    description: 'You\'re all set to use Cortex IDE',
    canSkip: false,
    content: (
      <div className="space-y-4 text-center">
        <div className="text-6xl">🎉</div>
        <p className="text-text-secondary">
          You've completed the tutorial! Here are some next steps:
        </p>
        <div className="grid gap-2 text-left max-w-md mx-auto">
          <div className="p-3 bg-surface border border-border rounded-lg text-sm">
            <div className="font-medium text-text">1. Configure your API keys</div>
            <div className="text-xs text-text-secondary mt-1">Settings → AI Providers</div>
          </div>
          <div className="p-3 bg-surface border border-border rounded-lg text-sm">
            <div className="font-medium text-text">2. Open your project</div>
            <div className="text-xs text-text-secondary mt-1">File → Open Folder</div>
          </div>
          <div className="p-3 bg-surface border border-border rounded-lg text-sm">
            <div className="font-medium text-text">3. Start chatting</div>
            <div className="text-xs text-text-secondary mt-1">Ask your first question!</div>
          </div>
        </div>
      </div>
    ),
  },
];

interface InteractiveTutorialProps {
  onComplete: () => void;
  onSkip: () => void;
}

export function InteractiveTutorial({ onComplete, onSkip }: InteractiveTutorialProps) {
  const [currentStep, setCurrentStep] = React.useState(0);
  const step = tutorialSteps[currentStep];
  const isLastStep = currentStep === tutorialSteps.length - 1;
  const isFirstStep = currentStep === 0;

  const handleNext = () => {
    if (isLastStep) {
      onComplete();
    } else {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handleBack = () => {
    setCurrentStep((prev) => Math.max(0, prev - 1));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="relative bg-background border border-border rounded-lg shadow-2xl max-w-2xl w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-text">{step.title}</h2>
            <p className="text-sm text-text-secondary mt-1">{step.description}</p>
          </div>
          {step.canSkip && (
            <button
              onClick={onSkip}
              className="text-text-secondary hover:text-text transition-colors ml-4"
              aria-label="Skip tutorial"
            >
              <FiX className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Progress bar */}
        <div className="h-1 bg-surface">
          <div
            className="h-full bg-accent transition-all duration-300"
            style={{ width: `${((currentStep + 1) / tutorialSteps.length) * 100}%` }}
          />
        </div>

        {/* Content */}
        <div className="px-6 py-8 min-h-[300px]">
          {step.content}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-surface">
          <div className="text-sm text-text-secondary">
            Step {currentStep + 1} of {tutorialSteps.length}
          </div>
          <div className="flex gap-2">
            {!isFirstStep && (
              <Button variant="outline" onClick={handleBack}>
                <FiArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
            )}
            <Button onClick={handleNext}>
              {isLastStep ? (
                <>
                  <FiCheck className="w-4 h-4 mr-2" />
                  Get Started
                </>
              ) : (
                <>
                  Next
                  <FiArrowRight className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
