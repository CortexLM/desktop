/**
 * Chat Export Service
 * Exporte les conversations en différents formats
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { Message, Session } from '@cortex-ide/shared';

export interface ExportOptions {
  format: 'markdown' | 'json' | 'html' | 'text';
  includeMetadata?: boolean;
  includeTimestamps?: boolean;
  prettify?: boolean;
}

export interface ExportResult {
  content: string;
  filename: string;
  size: number;
}

/**
 * Payload JSON produit par l'export d'une conversation.
 *
 * La session est complète avec `includeMetadata`, réduite à son identité sinon.
 */
interface ExportedConversation {
  session: Session | Pick<Session, 'id' | 'title'>;
  messages: Array<{
    role: Message['role'];
    content: string;
    createdAt: Message['createdAt'];
    metadata?: Message['metadata'];
  }>;
}

export class ChatExportService {
  /**
   * Exporte une session complète
   */
  async exportSession(
    session: Session,
    messages: Message[],
    options: ExportOptions
  ): Promise<ExportResult> {
    const { format, includeMetadata = true, includeTimestamps = true, prettify = true } = options;

    let content: string;
    let extension: string;

    switch (format) {
      case 'markdown':
        content = this.exportToMarkdown(session, messages, includeMetadata, includeTimestamps);
        extension = 'md';
        break;
      case 'json':
        content = this.exportToJSON(session, messages, includeMetadata, prettify);
        extension = 'json';
        break;
      case 'html':
        content = this.exportToHTML(session, messages, includeMetadata, includeTimestamps);
        extension = 'html';
        break;
      case 'text':
        content = this.exportToText(session, messages, includeTimestamps);
        extension = 'txt';
        break;
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }

    const filename = this.generateFilename(session, extension);
    const size = Buffer.byteLength(content, 'utf8');

    return { content, filename, size };
  }

  /**
   * Exporte au format Markdown
   */
  private exportToMarkdown(
    session: Session,
    messages: Message[],
    includeMetadata: boolean,
    includeTimestamps: boolean
  ): string {
    let md = `# ${session.title}\n\n`;

    if (includeMetadata) {
      md += `**Model:** ${session.model}\n`;
      md += `**Created:** ${new Date(session.createdAt).toISOString()}\n`;
      md += `**Messages:** ${messages.length}\n\n`;
      md += `---\n\n`;
    }

    for (const message of messages) {
      const role = message.role === 'user' ? '👤 User' : '🤖 Assistant';
      const timestamp = includeTimestamps 
        ? ` (${new Date(message.createdAt).toLocaleString()})`
        : '';

      md += `## ${role}${timestamp}\n\n`;
      md += `${message.content}\n\n`;
      md += `---\n\n`;
    }

    return md;
  }

  /**
   * Exporte au format JSON
   */
  private exportToJSON(
    session: Session,
    messages: Message[],
    includeMetadata: boolean,
    prettify: boolean
  ): string {
    const data: ExportedConversation = {
      session: includeMetadata ? session : { id: session.id, title: session.title },
      messages: messages.map(m => ({
        role: m.role,
        content: m.content,
        createdAt: m.createdAt,
        ...(includeMetadata && m.metadata ? { metadata: m.metadata } : {}),
      })),
    };

    return prettify ? JSON.stringify(data, null, 2) : JSON.stringify(data);
  }

  /**
   * Exporte au format HTML
   */
  private exportToHTML(
    session: Session,
    messages: Message[],
    includeMetadata: boolean,
    includeTimestamps: boolean
  ): string {
    let html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${this.escapeHtml(session.title)}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      color: #e5e5e5;
      background: #0a0a0a;
      padding: 2rem;
      max-width: 900px;
      margin: 0 auto;
    }
    h1 {
      font-size: 2rem;
      margin-bottom: 1rem;
      color: #fff;
    }
    .metadata {
      background: #141414;
      border: 1px solid #262626;
      border-radius: 8px;
      padding: 1rem;
      margin-bottom: 2rem;
      font-size: 0.875rem;
      color: #a3a3a3;
    }
    .metadata div { margin-bottom: 0.5rem; }
    .metadata div:last-child { margin-bottom: 0; }
    .metadata strong { color: #e5e5e5; }
    .message {
      background: #141414;
      border: 1px solid #262626;
      border-radius: 8px;
      padding: 1.5rem;
      margin-bottom: 1rem;
    }
    .message-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 1rem;
      padding-bottom: 0.75rem;
      border-bottom: 1px solid #262626;
    }
    .message-role {
      font-weight: 600;
      font-size: 0.875rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .message-role.user { color: #60a5fa; }
    .message-role.assistant { color: #22c55e; }
    .message-timestamp {
      font-size: 0.75rem;
      color: #737373;
    }
    .message-content {
      white-space: pre-wrap;
      word-break: break-word;
    }
    pre {
      background: #0a0a0a;
      border: 1px solid #262626;
      border-radius: 4px;
      padding: 1rem;
      overflow-x: auto;
      margin: 0.5rem 0;
    }
    code {
      background: #0a0a0a;
      padding: 0.125rem 0.25rem;
      border-radius: 3px;
      font-size: 0.875em;
      font-family: 'Courier New', monospace;
    }
  </style>
</head>
<body>
  <h1>${this.escapeHtml(session.title)}</h1>
`;

    if (includeMetadata) {
      html += `
  <div class="metadata">
    <div><strong>Model:</strong> ${this.escapeHtml(session.model)}</div>
    <div><strong>Created:</strong> ${new Date(session.createdAt).toLocaleString()}</div>
    <div><strong>Messages:</strong> ${messages.length}</div>
  </div>
`;
    }

    for (const message of messages) {
      const roleClass = message.role === 'user' ? 'user' : 'assistant';
      const roleIcon = message.role === 'user' ? '👤' : '🤖';
      const roleName = message.role === 'user' ? 'User' : 'Assistant';
      const timestamp = includeTimestamps 
        ? `<span class="message-timestamp">${new Date(message.createdAt).toLocaleString()}</span>`
        : '';

      html += `
  <div class="message">
    <div class="message-header">
      <span class="message-role ${roleClass}">${roleIcon} ${roleName}</span>
      ${timestamp}
    </div>
    <div class="message-content">${this.escapeHtml(message.content)}</div>
  </div>
`;
    }

    html += `
</body>
</html>`;

    return html;
  }

  /**
   * Exporte au format texte brut
   */
  private exportToText(
    session: Session,
    messages: Message[],
    includeTimestamps: boolean
  ): string {
    let text = `${session.title}\n`;
    text += `${'='.repeat(session.title.length)}\n\n`;

    for (const message of messages) {
      const role = message.role === 'user' ? 'USER' : 'ASSISTANT';
      const timestamp = includeTimestamps 
        ? ` [${new Date(message.createdAt).toLocaleString()}]`
        : '';

      text += `${role}${timestamp}:\n`;
      text += `${message.content}\n\n`;
      text += `${'-'.repeat(80)}\n\n`;
    }

    return text;
  }

  /**
   * Sauvegarde l'export dans un fichier
   */
  async saveToFile(exportResult: ExportResult, outputPath: string): Promise<string> {
    const fullPath = path.join(outputPath, exportResult.filename);
    await fs.writeFile(fullPath, exportResult.content, 'utf-8');
    return fullPath;
  }

  /**
   * Génère un nom de fichier pour l'export
   */
  private generateFilename(session: Session, extension: string): string {
    const sanitized = session.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 50);

    const timestamp = new Date(session.createdAt).toISOString().split('T')[0];
    return `chat-${sanitized}-${timestamp}.${extension}`;
  }

  /**
   * Échappe les caractères HTML
   */
  private escapeHtml(text: string): string {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    };
    return text.replace(/[&<>"']/g, m => map[m]);
  }

  /**
   * Exporte plusieurs sessions en un seul fichier
   */
  async exportMultipleSessions(
    sessions: Array<{ session: Session; messages: Message[] }>,
    options: ExportOptions
  ): Promise<ExportResult> {
    const { format } = options;

    if (format === 'json') {
      const data = sessions.map(({ session, messages }) => ({
        session,
        messages,
      }));

      const content = options.prettify 
        ? JSON.stringify(data, null, 2)
        : JSON.stringify(data);

      return {
        content,
        filename: `chat-export-${Date.now()}.json`,
        size: Buffer.byteLength(content, 'utf8'),
      };
    }

    // Pour les autres formats, concatène les exports
    let combinedContent = '';
    
    for (const { session, messages } of sessions) {
      const result = await this.exportSession(session, messages, options);
      combinedContent += result.content;
      
      if (format === 'markdown') {
        combinedContent += '\n\n---\n\n';
      } else if (format === 'text') {
        combinedContent += '\n\n' + '='.repeat(80) + '\n\n';
      }
    }

    const extension = format === 'html' ? 'html' : format === 'markdown' ? 'md' : 'txt';

    return {
      content: combinedContent,
      filename: `chat-export-${Date.now()}.${extension}`,
      size: Buffer.byteLength(combinedContent, 'utf8'),
    };
  }
}

// Instance singleton
let chatExportService: ChatExportService | null = null;

export function getChatExportService(): ChatExportService {
  if (!chatExportService) {
    chatExportService = new ChatExportService();
  }
  return chatExportService;
}
