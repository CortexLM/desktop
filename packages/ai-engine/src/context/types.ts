// Types essentiels pour le contexte sémantique

export interface ContextChunk {
  id: string;
  content: string;
  tokens: number;
  type: 'code' | 'documentation' | 'conversation';
  metadata: ChunkMetadata;
}

export interface ChunkMetadata {
  filePath?: string;
  language?: string;
  startLine?: number;
  endLine?: number;
  functionName?: string;
  className?: string;
  lastModified?: Date;
  importance?: number;
}

export interface SemanticChunkingConfig {
  maxChunkSize: number;
  minChunkSize: number;
  preserveBoundaries: boolean;
  includeDependencies: boolean;
  maxDependencyDepth: number;
}
