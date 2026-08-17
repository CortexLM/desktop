/**
 * ChatExportButton - Bouton pour exporter les conversations
 */

import { useState } from 'react';
import { Download, FileText, FileCode, FileJson, File } from 'lucide-react';

export interface ChatExportButtonProps {
  sessionId: string;
  sessionTitle?: string;
  className?: string;
}

export function ChatExportButton({ sessionId, sessionTitle = 'Chat', className = '' }: ChatExportButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [format, setFormat] = useState<'markdown' | 'json' | 'html' | 'text'>('markdown');

  const handleExport = async () => {
    setIsExporting(true);
    
    try {
      const response = await window.ipc.invoke('chat:export', {
        sessionId,
        format,
        includeMetadata: true,
        includeTimestamps: true,
        prettify: true,
      });

      if (response.success) {
        // Téléchargement via le navigateur
        const blob = new Blob([response.data.content], { 
          type: format === 'json' ? 'application/json' : 'text/plain' 
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = response.data.filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        setIsOpen(false);
      }
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setIsExporting(false);
    }
  };

  const formats = [
    { value: 'markdown', label: 'Markdown', icon: FileText, desc: 'Clean markdown format' },
    { value: 'html', label: 'HTML', icon: FileCode, desc: 'Styled HTML page' },
    { value: 'json', label: 'JSON', icon: FileJson, desc: 'Machine-readable format' },
    { value: 'text', label: 'Plain Text', icon: File, desc: 'Simple text file' },
  ] as const;

  return (
    <div className={`relative ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 hover:bg-neutral-800 rounded-md transition-colors"
        title="Export conversation"
      >
        <Download className="w-4 h-4 text-neutral-400" />
      </button>

      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute top-full right-0 mt-2 w-72 bg-neutral-900 border border-neutral-800 rounded-lg shadow-lg z-20 overflow-hidden">
            <div className="px-4 py-3 border-b border-neutral-800">
              <h3 className="text-sm font-medium text-neutral-200">Export Conversation</h3>
              <p className="text-xs text-neutral-500 mt-1">{sessionTitle}</p>
            </div>

            <div className="p-3 space-y-2">
              {formats.map((fmt) => {
                const Icon = fmt.icon;
                return (
                  <button
                    key={fmt.value}
                    onClick={() => setFormat(fmt.value)}
                    className={`w-full flex items-start gap-3 p-3 rounded-lg transition-colors ${
                      format === fmt.value
                        ? 'bg-blue-600 text-white'
                        : 'bg-neutral-800 hover:bg-neutral-700'
                    }`}
                  >
                    <Icon className="w-5 h-5 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 text-left">
                      <div className="text-sm font-medium">{fmt.label}</div>
                      <div className={`text-xs mt-0.5 ${
                        format === fmt.value ? 'text-blue-100' : 'text-neutral-400'
                      }`}>
                        {fmt.desc}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="px-3 pb-3 pt-2">
              <button
                onClick={handleExport}
                disabled={isExporting}
                className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-neutral-700 disabled:text-neutral-500 text-white text-sm rounded-md transition-colors flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" />
                {isExporting ? 'Exporting...' : 'Export'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
