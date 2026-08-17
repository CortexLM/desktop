/**
 * Types IPC - Filesystem
 */

export interface ReadFileRequest {
  path: string;
  encoding?: BufferEncoding;
}

export interface ReadFileResponse {
  content: string;
  stats: {
    size: number;
    mtime: number;
    ctime: number;
  };
}

export interface WriteFileRequest {
  path: string;
  content: string;
  encoding?: BufferEncoding;
}

export interface WriteFileResponse {
  success: boolean;
  bytesWritten: number;
}

export interface ReadDirRequest {
  path: string;
  recursive?: boolean;
}

export interface FileEntry {
  name: string;
  path: string;
  type: 'file' | 'directory' | 'symlink';
  size: number;
  mtime: number;
}

export interface ReadDirResponse {
  entries: FileEntry[];
}

export interface WatchFileRequest {
  path: string;
  watchId: string;
}

export interface FileChangeEvent {
  type: 'file-change';
  watchId: string;
  event: 'add' | 'change' | 'unlink';
  path: string;
}
