/**
 * Error codes partagés par tous les handlers IPC
 */

export enum ErrorCode {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  INVALID_PATH = 'INVALID_PATH',
  GIT_ERROR = 'GIT_ERROR',
  AI_ERROR = 'AI_ERROR',
  TERMINAL_ERROR = 'TERMINAL_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  AUTOMATION_ERROR = 'AUTOMATION_ERROR',
  FORMAT_ERROR = 'FORMAT_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

/**
 * Détermine le code d'erreur approprié à partir du type puis du message d'erreur
 */
export function getErrorCode(error: Error): ErrorCode {
  // Erreurs typées : le nom de la classe est plus fiable que le message
  if (error.name === 'FormatError') {
    return ErrorCode.FORMAT_ERROR;
  }

  // DatabaseError et ses sous-classes (DatabaseConnectionError, ...)
  if (error.name.startsWith('Database')) {
    return ErrorCode.DATABASE_ERROR;
  }

  const message = error.message.toLowerCase();

  if (message.includes('enoent') || message.includes('not found')) {
    return ErrorCode.FILE_NOT_FOUND;
  }

  if (message.includes('eacces') || message.includes('permission')) {
    return ErrorCode.PERMISSION_DENIED;
  }

  if (message.includes('git')) {
    return ErrorCode.GIT_ERROR;
  }

  if (message.includes('automation')) {
    return ErrorCode.AUTOMATION_ERROR;
  }

  return ErrorCode.UNKNOWN_ERROR;
}
