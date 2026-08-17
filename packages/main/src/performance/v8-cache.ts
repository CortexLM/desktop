/**
 * V8 Code Caching - Améliore le temps de démarrage en cachant le code compilé
 */

import { app } from 'electron';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';

interface CachedScript {
  path: string;
  hash: string;
  cachedData: Buffer;
  timestamp: number;
}

class V8CodeCache {
  private cacheDir: string;
  private maxCacheAge = 7 * 24 * 60 * 60 * 1000; // 7 days

  constructor() {
    this.cacheDir = path.join(app.getPath('userData'), 'v8-cache');
  }

  /**
   * Initialize cache directory
   */
  async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.cacheDir, { recursive: true });
      await this.cleanOldCache();
    } catch (error) {
      console.error('[V8Cache] Failed to initialize:', error);
    }
  }

  /**
   * Get cache path for a script
   */
  private getCachePath(scriptPath: string): string {
    const hash = crypto.createHash('sha256').update(scriptPath).digest('hex');
    return path.join(this.cacheDir, `${hash}.cache`);
  }

  /**
   * Calculate file hash
   */
  private async calculateHash(filePath: string): Promise<string> {
    const content = await fs.readFile(filePath);
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Get cached data for a script
   */
  async getCachedData(scriptPath: string): Promise<Buffer | null> {
    try {
      const cachePath = this.getCachePath(scriptPath);
      const cacheExists = await fs.access(cachePath).then(() => true).catch(() => false);
      
      if (!cacheExists) return null;

      const cacheContent = await fs.readFile(cachePath, 'utf-8');
      const cached: CachedScript = JSON.parse(cacheContent);

      // Verify hash
      const currentHash = await this.calculateHash(scriptPath);
      if (cached.hash !== currentHash) {
        await fs.unlink(cachePath);
        return null;
      }

      // Check age
      if (Date.now() - cached.timestamp > this.maxCacheAge) {
        await fs.unlink(cachePath);
        return null;
      }

      return Buffer.from(cached.cachedData);
    } catch (error) {
      return null;
    }
  }

  /**
   * Save cached data for a script
   */
  async saveCachedData(scriptPath: string, cachedData: Buffer): Promise<void> {
    try {
      const cachePath = this.getCachePath(scriptPath);
      const hash = await this.calculateHash(scriptPath);

      const cached: CachedScript = {
        path: scriptPath,
        hash,
        // A Buffer is already the declared type here; JSON.stringify turns it
        // into `{ type: 'Buffer', data: [...] }` on disk, which the read path
        // rehydrates via `Buffer.from()`.
        cachedData,
        timestamp: Date.now()
      };

      await fs.writeFile(cachePath, JSON.stringify(cached));
    } catch (error) {
      console.error('[V8Cache] Failed to save cache:', error);
    }
  }

  /**
   * Clean old cache files
   */
  async cleanOldCache(): Promise<void> {
    try {
      const files = await fs.readdir(this.cacheDir);
      const now = Date.now();

      for (const file of files) {
        const filePath = path.join(this.cacheDir, file);
        try {
          const content = await fs.readFile(filePath, 'utf-8');
          const cached: CachedScript = JSON.parse(content);
          
          if (now - cached.timestamp > this.maxCacheAge) {
            await fs.unlink(filePath);
          }
        } catch {
          // Invalid cache file, delete it
          await fs.unlink(filePath);
        }
      }
    } catch (error) {
      console.error('[V8Cache] Failed to clean cache:', error);
    }
  }

  /**
   * Clear all cache
   */
  async clearCache(): Promise<void> {
    try {
      const files = await fs.readdir(this.cacheDir);
      await Promise.all(
        files.map(file => fs.unlink(path.join(this.cacheDir, file)))
      );
    } catch (error) {
      console.error('[V8Cache] Failed to clear cache:', error);
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{
    totalFiles: number;
    totalSize: number;
    oldestFile: number;
    newestFile: number;
  }> {
    try {
      const files = await fs.readdir(this.cacheDir);
      let totalSize = 0;
      let oldestFile = Date.now();
      let newestFile = 0;

      for (const file of files) {
        const filePath = path.join(this.cacheDir, file);
        const stats = await fs.stat(filePath);
        totalSize += stats.size;

        try {
          const content = await fs.readFile(filePath, 'utf-8');
          const cached: CachedScript = JSON.parse(content);
          oldestFile = Math.min(oldestFile, cached.timestamp);
          newestFile = Math.max(newestFile, cached.timestamp);
        } catch {
          // Ignore invalid files
        }
      }

      return {
        totalFiles: files.length,
        totalSize,
        oldestFile: oldestFile === Date.now() ? 0 : oldestFile,
        newestFile
      };
    } catch (error) {
      return {
        totalFiles: 0,
        totalSize: 0,
        oldestFile: 0,
        newestFile: 0
      };
    }
  }
}

export const v8Cache = new V8CodeCache();
