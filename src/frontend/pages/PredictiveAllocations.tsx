import { useEffect, useMemo, useState } from 'react';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Select } from '../components/ui/select';
import { Badge } from '../components/ui/badge';
import { AlertCircle, CheckCircle, Download, Save, Sparkles, Target } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { formatDate } from '../utils/formatters';
import { canUpdateAllocationStatus } from '../lib/permissions';

interface AllocationRun {
  id: string;
  courseId: string;
  courseName: string;
  capsuleId: string;
  totalSlots: number;
  recommendations: {
    organization: string;
    recommendedCount: number;
    justification: string;
    successProbability: number;
    historicalCount: number;
  }[];
  appliedConstraints: string[];
  constraintResults: {
    id: string;
    name: string;
    type: string;
    satisfied: boolean;
    detail: string;
  }[];
  confidence: number;
  generatedAt: string;
  status: 'generated' | 'review' | 'applied';
}

function confidenceLabel(confidence: number): string {
  const value = confidence <= 1 ? confidence * 100 : confidence;
  return `${value.toFixed(1)}%`;
}

function downloadCsv(allocation: AllocationRun): void {
  const headers = ['Organization', 'Recommended Slots', 'Success Probability', 'Historical Records', 'Justification'];
  const rows = allocation.recommendations.map((rec) => [
    rec.organization,
    String(rec.recommendedCount),
    `${rec.successProbability.toFixed(1)}%`,
    String(rec.historicalCount),
    rec.justification,
  ]);
  const csv = [headers, ...rows]
    .map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `allocation-${allocation.courseName.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-${allocation.id}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export function PredictiveAllocations() {
  const { courses, isLoading } = useData();
  const { user } = useAuth();
  const canChangeAllocationStatus = canUpdateAllocationStatus(user?.role);
  const [selectedCourse, setSelectedCourse] = useState('');
  const [selectedCapsule, setSelectedCapsule] = useState('');
  const [allocation, setAllocation] = useState<AllocationRun | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const activeCourse = useMemo(
    () => courses.find((course) => course.id === selectedCourse) ?? null,
    [courses, selectedCourse]
  );

  const capsules = activeCourse?.capsules ?? [];

  useEffect(() => {
    if (!activeCourse) {
      setSelectedCapsule('');
      return;
    }
    const preferred =
      activeCourse.capsules.find((capsule) => capsule.status === 'Ongoing') ??
      activeCourse.capsules.find((capsule) => capsule.status === 'Scheduled') ??
      activeCourse.capsules[0];
    setSelectedCapsule(preferred?.id ?? '');
  }, [activeCourse]);

  const chartData = allocation?.recommendations.map((rec) => ({
    org: rec.organization.length > 20 ? rec.organization.substring(0, 20) + '...' : rec.organization,
    'Recommended Slots': rec.recommendedCount,
    'Success Probability': Math.round(rec.successProbability),
  })) ?? [];

  const generate = async () => {
    if (!selectedCourse) return;
    setIsGenerating(true);
    setError(null);
    setMessage(null);
    try {
      const result = await window.api.allocations.generate(selectedCourse, selectedCapsule || undefined);
      setAllocation(result as AllocationRun);
      setMessage('Allocation recommendations generated and saved to audit history.');
    } catch (err: any) {
      setError(err.message || 'Failed to generate allocation recommendations.');
    } finally {
      setIsGenerating(false);
    }
  };

  const updateStatus = async (status: 'review' | 'applied') => {
    if (!allocation) return;
    if (!canChangeAllocationStatus) {
      setError('You do not have permission to update allocation status.');
      return;
    }
    setError(null);
    setMessage(null);
    try {
      const updated = await window.api.allocations.updateStatus(allocation.id, status);
      setAllocation({ ...allocation, status: updated.status });
      setMessage(status === 'review' ? 'Allocation saved for review.' : 'Allocation marked as applied.');
    } catch (err: any) {
      setError(err.message || 'Failed to update allocation status.');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-gray-500">Loading allocation data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Predictive Allocations</h1>
        <p className="text-gray-500 mt-1">Constraint-aware trainee distribution recommendations</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="w-5 h-5" />
            Generate Allocation Recommendations
          </CardTitle>
          <CardDescription>
            Select a course and capsule. Recommendations use SQLite performance history and active constraints.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-4 items-end">
            <div>
              <label className="text-sm font-medium mb-2 block">Course</label>
              <Select value={selectedCourse} onChange={(e) => setSelectedCourse(e.target.value)}>
                <option value="">Choose a course...</option>
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>{course.name}</option>
                ))}
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Capsule</label>
              <Select
                value={selectedCapsule}
                onChange={(e) => setSelectedCapsule(e.target.value)}
                disabled={!activeCourse || capsules.length === 0}
              >
                <option value="">Auto-select capsule</option>
                {capsules.map((capsule) => (
                  <option key={capsule.id} value={capsule.id}>
                    Capsule {capsule.capsuleNumber} · {capsule.vacancies} vacancies · {capsule.status}
                  </option>
                ))}
              </Select>
            </div>
            <Button disabled={!selectedCourse || isGenerating} className="gap-2" onClick={generate}>
              <Sparkles className="w-4 h-4" />
              {isGenerating ? 'Generating...' : 'Generate'}
            </Button>
          </div>
          {error && <div className="mt-4 text-red-600 text-sm bg-red-50 border border-red-200 p-3 rounded-md">{error}</div>}
          {message && <div className="mt-4 text-green-700 text-sm bg-green-50 border border-green-200 p-3 rounded-md">{message}</div>}
        </CardContent>
      </Card>

      {allocation ? (
        <>
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle>Allocation Summary</CardTitle>
                  <CardDescription className="mt-2">
                    {allocation.courseName} · {allocation.totalSlots} slots · generated {formatDate(new Date(allocation.generatedAt))}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{allocation.status}</Badge>
                  <Badge variant="success" className="gap-1">
                    <CheckCircle className="w-3 h-3" />
                    {confidenceLabel(allocation.confidence)} Confidence
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-blue-50 rounded-lg">
                  <p className="text-sm text-gray-600">Total Slots</p>
                  <p className="text-2xl font-bold text-blue-700 mt-1">{allocation.totalSlots}</p>
                </div>
                <div className="p-4 bg-green-50 rounded-lg">
                  <p className="text-sm text-gray-600">Organizations</p>
                  <p className="text-2xl font-bold text-green-700 mt-1">{allocation.recommendations.length}</p>
                </div>
                <div className="p-4 bg-purple-50 rounded-lg">
                  <p className="text-sm text-gray-600">Active Constraints</p>
                  <p className="text-2xl font-bold text-purple-700 mt-1">{allocation.appliedConstraints.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Constraint Results</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {allocation.constraintResults.map((constraint) => (
                  <div key={constraint.id} className="flex items-start justify-between gap-4 rounded-md border border-gray-200 p-3">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{constraint.name}</p>
                      <p className="text-xs text-gray-500 mt-1">{constraint.detail}</p>
                    </div>
                    <Badge variant={constraint.satisfied ? 'success' : 'warning'}>
                      {constraint.satisfied ? 'Satisfied' : 'Adjusted'}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recommended Distribution</CardTitle>
              <CardDescription>Allocation breakdown by organization</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="org" angle={-45} textAnchor="end" height={150} />
                  <YAxis yAxisId="left" orientation="left" stroke="#3b82f6" />
                  <YAxis yAxisId="right" orientation="right" stroke="#22c55e" />
                  <Tooltip />
                  <Legend />
                  <Bar yAxisId="left" dataKey="Recommended Slots" fill="#3b82f6" />
                  <Bar yAxisId="right" dataKey="Success Probability" fill="#22c55e" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Detailed Recommendations</CardTitle>
              <CardDescription>Organization-wise allocation with justifications</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {allocation.recommendations.map((rec) => (
                  <div key={rec.organization} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h4 className="font-semibold text-gray-900">{rec.organization}</h4>
                        <p className="text-sm text-gray-500 mt-1">Historical records: {rec.historicalCount}</p>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-blue-600">{rec.recommendedCount}</div>
                        <p className="text-xs text-gray-500">slots</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="flex-1 bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${
                            rec.successProbability >= 85 ? 'bg-green-500' :
                            rec.successProbability >= 70 ? 'bg-yellow-500' :
                            'bg-red-500'
                          }`}
                          style={{ width: `${rec.successProbability}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium text-gray-700">{rec.successProbability.toFixed(1)}%</span>
                    </div>
                    <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded">
                      <AlertCircle className="w-4 h-4 inline mr-2 text-blue-500" />
                      {rec.justification}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-wrap gap-3 justify-end">
                {canChangeAllocationStatus && (
                  <Button variant="outline" className="gap-2" onClick={() => updateStatus('review')}>
                    <Save className="w-4 h-4" />
                    Save for Review
                  </Button>
                )}
                <Button variant="outline" className="gap-2" onClick={() => downloadCsv(allocation)}>
                  <Download className="w-4 h-4" />
                  Export Report
                </Button>
                {canChangeAllocationStatus && (
                  <Button onClick={() => updateStatus('applied')}>Apply Allocations</Button>
                )}
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <Card className="border-dashed">
          <CardContent className="pt-6">
            <div className="text-center py-12">
              <Target className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-700 mb-2">No Recommendations Yet</h3>
              <p className="text-gray-500 text-sm">
                Select a course and generate constraint-aware recommendations.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
