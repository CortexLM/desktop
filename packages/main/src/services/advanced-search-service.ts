/**
 * Advanced Search Service
 * Recherche puissante avec regex, filtres, et replace global
 */

import * as fs from 'fs/promises';
import { glob } from 'glob';

export interface SearchOptions {
  query: string;
  useRegex?: boolean;
  caseSensitive?: boolean;
  wholeWord?: boolean;
  includePatterns?: string[];
  excludePatterns?: string[];
  maxResults?: number;
  contextLines?: number;
}

export interface SearchMatch {
  line: number;
  column: number;
  length: number;
  text: string;
  beforeContext?: string[];
  afterContext?: string[];
}

export interface SearchResult {
  filePath: string;
  matches: SearchMatch[];
  totalMatches: number;
}

export interface ReplaceOptions extends SearchOptions {
  replacement: string;
  dryRun?: boolean;
}

export interface ReplaceResult {
  filePath: string;
  replacements: number;
  preview?: string;
}

export class AdvancedSearchService {
  private searchHistory: string[] = [];
  private maxHistorySize = 50;

  /**
   * Recherche dans les fichiers
   */
  async search(rootPath: string, options: SearchOptions): Promise<SearchResult[]> {
    const {
      query,
      useRegex = false,
      caseSensitive = false,
      wholeWord = false,
      includePatterns = ['**/*'],
      excludePatterns = [
        '**/node_modules/**',
        '**/.git/**',
        '**/dist/**',
        '**/build/**',
        '**/*.min.js',
        '**/*.map',
      ],
      maxResults = 1000,
      contextLines = 0,
    } = options;

    // Ajoute à l'historique
    this.addToHistory(query);

    // Construction du pattern de recherche
    let searchPattern: RegExp;
    try {
      if (useRegex) {
        searchPattern = new RegExp(query, caseSensitive ? 'g' : 'gi');
      } else {
        const escapedQuery = this.escapeRegex(query);
        const pattern = wholeWord ? `\\b${escapedQuery}\\b` : escapedQuery;
        searchPattern = new RegExp(pattern, caseSensitive ? 'g' : 'gi');
      }
    } catch (error) {
      throw new Error(`Invalid regex pattern: ${(error as Error).message}`);
    }

    // Recherche des fichiers
    const files = await this.findFiles(rootPath, includePatterns, excludePatterns);

    // Recherche dans chaque fichier
    const results: SearchResult[] = [];
    let totalResults = 0;

    for (const filePath of files) {
      if (totalResults >= maxResults) break;

      try {
        const result = await this.searchInFile(
          filePath,
          searchPattern,
          contextLines,
          maxResults - totalResults
        );

        if (result.matches.length > 0) {
          results.push(result);
          totalResults += result.matches.length;
        }
      } catch (error) {
        // Skip files that can't be read (binary, permissions, etc.)
        continue;
      }
    }

    return results;
  }

  /**
   * Recherche et remplace dans les fichiers
   */
  async replace(rootPath: string, options: ReplaceOptions): Promise<ReplaceResult[]> {
    const {
      query,
      replacement,
      useRegex = false,
      caseSensitive = false,
      wholeWord = false,
      includePatterns = ['**/*'],
      excludePatterns = [
        '**/node_modules/**',
        '**/.git/**',
        '**/dist/**',
        '**/build/**',
      ],
      dryRun = false,
    } = options;

    // Construction du pattern de recherche
    let searchPattern: RegExp;
    try {
      if (useRegex) {
        searchPattern = new RegExp(query, caseSensitive ? 'g' : 'gi');
      } else {
        const escapedQuery = this.escapeRegex(query);
        const pattern = wholeWord ? `\\b${escapedQuery}\\b` : escapedQuery;
        searchPattern = new RegExp(pattern, caseSensitive ? 'g' : 'gi');
      }
    } catch (error) {
      throw new Error(`Invalid regex pattern: ${(error as Error).message}`);
    }

    // Recherche des fichiers
    const files = await this.findFiles(rootPath, includePatterns, excludePatterns);

    // Replace dans chaque fichier
    const results: ReplaceResult[] = [];

    for (const filePath of files) {
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        const matches = content.match(searchPattern);

        if (matches && matches.length > 0) {
          const newContent = content.replace(searchPattern, replacement);

          if (!dryRun) {
            await fs.writeFile(filePath, newContent, 'utf-8');
          }

          results.push({
            filePath,
            replacements: matches.length,
            preview: dryRun ? this.generatePreview(content, newContent) : undefined,
          });
        }
      } catch (error) {
        // Skip files that can't be read or written
        continue;
      }
    }

    return results;
  }

  /**
   * Recherche dans un fichier spécifique
   */
  private async searchInFile(
    filePath: string,
    pattern: RegExp,
    contextLines: number,
    maxMatches: number
  ): Promise<SearchResult> {
    const content = await fs.readFile(filePath, 'utf-8');
    const lines = content.split('\n');
    const matches: SearchMatch[] = [];

    for (let i = 0; i < lines.length && matches.length < maxMatches; i++) {
      const line = lines[i];
      const lineMatches = [...line.matchAll(pattern)];

      for (const match of lineMatches) {
        if (matches.length >= maxMatches) break;

        const beforeContext = contextLines > 0
          ? lines.slice(Math.max(0, i - contextLines), i)
          : undefined;

        const afterContext = contextLines > 0
          ? lines.slice(i + 1, Math.min(lines.length, i + 1 + contextLines))
          : undefined;

        matches.push({
          line: i + 1,
          column: match.index || 0,
          length: match[0].length,
          text: line,
          beforeContext,
          afterContext,
        });
      }
    }

    return {
      filePath,
      matches,
      totalMatches: matches.length,
    };
  }

  /**
   * Trouve les fichiers correspondant aux patterns
   */
  private async findFiles(
    rootPath: string,
    includePatterns: string[],
    excludePatterns: string[]
  ): Promise<string[]> {
    const allFiles: Set<string> = new Set();

    for (const pattern of includePatterns) {
      const files = await glob(pattern, {
        cwd: rootPath,
        ignore: excludePatterns,
        absolute: true,
        nodir: true,
      });

      files.forEach(file => allFiles.add(file));
    }

    // Filtre les fichiers binaires
    const textFiles: string[] = [];
    for (const file of allFiles) {
      if (await this.isTextFile(file)) {
        textFiles.push(file);
      }
    }

    return textFiles;
  }

  /**
   * Vérifie si un fichier est texte (pas binaire)
   */
  private async isTextFile(filePath: string): Promise<boolean> {
    try {
      const buffer = await fs.readFile(filePath);
      const chunk = buffer.slice(0, 512);

      // Cherche des caractères NULL (indicateur de binaire)
      for (let i = 0; i < chunk.length; i++) {
        if (chunk[i] === 0) {
          return false;
        }
      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Échappe les caractères spéciaux regex
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Génère un preview du remplacement
   */
  private generatePreview(oldContent: string, newContent: string): string {
    const oldLines = oldContent.split('\n');
    const newLines = newContent.split('\n');
    
    let preview = '';
    const maxLines = 10;
    let changedLines = 0;

    for (let i = 0; i < Math.min(oldLines.length, newLines.length) && changedLines < maxLines; i++) {
      if (oldLines[i] !== newLines[i]) {
        preview += `Line ${i + 1}:\n`;
        preview += `- ${oldLines[i]}\n`;
        preview += `+ ${newLines[i]}\n\n`;
        changedLines++;
      }
    }

    if (changedLines >= maxLines) {
      preview += '... (more changes)\n';
    }

    return preview;
  }

  /**
   * Ajoute une recherche à l'historique
   */
  private addToHistory(query: string): void {
    // Supprime les doublons
    this.searchHistory = this.searchHistory.filter(q => q !== query);
    
    // Ajoute au début
    this.searchHistory.unshift(query);
    
    // Limite la taille
    if (this.searchHistory.length > this.maxHistorySize) {
      this.searchHistory = this.searchHistory.slice(0, this.maxHistorySize);
    }
  }

  /**
   * Récupère l'historique de recherche
   */
  getSearchHistory(): string[] {
    return [...this.searchHistory];
  }

  /**
   * Efface l'historique de recherche
   */
  clearSearchHistory(): void {
    this.searchHistory = [];
  }
}

// Instance singleton
let advancedSearchService: AdvancedSearchService | null = null;

export function getAdvancedSearchService(): AdvancedSearchService {
  if (!advancedSearchService) {
    advancedSearchService = new AdvancedSearchService();
  }
  return advancedSearchService;
}
