import { Area, Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { ForecastPoint } from '../../types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';

interface ForecastTrendChartProps {
  points: ForecastPoint[];
}

export function ForecastTrendChart({ points }: ForecastTrendChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Training Load Forecast</CardTitle>
        <CardDescription>Historical monthly outcomes with a deterministic 6-month linear projection</CardDescription>
      </CardHeader>
      <CardContent>
        {points.length > 0 ? (
          <div className="h-[360px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={points} margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                <Tooltip
                  formatter={(value: number | string, name: string) => [value, name === 'completedCapsules' ? 'Completed capsules' : name]}
                  labelFormatter={(label) => `${label}`}
                />
                <Legend />
                <Bar dataKey="completedCapsules" name="Completed capsules" fill="#94a3b8" barSize={18} />
                <Area type="monotone" dataKey="actual" name="Actual load" fill="#bfdbfe" stroke="#2563eb" connectNulls={false} />
                <Line type="monotone" dataKey="forecast" name="Forecast" stroke="#d97706" strokeWidth={2.4} strokeDasharray="6 4" dot={{ r: 3 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="rounded-md border border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-500">
            No dates available for trend forecasting.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
