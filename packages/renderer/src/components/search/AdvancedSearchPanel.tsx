/**
 * AdvancedSearchPanel - Recherche avancée avec regex et replace
 */

import { useState, useCallback, useEffect } from 'react';
import { Search, Replace, History, FileText, ChevronRight, ChevronDown } from 'lucide-react';

interface SearchMatch {
  line: number;
  column: number;
  length: number;
  text: string;
  beforeContext?: string[];
  afterContext?: string[];
}

interface SearchResult {
  filePath: string;
  matches: SearchMatch[];
  totalMatches: number;
}

interface ReplaceResult {
  filePath: string;
  replacements: number;
  preview?: string;
}

export interface AdvancedSearchPanelProps {
  className?: string;
  workspacePath?: string;
}

export function AdvancedSearchPanel({ className = '', workspacePath }: AdvancedSearchPanelProps) {
  const [query, setQuery] = useState('');
  const [replacement, setReplacement] = useState('');
  const [useRegex, setUseRegex] = useState(false);
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [includePattern, setIncludePattern] = useState('**/*');
  const [excludePattern, setExcludePattern] = useState('node_modules, .git, dist');
  const [showReplace, setShowReplace] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [replaceResults, setReplaceResults] = useState<ReplaceResult[]>([]);
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    loadSearchHistory();
  }, []);

  const loadSearchHistory = async () => {
    try {
      const response = await window.ipc.invoke('search:get-history');
      if (response.success) {
        setSearchHistory(response.data.history);
      }
    } catch (error) {
      console.error('Failed to load search history:', error);
    }
  };

  const handleSearch = useCallback(async () => {
    if (!query.trim() || !workspacePath) return;

    setIsSearching(true);
    setResults([]);
    setReplaceResults([]);

    try {
      const response = await window.ipc.invoke('search:find', {
        rootPath: workspacePath,
        query,
        useRegex,
        caseSensitive,
        wholeWord,
        includePatterns: includePattern.split(',').map(p => p.trim()),
        excludePatterns: excludePattern.split(',').map(p => p.trim()),
        maxResults: 1000,
        contextLines: 2,
      });

      if (response.success) {
        setResults(response.data.results);
      }
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setIsSearching(false);
    }
  }, [query, workspacePath, useRegex, caseSensitive, wholeWord, includePattern, excludePattern]);

  const handleReplace = useCallback(async (dryRun: boolean = true) => {
    if (!query.trim() || !workspacePath) return;

    setIsSearching(true);

    try {
      const response = await window.ipc.invoke('search:replace', {
        rootPath: workspacePath,
        query,
        replacement,
        useRegex,
        caseSensitive,
        wholeWord,
        includePatterns: includePattern.split(',').map(p => p.trim()),
        excludePatterns: excludePattern.split(',').map(p => p.trim()),
        dryRun,
      });

      if (response.success) {
        setReplaceResults(response.data.results);
        
        if (!dryRun) {
          // Refresh search results after replace
          await handleSearch();
        }
      }
    } catch (error) {
      console.error('Replace failed:', error);
    } finally {
      setIsSearching(false);
    }
  }, [query, replacement, workspacePath, useRegex, caseSensitive, wholeWord, includePattern, excludePattern, handleSearch]);

  const toggleFileExpand = (filePath: string) => {
    setExpandedFiles(prev => {
      const next = new Set(prev);
      if (next.has(filePath)) {
        next.delete(filePath);
      } else {
        next.add(filePath);
      }
      return next;
    });
  };

  const openFile = async (filePath: string, line?: number) => {
    try {
      await window.ipc.invoke('editor:open-file', {
        path: filePath,
        line,
      });
    } catch (error) {
      console.error('Failed to open file:', error);
    }
  };

  const totalMatches = results.reduce((sum, r) => sum + r.totalMatches, 0);
  const totalFiles = results.length;

  return (
    <div className={`flex flex-col h-full bg-[#0a0a0a] ${className}`}>
      {/* Search header */}
      <div className="p-4 border-b border-neutral-800">
        <div className="flex items-center gap-2 mb-3">
          <Search className="w-5 h-5 text-neutral-400" />
          <h2 className="text-sm font-medium text-neutral-200">Advanced Search</h2>
        </div>

        {/* Search input */}
        <div className="space-y-2">
          <div className="relative">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  handleSearch();
                }
              }}
              placeholder="Search query..."
              className="w-full px-3 py-2 pr-8 bg-neutral-900 border border-neutral-700 rounded-md text-sm focus:outline-none focus:border-blue-500"
            />
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-neutral-700 rounded"
              title="Search history"
            >
              <History className="w-4 h-4 text-neutral-400" />
            </button>

            {/* History dropdown */}
            {showHistory && searchHistory.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-neutral-900 border border-neutral-700 rounded-md shadow-lg z-10 max-h-48 overflow-y-auto">
                {searchHistory.map((item, index) => (
                  <button
                    key={index}
                    onClick={() => {
                      setQuery(item);
                      setShowHistory(false);
                    }}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-neutral-800 transition-colors"
                  >
                    {item}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Replace input */}
          {showReplace && (
            <input
              type="text"
              value={replacement}
              onChange={(e) => setReplacement(e.target.value)}
              placeholder="Replace with..."
              className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-md text-sm focus:outline-none focus:border-blue-500"
            />
          )}

          {/* Options */}
          <div className="flex items-center gap-3 text-xs">
            <label className="flex items-center gap-1 cursor-pointer">
              <input
                type="checkbox"
                checked={useRegex}
                onChange={(e) => setUseRegex(e.target.checked)}
                className="rounded"
              />
              <span className="text-neutral-400">Regex</span>
            </label>
            <label className="flex items-center gap-1 cursor-pointer">
              <input
                type="checkbox"
                checked={caseSensitive}
                onChange={(e) => setCaseSensitive(e.target.checked)}
                className="rounded"
              />
              <span className="text-neutral-400">Case</span>
            </label>
            <label className="flex items-center gap-1 cursor-pointer">
              <input
                type="checkbox"
                checked={wholeWord}
                onChange={(e) => setWholeWord(e.target.checked)}
                className="rounded"
              />
              <span className="text-neutral-400">Word</span>
            </label>
          </div>

          {/* File patterns */}
          <div className="space-y-1">
            <input
              type="text"
              value={includePattern}
              onChange={(e) => setIncludePattern(e.target.value)}
              placeholder="Include files..."
              className="w-full px-3 py-1.5 bg-neutral-900 border border-neutral-700 rounded text-xs focus:outline-none focus:border-blue-500"
            />
            <input
              type="text"
              value={excludePattern}
              onChange={(e) => setExcludePattern(e.target.value)}
              placeholder="Exclude files..."
              className="w-full px-3 py-1.5 bg-neutral-900 border border-neutral-700 rounded text-xs focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleSearch}
              disabled={isSearching || !query.trim()}
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-neutral-700 disabled:text-neutral-500 text-white text-sm rounded-md transition-colors flex items-center justify-center gap-2"
            >
              <Search className="w-4 h-4" />
              Search
            </button>
            <button
              onClick={() => setShowReplace(!showReplace)}
              className={`px-4 py-2 ${showReplace ? 'bg-neutral-700' : 'bg-neutral-800'} hover:bg-neutral-700 text-white text-sm rounded-md transition-colors flex items-center gap-2`}
            >
              <Replace className="w-4 h-4" />
            </button>
          </div>

          {/* Replace actions */}
          {showReplace && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleReplace(true)}
                disabled={isSearching || !query.trim()}
                className="flex-1 px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 disabled:bg-neutral-900 disabled:text-neutral-600 text-sm rounded transition-colors"
              >
                Preview
              </button>
              <button
                onClick={() => handleReplace(false)}
                disabled={isSearching || !query.trim()}
                className="flex-1 px-3 py-1.5 bg-orange-600 hover:bg-orange-700 disabled:bg-neutral-900 disabled:text-neutral-600 text-white text-sm rounded transition-colors"
              >
                Replace All
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto">
        {isSearching && (
          <div className="flex items-center justify-center h-32 text-neutral-500 text-sm">
            Searching...
          </div>
        )}

        {!isSearching && results.length === 0 && query && (
          <div className="flex items-center justify-center h-32 text-neutral-500 text-sm">
            No results found
          </div>
        )}

        {!isSearching && !query && (
          <div className="flex flex-col items-center justify-center h-32 text-neutral-500 text-sm">
            <Search className="w-8 h-8 mb-2 opacity-50" />
            <p>Enter a search query to begin</p>
          </div>
        )}

        {/* Search results */}
        {!isSearching && results.length > 0 && (
          <div>
            <div className="px-4 py-2 bg-[#141414] border-b border-neutral-800 text-xs text-neutral-400">
              {totalMatches} {totalMatches === 1 ? 'match' : 'matches'} in {totalFiles} {totalFiles === 1 ? 'file' : 'files'}
            </div>

            {results.map((result) => (
              <div key={result.filePath} className="border-b border-neutral-800">
                <button
                  onClick={() => toggleFileExpand(result.filePath)}
                  className="w-full flex items-center gap-2 px-4 py-2 hover:bg-neutral-900 transition-colors text-left"
                >
                  {expandedFiles.has(result.filePath) ? (
                    <ChevronDown className="w-4 h-4 text-neutral-400" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-neutral-400" />
                  )}
                  <FileText className="w-4 h-4 text-blue-400" />
                  <span className="flex-1 text-sm truncate">{result.filePath.split('/').pop()}</span>
                  <span className="text-xs text-neutral-500">{result.totalMatches}</span>
                </button>

                {expandedFiles.has(result.filePath) && (
                  <div className="bg-[#0a0a0a]">
                    {result.matches.map((match, idx) => (
                      <button
                        key={idx}
                        onClick={() => openFile(result.filePath, match.line)}
                        className="w-full px-4 py-2 pl-12 hover:bg-neutral-900 transition-colors text-left"
                      >
                        <div className="flex items-start gap-3">
                          <span className="text-xs text-neutral-500 font-mono">{match.line}</span>
                          <span className="flex-1 text-xs font-mono text-neutral-300 break-all">
                            {match.text}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Replace results */}
        {!isSearching && replaceResults.length > 0 && (
          <div className="mt-4">
            <div className="px-4 py-2 bg-[#141414] border-b border-neutral-800 text-xs text-neutral-400">
              Replace preview
            </div>

            {replaceResults.map((result) => (
              <div key={result.filePath} className="border-b border-neutral-800 px-4 py-2">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="w-4 h-4 text-orange-400" />
                  <span className="text-sm">{result.filePath.split('/').pop()}</span>
                  <span className="text-xs text-neutral-500">{result.replacements} changes</span>
                </div>
                {result.preview && (
                  <pre className="text-xs font-mono text-neutral-400 overflow-x-auto">
                    {result.preview}
                  </pre>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
