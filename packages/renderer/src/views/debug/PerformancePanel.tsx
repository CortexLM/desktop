/**
 * Performance Panel - Real-time performance metrics
 */

import * as React from 'react';
import type { PerformanceMetric } from '@cortex-ide/shared/types/debug';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Button } from '../../components/ui/button';
import { FiTrash2 } from 'react-icons/fi';

export function PerformancePanel() {
  const [metrics, setMetrics] = React.useState<PerformanceMetric[]>([]);
  /**
   * `null` = « pas encore choisi », et non un nom de catégorie en dur.
   *
   * La valeur initiale était `'timing'`, une catégorie qu'aucune source ne
   * produit : `performanceMonitor.recordMetric()` n'est appelé qu'avec `'ipc'`,
   * et les catégories du profiler sont `ipc | database | render | memory | cpu |
   * startup | custom`. Le filtre `m.category === selectedCategory` ne retenait
   * donc jamais rien et le panneau s'ouvrait sur « No performance data » alors
   * que des mesures existaient — le graphique restait vide jusqu'à ce que
   * l'utilisateur devine qu'il devait changer la liste déroulante. `'timing'`
   * n'apparaît que dans des fichiers de test.
   *
   * La catégorie effective est dérivée plus bas : premier élément disponible
   * tant que l'utilisateur n'a rien choisi.
   */
  const [selectedCategory, setSelectedCategory] = React.useState<string | null>(null);

  React.useEffect(() => {
    loadMetrics();
    const interval = setInterval(loadMetrics, 2000);
    return () => clearInterval(interval);
  }, []);

  const loadMetrics = async () => {
    try {
      const result = await window.electron.invoke<PerformanceMetric[]>(
        'debug:get-metrics',
        undefined,
        500
      );
      setMetrics(result);
    } catch (error) {
      console.error('Failed to load metrics:', error);
    }
  };

  const handleClear = async () => {
    try {
      await window.electron.invoke('debug:clear-metrics');
      setMetrics([]);
    } catch (error) {
      console.error('Failed to clear metrics:', error);
    }
  };

  // Group metrics by category
  const categories = React.useMemo(() => {
    const cats = new Set(metrics.map(m => m.category));
    return Array.from(cats);
  }, [metrics]);

  /**
   * Catégorie réellement affichée.
   *
   * Le choix explicite de l'utilisateur gagne, mais seulement s'il existe encore
   * dans les données : une catégorie qui disparaît (après un Clear, ou parce que
   * la fenêtre de mesures a défilé) ne doit pas laisser le panneau bloqué sur un
   * filtre qui ne correspond à rien. Sinon, la première catégorie disponible.
   */
  const effectiveCategory =
    selectedCategory && categories.includes(selectedCategory)
      ? selectedCategory
      : categories[0] ?? '';

  // Prepare chart data
  const chartData = React.useMemo(() => {
    const filtered = metrics.filter(m => m.category === effectiveCategory);
    
    // Group by name
    const byName = new Map<string, PerformanceMetric[]>();
    for (const metric of filtered) {
      if (!byName.has(metric.name)) {
        byName.set(metric.name, []);
      }
      byName.get(metric.name)!.push(metric);
    }

    // Take last 50 data points per metric
    const names = Array.from(byName.keys());
    // Une ligne de graphe : l'abscisse plus une valeur par métrique tracée.
    type ChartPoint = { index: number } & Record<string, number>;
    const data: ChartPoint[] = [];
    
    const maxLength = Math.max(...Array.from(byName.values()).map(m => m.length));
    const limit = Math.min(maxLength, 50);
    
    for (let i = Math.max(0, maxLength - limit); i < maxLength; i++) {
      const point = { index: i } as ChartPoint;
      for (const name of names) {
        const metricData = byName.get(name)!;
        if (i < metricData.length) {
          point[name] = metricData[i].value;
        }
      }
      data.push(point);
    }
    
    return { data, names };
  }, [metrics, effectiveCategory]);

  // Calculate stats
  const stats = React.useMemo(() => {
    const result: Record<string, { min: number; max: number; avg: number; count: number }> = {};
    
    const filtered = metrics.filter(m => m.category === effectiveCategory);
    const byName = new Map<string, number[]>();
    
    for (const metric of filtered) {
      if (!byName.has(metric.name)) {
        byName.set(metric.name, []);
      }
      byName.get(metric.name)!.push(metric.value);
    }
    
    for (const [name, values] of byName) {
      result[name] = {
        min: Math.min(...values),
        max: Math.max(...values),
        avg: values.reduce((a, b) => a + b, 0) / values.length,
        count: values.length
      };
    }
    
    return result;
  }, [metrics, effectiveCategory]);

  const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="h-12 border-b border-border flex items-center gap-2 px-3 bg-background">
        <span className="text-sm text-text-secondary">Category:</span>
        <select
          value={effectiveCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="h-8 px-2 text-sm bg-surface border border-border rounded-sm"
          aria-label="Metric category"
          data-testid="metric-category"
        >
          {/* Aucune catégorie : une liste vide rendrait un `<select>` sans option
              et sans explication. */}
          {categories.length === 0 ? (
            <option value="">No categories</option>
          ) : (
            categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))
          )}
        </select>

        <div className="flex-1" />

        <Button variant="ghost" size="sm" onClick={handleClear} className="h-8">
          <FiTrash2 className="w-4 h-4" />
        </Button>
      </div>

      <div className="flex-1 flex">
        {/* Chart */}
        <div className="flex-1 p-4">
          {chartData.data.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData.data}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis dataKey="index" stroke="#666" />
                <YAxis stroke="#666" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1a1a1a',
                    border: '1px solid #333',
                    borderRadius: '4px'
                  }}
                />
                <Legend />
                {chartData.names.map((name, i) => (
                  <Line
                    key={name}
                    type="monotone"
                    dataKey={name}
                    stroke={colors[i % colors.length]}
                    dot={false}
                    strokeWidth={2}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          ) : (
            /* Un état vide doit dire pourquoi il est vide : « rien n'est
               mesuré » et « la catégorie affichée est vide » demandent deux
               actions différentes de la part du lecteur. */
            <div
              className="flex items-center justify-center h-full text-text-secondary"
              data-testid="performance-empty"
            >
              {metrics.length === 0
                ? 'No performance data'
                : `No data in category "${effectiveCategory}"`}
            </div>
          )}
        </div>

        {/* Stats Sidebar */}
        <div className="w-80 border-l border-border bg-surface overflow-auto">
          <div className="sticky top-0 h-12 border-b border-border flex items-center px-3 bg-background">
            <span className="text-sm font-medium">Statistics</span>
          </div>
          <div className="p-3 space-y-3">
            {Object.entries(stats).map(([name, data], i) => (
              <div key={name} className="p-3 bg-background rounded border border-border">
                <div className="flex items-center gap-2 mb-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: colors[i % colors.length] }}
                  />
                  <span className="text-sm font-medium truncate" title={name}>
                    {name}
                  </span>
                </div>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Min:</span>
                    <span className="text-text">{data.min.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Max:</span>
                    <span className="text-text">{data.max.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Avg:</span>
                    <span className="text-accent font-medium">{data.avg.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Count:</span>
                    <span className="text-text">{data.count}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
