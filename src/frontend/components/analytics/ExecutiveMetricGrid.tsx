import { Activity, AlertTriangle, BookOpen, Gauge, ShieldCheck, Target, Users } from 'lucide-react';
import type { CommandAlert, ExecutiveMetric } from '../../types';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { formatMetricValue, statusClasses, statusText } from './commandDashboardUi';

interface ExecutiveMetricGridProps {
  metrics: ExecutiveMetric[];
  alerts: CommandAlert[];
  selectedId?: string;
  onMetricSelect: (metric: ExecutiveMetric) => void;
  onAlertSelect: (alert: CommandAlert) => void;
}

const metricIcons: Record<string, typeof Users> = {
  'personnel-trained': Users,
  'courses-conducted': BookOpen,
  'capacity-utilization': Gauge,
  'active-courses': Activity,
  'upcoming-courses': Target,
  'active-constraints': ShieldCheck,
};

export function ExecutiveMetricGrid({ metrics, alerts, selectedId, onMetricSelect, onAlertSelect }: ExecutiveMetricGridProps) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {metrics.map((metric) => {
          const Icon = metricIcons[metric.id] ?? Target;
          const selected = selectedId === metric.id;
          return (
            <button
              key={metric.id}
              type="button"
              onClick={() => onMetricSelect(metric)}
              className="text-left"
            >
              <Card className={`h-full transition ${selected ? 'border-gray-900 ring-2 ring-gray-900/10' : 'hover:border-gray-300'}`}>
                <CardHeader className="flex flex-row items-start justify-between space-y-0 p-4 pb-2">
                  <div>
                    <CardTitle className="text-sm font-semibold text-gray-600">{metric.label}</CardTitle>
                    <div className="mt-2 text-3xl font-bold tracking-normal text-gray-950">
                      {formatMetricValue(metric.value, metric.unit)}
                    </div>
                  </div>
                  <span className={`rounded-md border p-2 ${statusClasses(metric.status)}`}>
                    <Icon className="h-5 w-5" />
                  </span>
                </CardHeader>
                <CardContent className="p-4 pt-1">
                  <div className="flex items-center justify-between gap-3">
                    <p className="line-clamp-2 text-sm text-gray-500">{metric.detail}</p>
                    <span className={`shrink-0 rounded-full border px-2 py-1 text-xs font-semibold ${statusClasses(metric.status)}`}>
                      {statusText(metric.status)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </button>
          );
        })}
      </div>

      <Card>
        <CardHeader className="p-4 pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Alerts & Deficiencies</CardTitle>
            <span className="text-xs font-medium text-gray-500">{alerts.length} active</span>
          </div>
        </CardHeader>
        <CardContent className="p-4 pt-1">
          {alerts.length > 0 ? (
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {alerts.map((alert) => (
                <button
                  key={alert.id}
                  type="button"
                  onClick={() => onAlertSelect(alert)}
                  className={`rounded-md border p-3 text-left transition hover:border-gray-400 ${statusClasses(alert.status)}`}
                >
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">{alert.title}</div>
                      <div className="mt-1 line-clamp-2 text-xs opacity-80">{alert.detail}</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
              No active command-dashboard deficiencies in the current dataset.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
