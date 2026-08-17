import { describe, it, expect } from 'vitest';
import { ErrorCode, getErrorCode } from '../shared/error-codes';

describe('getErrorCode', () => {
  it('maps ENOENT to FILE_NOT_FOUND', () => {
    expect(getErrorCode(new Error('ENOENT: no such file'))).toBe(ErrorCode.FILE_NOT_FOUND);
  });

  it('maps "not found" to FILE_NOT_FOUND', () => {
    expect(getErrorCode(new Error('Config not found'))).toBe(ErrorCode.FILE_NOT_FOUND);
  });

  it('maps EACCES to PERMISSION_DENIED', () => {
    expect(getErrorCode(new Error('EACCES: denied'))).toBe(ErrorCode.PERMISSION_DENIED);
  });

  it('maps "permission" to PERMISSION_DENIED', () => {
    expect(getErrorCode(new Error('Permission refused'))).toBe(ErrorCode.PERMISSION_DENIED);
  });

  it('maps git failures to GIT_ERROR', () => {
    expect(getErrorCode(new Error('git command failed'))).toBe(ErrorCode.GIT_ERROR);
  });

  it('maps automation failures to AUTOMATION_ERROR', () => {
    expect(getErrorCode(new Error('automation run failed'))).toBe(ErrorCode.AUTOMATION_ERROR);
  });

  it('gives "not found" precedence over the automation keyword', () => {
    // Documente l'ordre des règles : `Automation 42 not found` est d'abord un 404
    expect(getErrorCode(new Error('Automation 42 not found'))).toBe(ErrorCode.FILE_NOT_FOUND);
  });

  it('is case insensitive', () => {
    expect(getErrorCode(new Error('EnOeNt'))).toBe(ErrorCode.FILE_NOT_FOUND);
    expect(getErrorCode(new Error('GIT push rejected'))).toBe(ErrorCode.GIT_ERROR);
  });

  it('falls back to UNKNOWN_ERROR', () => {
    expect(getErrorCode(new Error('something odd'))).toBe(ErrorCode.UNKNOWN_ERROR);
  });

  it('handles an empty message', () => {
    expect(getErrorCode(new Error(''))).toBe(ErrorCode.UNKNOWN_ERROR);
  });
});
