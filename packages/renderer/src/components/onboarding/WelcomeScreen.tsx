/**
 * Welcome Screen - First-time user onboarding
 */

import * as React from 'react';
import { Button } from '../ui/button';
import { FiPlay, FiBook, FiSettings, FiX } from 'react-icons/fi';

interface WelcomeScreenProps {
  onClose: () => void;
  onStartTutorial: () => void;
}

export function WelcomeScreen({ onClose, onStartTutorial }: WelcomeScreenProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="relative bg-background border border-border rounded-lg shadow-2xl max-w-3xl w-full mx-4 overflow-hidden">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-text-secondary hover:text-text transition-colors z-10"
          aria-label="Close welcome screen"
        >
          <FiX className="w-5 h-5" />
        </button>

        {/* Header with gradient */}
        <div className="bg-gradient-to-r from-accent/20 to-accent/10 px-8 py-12 text-center">
          <h1 className="text-4xl font-bold text-text mb-3">
            Welcome to <span className="text-accent">Cortex IDE</span>
          </h1>
          <p className="text-lg text-text-secondary max-w-2xl mx-auto">
            A local coding-agent workbench: sessions, tools, git, and MCP.
          </p>
        </div>

        {/* Content */}
        <div className="px-8 py-8 space-y-6">
          {/* Key Features */}
          <div className="grid md:grid-cols-3 gap-4">
            <FeatureCard
              icon="🎯"
              title="Agent loop"
              description="Streaming turns with read/edit/bash tools, permissions, and plan mode"
            />
            <FeatureCard
              icon="📊"
              title="Usage tracking"
              description="Tokens and cost in the app. Provider latency benches stay CLI-only"
            />
            <FeatureCard
              icon="🧠"
              title="Project context"
              description="AGENTS.md, rules, memories, and semantic chunking of large files"
            />
          </div>

          {/* What to do next */}
          <div className="border-t border-border pt-6">
            <h3 className="text-sm font-semibold text-text-secondary mb-4 uppercase tracking-wide">
              Get Started
            </h3>
            <div className="grid gap-3">
              <ActionButton
                icon={<FiPlay className="w-5 h-5" />}
                title="Take the interactive tutorial"
                description="Learn the basics in 5 minutes"
                onClick={onStartTutorial}
                variant="primary"
              />
              <ActionButton
                icon={<FiBook className="w-5 h-5" />}
                title="Read the documentation"
                description="Deep dive into features and concepts"
                onClick={() => window.open('https://cortex-ide.dev/docs', '_blank')}
              />
              <ActionButton
                icon={<FiSettings className="w-5 h-5" />}
                title="Configure AI providers"
                description="Set up OpenAI, Claude, Grok, or local models"
                onClick={() => {
                  onClose();
                  // TODO: Navigate to settings
                }}
              />
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between pt-6 border-t border-border">
            <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
              <input
                type="checkbox"
                className="w-4 h-4"
                onChange={(e) => {
                  localStorage.setItem('cortex:skip-welcome', e.target.checked.toString());
                }}
              />
              Don't show this again
            </label>
            <Button onClick={onClose} variant="outline">
              Skip for now
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: string; title: string; description: string }) {
  return (
    <div className="p-4 bg-surface border border-border rounded-lg text-center">
      <div className="text-3xl mb-2">{icon}</div>
      <h4 className="text-sm font-semibold text-text mb-1">{title}</h4>
      <p className="text-xs text-text-secondary">{description}</p>
    </div>
  );
}

function ActionButton({
  icon,
  title,
  description,
  onClick,
  variant = 'default',
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
  variant?: 'default' | 'primary';
}) {
  return (
    <button
      onClick={onClick}
      className={`
        flex items-start gap-4 p-4 rounded-lg border transition-all text-left
        ${
          variant === 'primary'
            ? 'bg-accent/10 border-accent/50 hover:bg-accent/20'
            : 'bg-surface border-border hover:bg-surface/80'
        }
      `}
    >
      <div className={variant === 'primary' ? 'text-accent' : 'text-text-secondary'}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-text">{title}</div>
        <div className="text-xs text-text-secondary mt-1">{description}</div>
      </div>
    </button>
  );
}
