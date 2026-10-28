import type { PipelineStage, TrainingPipelinePayload } from '../../types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { formatPercent, statusClasses } from './commandDashboardUi';

interface TrainingPipelineFunnelProps {
  pipeline: TrainingPipelinePayload;
  selectedId?: string;
  onStageSelect: (stage: PipelineStage) => void;
}

export function TrainingPipelineFunnel({ pipeline, selectedId, onStageSelect }: TrainingPipelineFunnelProps) {
  const maxValue = Math.max(...pipeline.stages.map((stage) => stage.value), 1);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Training Pipeline Funnel</CardTitle>
        <CardDescription>Nominated to certified progression, derived from current training records</CardDescription>
      </CardHeader>
      <CardContent>
        {pipeline.stages.length > 0 ? (
          <div className="space-y-3">
            {pipeline.stages.map((stage) => {
              const width = Math.max(14, (stage.value / maxValue) * 100);
              const selected = selectedId === stage.id;
              return (
                <button
                  key={stage.id}
                  type="button"
                  onClick={() => onStageSelect(stage)}
                  className={`w-full rounded-md border p-3 text-left transition hover:border-gray-400 ${
                    selected ? 'border-gray-900 ring-2 ring-gray-900/10' : 'border-gray-200'
                  }`}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-gray-900">{stage.label}</div>
                      <div className="mt-1 text-xs text-gray-500">{stage.basis}</div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-xl font-bold text-gray-950">{stage.value.toLocaleString()}</div>
                      <div className="text-xs text-gray-500">{formatPercent(stage.rateFromPrevious)} from previous</div>
                    </div>
                  </div>
                  <div className="mt-3 h-3 rounded-full bg-gray-100">
                    <div className={`h-3 rounded-full border ${statusClasses(stage.status)}`} style={{ width: `${width}%` }} />
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="rounded-md border border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-500">
            No training pipeline data available.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
