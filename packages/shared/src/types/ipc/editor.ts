/**
 * Types IPC - Editor
 */

export interface OpenFileRequest {
  path: string;
  workspaceId?: string;
}

export interface OpenFileResponse {
  content: string;
  language: string;
  stats: {
    size: number;
    mtime: number;
  };
}

export interface SaveFileRequest {
  path: string;
  content: string;
}

export interface SaveFileResponse {
  success: boolean;
  mtime: number;
}

export interface FormatDocumentRequest {
  path: string;
  content: string;
  language: string;
}

export interface FormatDocumentResponse {
  formatted: string;
  changes: Array<{
    range: { start: number; end: number };
    text: string;
  }>;
}
