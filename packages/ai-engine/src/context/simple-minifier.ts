// Minificateur simple : supprime commentaires et whitespace inutile

export class SimpleMinifier {
  minify(content: string): string {
    return content
      .split('\n')
      .map(line => {
        // Supprime les commentaires de ligne
        const withoutLineComment = line.replace(/\/\/.*$/, '');
        // Supprime les espaces en début/fin
        return withoutLineComment.trim();
      })
      .filter(line => line.length > 0) // Supprime les lignes vides
      .join('\n')
      .replace(/\/\*[\s\S]*?\*\//g, ''); // Supprime les commentaires bloc
  }

  estimateSavings(content: string): number {
    const original = content.length;
    const minified = this.minify(content).length;
    return Math.round(((original - minified) / original) * 100);
  }
}
