import type Database from 'better-sqlite3';

export type CommandStatus = 'green' | 'yellow' | 'red';
export type AlertSeverity = 'info' | 'warning' | 'critical';

export interface SourceTraineeRow {
  id: string;
  rank: string;
  name: string;
  armyNo: string;
  organization: string;
  status: string;
  joinDate: string;
}

export interface SourceCourseRow {
  id: string;
  name: string;
  code: string;
  duration: number;
}

export interface SourceCapsuleRow {
  id: string;
  courseId: string;
  courseName: string;
  courseCode: string;
  capsuleNumber: number;
  startDate: string;
  endDate: string;
  vacancies: number;
  nominations: number;
  status: string;
  locationState: string | null;
}

export interface SourcePerformanceRow {
  id: string;
  traineeId: string;
  traineeName: string;
  armyNo: string;
  organization: string;
  courseId: string;
  courseName: string;
  courseCode: string;
  capsuleId: string;
  result: string;
  grade: string | null;
  score: number | null;
  completionDate: string;
  isRtu: boolean;
  rtuReasonCode: string | null;
  rtuReasonDetails: string | null;
}

export interface SourceConstraintRow {
  id: string;
  name: string;
  description: string | null;
  type: string;
  priority: number;
  isActive: boolean;
  rules: string;
}

export interface SourceAllocationRow {
  id: string;
  courseName: string;
  courseCode: string;
  capsuleNumber: number;
  status: string;
  totalSlots: number;
  confidence: number;
  createdAt: string;
}

export interface SourceActivityRow {
  id: string;
  type: string;
  description: string;
  createdAt: string;
}

export interface SourceUserRow {
  id: string;
  name: string;
  email: string;
  role: string;
  organization: string | null;
  isActive: boolean;
}

export interface CommandDashboardSourceData {
  trainees: SourceTraineeRow[];
  courses: SourceCourseRow[];
  capsules: SourceCapsuleRow[];
  performanceRecords: SourcePerformanceRow[];
  constraints: SourceConstraintRow[];
  allocationRuns: SourceAllocationRow[];
  activities: SourceActivityRow[];
  users: SourceUserRow[];
}

export type SupportingRow = Record<string, string | number | boolean | null>;

export interface ExecutiveMetric {
  id: string;
  label: string;
  value: number | string;
  unit?: string;
  status: CommandStatus;
  detail: string;
  sourceRows: SupportingRow[];
}

export interface CourseWindow {
  id: string;
  courseName: string;
  courseCode: string;
  capsuleNumber: number;
  startDate: string;
  endDate: string;
  vacancies: number;
  nominations: number;
  utilization: number;
  status: string;
  locationState: string | null;
}

export interface CommandAlert {
  id: string;
  type: string;
  severity: AlertSeverity;
  title: string;
  detail: string;
  value?: number | string;
  status: CommandStatus;
  sourceRows: SupportingRow[];
}

export interface HeatMapCell {
  organization: string;
  domain: string;
  passes: number;
  fails: number;
  total: number;
  rtuCount: number;
  passRate: number;
  status: CommandStatus;
  sourceRows: SupportingRow[];
}

export interface HeatMapRow {
  organization: string;
  total: number;
  passRate: number;
  cells: HeatMapCell[];
}

export interface PerformanceHeatMapPayload {
  domains: string[];
  rows: HeatMapRow[];
}

export interface GeoDistributionPoint {
  id: string;
  state: string;
  eventsConducted: number;
  trainedPersonnel: number;
  coursesConducted: number;
  passRate: number;
  capabilities: string[];
  status: CommandStatus;
  sourceRows: SupportingRow[];
}

export interface ForecastPoint {
  month: string;
  label: string;
  actual: number | null;
  forecast: number | null;
  completedCapsules: number;
  isForecast: boolean;
}

export interface PipelineStage {
  id: string;
  label: string;
  value: number;
  rateFromPrevious: number;
  status: CommandStatus;
  basis: string;
  sourceRows: SupportingRow[];
}

export interface TrainingPipelinePayload {
  stages: PipelineStage[];
  transitions: { from: string; to: string; rate: number }[];
}

export interface OrgComparisonRow {
  organization: string;
  totalTrainees: number;
  trainingVolume: number;
  completionRate: number;
  passPercentage: number;
  rtuRate: number;
  resourceUtilization: number | null;
  instructorAvailability: number | null;
  status: CommandStatus;
  sourceRows: SupportingRow[];
}

export interface CommandDashboardPayload {
  generatedAt: string;
  executiveSummary: {
    metrics: ExecutiveMetric[];
    activeCourses: CourseWindow[];
    upcomingCourses: CourseWindow[];
    alerts: CommandAlert[];
  };
  performanceHeatMap: PerformanceHeatMapPayload;
  geoDistribution: GeoDistributionPoint[];
  trainingForecast: ForecastPoint[];
  pipeline: TrainingPipelinePayload;
  orgComparison: OrgComparisonRow[];
}

const STATE_NOT_CAPTURED = 'State not captured';

function normalizeOrg(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeLocationState(value: string | null | undefined): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : STATE_NOT_CAPTURED;
}

function stateId(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'state-not-captured';
}

function round(value: number, decimals = 1): number {
  const multiplier = 10 ** decimals;
  return Math.round(value * multiplier) / multiplier;
}

function percent(part: number, total: number): number {
  if (total <= 0) return 0;
  return round((part / total) * 100, 1);
}

function sum<T>(items: T[], selector: (item: T) => number): number {
  return items.reduce((total, item) => total + selector(item), 0);
}

function take<T>(items: T[], limit: number): T[] {
  return items.slice(0, limit);
}

function uniqueCount(values: string[]): number {
  return new Set(values.filter(Boolean)).size;
}

function compareDateDesc(a: string, b: string): number {
  return new Date(b).getTime() - new Date(a).getTime();
}

function toMonthKey(dateText: string): string | null {
  const date = new Date(dateText);
  if (Number.isNaN(date.getTime())) return null;
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function addMonths(monthKey: string, offset: number): string {
  const [yearText, monthText] = monthKey.split('-');
  const date = new Date(Date.UTC(Number(yearText), Number(monthText) - 1 + offset, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(monthKey: string): string {
  const [yearText, monthText] = monthKey.split('-');
  const date = new Date(Date.UTC(Number(yearText), Number(monthText) - 1, 1));
  return date.toLocaleString('en-US', { month: 'short', year: '2-digit', timeZone: 'UTC' });
}

function statusForPercentage(value: number): CommandStatus {
  if (value >= 85) return 'green';
  if (value >= 70) return 'yellow';
  return 'red';
}

export function getPassRateStatus(passRate: number): CommandStatus {
  if (passRate > 90) return 'green';
  if (passRate >= 70) return 'yellow';
  return 'red';
}

function deriveCourseDomain(courseName: string, courseCode: string): string {
  const text = `${courseName} ${courseCode}`.toLowerCase();
  if (/counter|insurgency|terror|commando|hostage|vip|protection|sniper|cqb/.test(text)) return 'Counter Insurgency';
  if (/cyber|intelligence|interrogation|surveillance|signal/.test(text)) return 'Cyber & Intelligence';
  if (/explosive|eod|cbrn|bomb|hazmat/.test(text)) return 'EOD & CBRN';
  if (/medical|first aid|paramedic|casualty/.test(text)) return 'Medical & Support';
  if (/leadership|instructor|trainer|command/.test(text)) return 'Leadership';
  if (/border|field|jungle|mountain|desert|patrol|navigation/.test(text)) return 'Field Operations';
  return 'General Training';
}

function isAdvancedCourse(row: Pick<SourcePerformanceRow, 'courseName' | 'courseCode'>): boolean {
  const text = `${row.courseName} ${row.courseCode}`.toLowerCase();
  return /advanced|counter|insurgency|terror|commando|sniper|vip|hostage|cyber|intelligence|explosive|eod|cbrn|leadership/.test(text);
}

function isInstructorProxy(row: SourcePerformanceRow): boolean {
  const text = `${row.courseName} ${row.courseCode}`.toLowerCase();
  return /instructor|trainer|leadership/.test(text) || ((row.grade === 'A' || row.grade === 'A+') && isAdvancedCourse(row));
}

function toPerformanceSupportRow(row: SourcePerformanceRow): SupportingRow {
  return {
    trainee: row.traineeName,
    armyNo: row.armyNo,
    organization: row.organization,
    course: row.courseName,
    courseCode: row.courseCode,
    result: row.result,
    grade: row.grade,
    score: row.score,
    date: row.completionDate,
    rtu: row.isRtu,
    rtuReason: row.rtuReasonCode,
  };
}

function toCapsuleSupportRow(row: SourceCapsuleRow): SupportingRow {
  return {
    course: row.courseName,
    courseCode: row.courseCode,
    capsule: row.capsuleNumber,
    startDate: row.startDate,
    endDate: row.endDate,
    vacancies: row.vacancies,
    nominations: row.nominations,
    utilization: percent(row.nominations, row.vacancies),
    status: row.status,
    locationState: normalizeLocationState(row.locationState),
  };
}

function toTraineeSupportRow(row: SourceTraineeRow): SupportingRow {
  return {
    name: row.name,
    armyNo: row.armyNo,
    rank: row.rank,
    organization: row.organization,
    status: row.status,
    joinDate: row.joinDate,
  };
}

function buildCourseWindow(row: SourceCapsuleRow): CourseWindow {
  return {
    id: row.id,
    courseName: row.courseName,
    courseCode: row.courseCode,
    capsuleNumber: row.capsuleNumber,
    startDate: row.startDate,
    endDate: row.endDate,
    vacancies: row.vacancies,
    nominations: row.nominations,
    utilization: percent(row.nominations, row.vacancies),
    status: row.status,
    locationState: row.locationState,
  };
}

function buildHeatMap(performanceRecords: SourcePerformanceRow[]): PerformanceHeatMapPayload {
  const groups = new Map<string, HeatMapCell>();
  const rowsByOrg = new Map<string, { passes: number; total: number }>();
  const domains = new Set<string>();

  for (const record of performanceRecords) {
    const organization = record.organization || 'Unknown';
    const domain = deriveCourseDomain(record.courseName, record.courseCode);
    const key = `${organization}::${domain}`;
    domains.add(domain);

    const cell = groups.get(key) ?? {
      organization,
      domain,
      passes: 0,
      fails: 0,
      total: 0,
      rtuCount: 0,
      passRate: 0,
      status: 'red' as CommandStatus,
      sourceRows: [],
    };

    cell.total += 1;
    if (record.result === 'Pass') cell.passes += 1;
    if (record.result === 'Fail') cell.fails += 1;
    if (record.isRtu) cell.rtuCount += 1;
    if (cell.sourceRows.length < 20) cell.sourceRows.push(toPerformanceSupportRow(record));
    groups.set(key, cell);

    const orgSummary = rowsByOrg.get(organization) ?? { passes: 0, total: 0 };
    orgSummary.total += 1;
    if (record.result === 'Pass') orgSummary.passes += 1;
    rowsByOrg.set(organization, orgSummary);
  }

  for (const cell of groups.values()) {
    cell.passRate = percent(cell.passes, cell.total);
    cell.status = getPassRateStatus(cell.passRate);
  }

  const rows = Array.from(rowsByOrg.entries())
    .map(([organization, summary]) => ({
      organization,
      total: summary.total,
      passRate: percent(summary.passes, summary.total),
      cells: Array.from(groups.values())
        .filter((cell) => cell.organization === organization)
        .sort((a, b) => a.domain.localeCompare(b.domain)),
    }))
    .sort((a, b) => b.total - a.total || a.organization.localeCompare(b.organization));

  return {
    domains: Array.from(domains).sort((a, b) => a.localeCompare(b)),
    rows,
  };
}

function buildGeoDistribution(performanceRecords: SourcePerformanceRow[], capsules: SourceCapsuleRow[]): GeoDistributionPoint[] {
  type StateAccumulator = {
    capsuleIds: Set<string>;
    traineeIds: Set<string>;
    courseIds: Set<string>;
    capabilities: Set<string>;
    passes: number;
    total: number;
    sourceRows: SupportingRow[];
  };

  const groups = new Map<string, StateAccumulator>();
  const capsuleById = new Map(capsules.map((capsule) => [capsule.id, capsule]));

  const getGroup = (state: string): StateAccumulator => {
    const existing = groups.get(state);
    if (existing) return existing;
    const created: StateAccumulator = {
      capsuleIds: new Set<string>(),
      traineeIds: new Set<string>(),
      courseIds: new Set<string>(),
      capabilities: new Set<string>(),
      passes: 0,
      total: 0,
      sourceRows: [],
    };
    groups.set(state, created);
    return created;
  };

  for (const capsule of capsules.filter((row) => row.status !== 'Cancelled')) {
    const state = normalizeLocationState(capsule.locationState);
    const group = getGroup(state);
    group.capsuleIds.add(capsule.id);
    group.courseIds.add(capsule.courseId);
    group.capabilities.add(deriveCourseDomain(capsule.courseName, capsule.courseCode));
    if (group.sourceRows.length < 20) group.sourceRows.push(toCapsuleSupportRow(capsule));
  }

  for (const record of performanceRecords) {
    const capsule = capsuleById.get(record.capsuleId);
    const state = normalizeLocationState(capsule?.locationState);
    const group = getGroup(state);

    group.traineeIds.add(record.traineeId);
    group.courseIds.add(record.courseId);
    group.capabilities.add(deriveCourseDomain(record.courseName, record.courseCode));
    group.total += 1;
    if (record.result === 'Pass') group.passes += 1;
    if (group.sourceRows.length < 20) {
      group.sourceRows.push({
        locationState: state,
        ...toPerformanceSupportRow(record),
      });
    }
  }

  return Array.from(groups.entries())
    .map(([state, group]) => {
      const passRate = percent(group.passes, group.total);
      return {
        id: stateId(state),
        state,
        eventsConducted: group.capsuleIds.size,
        trainedPersonnel: group.traineeIds.size,
        coursesConducted: group.courseIds.size,
        passRate,
        capabilities: Array.from(group.capabilities).sort(),
        status: group.total > 0 ? getPassRateStatus(passRate) : 'yellow',
        sourceRows: group.sourceRows,
      };
    })
    .filter((point) => point.eventsConducted > 0 || point.trainedPersonnel > 0)
    .sort((a, b) => {
      if (a.state === STATE_NOT_CAPTURED) return 1;
      if (b.state === STATE_NOT_CAPTURED) return -1;
      return b.eventsConducted - a.eventsConducted || b.trainedPersonnel - a.trainedPersonnel || a.state.localeCompare(b.state);
    });
}

function buildForecast(performanceRecords: SourcePerformanceRow[], capsules: SourceCapsuleRow[]): ForecastPoint[] {
  const actualByMonth = new Map<string, number>();
  const capsulesByMonth = new Map<string, number>();

  for (const record of performanceRecords) {
    const month = toMonthKey(record.completionDate);
    if (!month) continue;
    actualByMonth.set(month, (actualByMonth.get(month) ?? 0) + 1);
  }

  for (const capsule of capsules.filter((row) => row.status === 'Completed')) {
    const month = toMonthKey(capsule.endDate);
    if (!month) continue;
    capsulesByMonth.set(month, (capsulesByMonth.get(month) ?? 0) + 1);
  }

  const months = Array.from(new Set([...actualByMonth.keys(), ...capsulesByMonth.keys()])).sort();
  if (months.length === 0) {
    const currentMonth = toMonthKey(new Date().toISOString()) ?? '2026-01';
    return Array.from({ length: 6 }, (_, index) => {
      const month = addMonths(currentMonth, index + 1);
      return { month, label: monthLabel(month), actual: null, forecast: 0, completedCapsules: 0, isForecast: true };
    });
  }

  const firstMonth = months[0];
  const lastMonth = months[months.length - 1];
  const historicalMonths: string[] = [];
  let cursor = firstMonth;
  while (cursor <= lastMonth) {
    historicalMonths.push(cursor);
    cursor = addMonths(cursor, 1);
  }

  const historical = historicalMonths.map((month) => ({
    month,
    label: monthLabel(month),
    actual: actualByMonth.get(month) ?? 0,
    forecast: null,
    completedCapsules: capsulesByMonth.get(month) ?? 0,
    isForecast: false,
  }));

  const values = historical.map((point) => point.actual ?? 0);
  const lastValue = values[values.length - 1] ?? 0;
  const slope = values.length > 1 ? (lastValue - values[0]) / (values.length - 1) : 0;
  const forecast = Array.from({ length: 6 }, (_, index) => {
    const month = addMonths(lastMonth, index + 1);
    return {
      month,
      label: monthLabel(month),
      actual: null,
      forecast: Math.max(0, Math.round(lastValue + slope * (index + 1))),
      completedCapsules: 0,
      isForecast: true,
    };
  });

  return [...historical, ...forecast];
}

function buildPipeline(source: CommandDashboardSourceData): TrainingPipelinePayload {
  const nonCancelledCapsules = source.capsules.filter((row) => row.status !== 'Cancelled');
  const nominated = sum(nonCancelledCapsules, (row) => row.nominations);
  const registered = uniqueCount(source.performanceRecords.map((row) => `${row.traineeId}:${row.courseId}`));
  const underTraining = source.trainees.filter((row) => row.status === 'In Training').length;
  const passRows = source.performanceRecords.filter((row) => row.result === 'Pass');
  const qualified = uniqueCount(passRows.map((row) => `${row.traineeId}:${row.courseId}`));
  const advancedRows = passRows.filter(isAdvancedCourse);
  const advancedQualified = uniqueCount(advancedRows.map((row) => `${row.traineeId}:${row.courseId}`));
  const instructorRows = passRows.filter(isInstructorProxy);
  const instructorCertified = uniqueCount(instructorRows.map((row) => row.traineeId));

  const rawStages = [
    {
      id: 'nominated',
      label: 'Nominated',
      value: nominated,
      basis: 'Sum of nominations on non-cancelled capsules',
      sourceRows: take(nonCancelledCapsules.map(toCapsuleSupportRow), 20),
    },
    {
      id: 'registered',
      label: 'Registered',
      value: registered,
      basis: 'Distinct trainee-course performance records',
      sourceRows: take(source.performanceRecords.map(toPerformanceSupportRow), 20),
    },
    {
      id: 'under-training',
      label: 'Under Training',
      value: underTraining,
      basis: 'Trainees currently marked In Training',
      sourceRows: take(source.trainees.filter((row) => row.status === 'In Training').map(toTraineeSupportRow), 20),
    },
    {
      id: 'qualified',
      label: 'Qualified',
      value: qualified,
      basis: 'Distinct trainee-course pass records',
      sourceRows: take(passRows.map(toPerformanceSupportRow), 20),
    },
    {
      id: 'advanced-qualified',
      label: 'Advanced Qualified',
      value: advancedQualified,
      basis: 'Passes in advanced or specialized course domains',
      sourceRows: take(advancedRows.map(toPerformanceSupportRow), 20),
    },
    {
      id: 'instructor-certified',
      label: 'Instructor Certified',
      value: instructorCertified,
      basis: 'Instructor proxy from instructor/leadership courses or A/A+ advanced passes',
      sourceRows: take(instructorRows.map(toPerformanceSupportRow), 20),
    },
  ];

  const stages: PipelineStage[] = rawStages.map((stage, index) => {
    const previousValue = index === 0 ? stage.value : rawStages[index - 1].value;
    const monotonicValue = index === 0 ? stage.value : Math.min(stage.value, previousValue);
    rawStages[index].value = monotonicValue;
    return {
      ...stage,
      value: monotonicValue,
      rateFromPrevious: index === 0 ? 100 : percent(monotonicValue, rawStages[index - 1].value),
      status: statusForPercentage(index === 0 ? 100 : percent(monotonicValue, rawStages[index - 1].value)),
    };
  });

  return {
    stages,
    transitions: stages.slice(1).map((stage, index) => ({
      from: stages[index].label,
      to: stage.label,
      rate: stage.rateFromPrevious,
    })),
  };
}

function buildOrgComparison(source: CommandDashboardSourceData): OrgComparisonRow[] {
  const traineeGroups = new Map<string, SourceTraineeRow[]>();
  const performanceGroups = new Map<string, SourcePerformanceRow[]>();

  for (const trainee of source.trainees) {
    const organization = trainee.organization || 'Unknown';
    traineeGroups.set(organization, [...(traineeGroups.get(organization) ?? []), trainee]);
  }

  for (const record of source.performanceRecords) {
    const organization = record.organization || 'Unknown';
    performanceGroups.set(organization, [...(performanceGroups.get(organization) ?? []), record]);
  }

  const organizations = Array.from(new Set([...traineeGroups.keys(), ...performanceGroups.keys()]));
  return organizations
    .map((organization) => {
      const trainees = traineeGroups.get(organization) ?? [];
      const records = performanceGroups.get(organization) ?? [];
      const passes = records.filter((row) => row.result === 'Pass').length;
      const rtuCount = records.filter((row) => row.isRtu).length;
      const completedTrainees = trainees.filter((row) => row.status === 'Graduated' || row.status === 'RTU').length;
      const passPercentage = percent(passes, records.length);

      return {
        organization,
        totalTrainees: trainees.length,
        trainingVolume: records.length,
        completionRate: percent(completedTrainees, trainees.length),
        passPercentage,
        rtuRate: percent(rtuCount, records.length),
        resourceUtilization: null,
        instructorAvailability: null,
        status: records.length > 0 ? getPassRateStatus(passPercentage) : 'red',
        sourceRows: take(records.map(toPerformanceSupportRow), 20),
      };
    })
    .sort((a, b) => b.trainingVolume - a.trainingVolume || a.organization.localeCompare(b.organization));
}

function buildAlerts(
  source: CommandDashboardSourceData,
  heatMap: PerformanceHeatMapPayload,
  capacityUtilization: number,
  overallPassRate: number,
  overallRtuRate: number
): CommandAlert[] {
  const alerts: CommandAlert[] = [];

  if (capacityUtilization < 85) {
    alerts.push({
      id: 'capacity-utilization',
      type: 'low-utilization',
      severity: capacityUtilization < 70 ? 'critical' : 'warning',
      title: 'Capacity utilization below target',
      detail: `Overall nominations fill ${capacityUtilization}% of available vacancies.`,
      value: capacityUtilization,
      status: statusForPercentage(capacityUtilization),
      sourceRows: take(source.capsules.map(toCapsuleSupportRow), 20),
    });
  }

  if (overallPassRate < 70) {
    alerts.push({
      id: 'overall-pass-rate',
      type: 'low-pass-rate',
      severity: 'critical',
      title: 'Overall pass rate below 70%',
      detail: `Current exact pass rate is ${overallPassRate}% across recorded performance outcomes.`,
      value: overallPassRate,
      status: 'red',
      sourceRows: take(source.performanceRecords.map(toPerformanceSupportRow), 20),
    });
  }

  if (overallRtuRate > 15) {
    alerts.push({
      id: 'overall-rtu-rate',
      type: 'high-rtu',
      severity: overallRtuRate > 25 ? 'critical' : 'warning',
      title: 'RTU rate above threshold',
      detail: `RTU cases account for ${overallRtuRate}% of recorded performance outcomes.`,
      value: overallRtuRate,
      status: overallRtuRate > 25 ? 'red' : 'yellow',
      sourceRows: take(source.performanceRecords.filter((row) => row.isRtu).map(toPerformanceSupportRow), 20),
    });
  }

  const underfilledCapsules = source.capsules
    .filter((row) => (row.status === 'Scheduled' || row.status === 'Ongoing') && row.vacancies > 0 && percent(row.nominations, row.vacancies) < 70)
    .sort((a, b) => percent(a.nominations, a.vacancies) - percent(b.nominations, b.vacancies));

  for (const capsule of take(underfilledCapsules, 2)) {
    const utilization = percent(capsule.nominations, capsule.vacancies);
    alerts.push({
      id: `underfilled-${capsule.id}`,
      type: 'underfilled-course',
      severity: utilization < 50 ? 'critical' : 'warning',
      title: `${capsule.courseCode} capsule underfilled`,
      detail: `${capsule.courseName} capsule ${capsule.capsuleNumber} is at ${utilization}% utilization.`,
      value: utilization,
      status: statusForPercentage(utilization),
      sourceRows: [toCapsuleSupportRow(capsule)],
    });
  }

  const lowPassCells = heatMap.rows
    .flatMap((row) => row.cells)
    .filter((cell) => cell.total >= 2 && cell.passRate < 70)
    .sort((a, b) => a.passRate - b.passRate);

  for (const cell of take(lowPassCells, 2)) {
    alerts.push({
      id: `low-pass-${normalizeOrg(cell.organization)}-${cell.domain.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      type: 'low-pass-rate',
      severity: 'critical',
      title: `${cell.organization} low pass rate`,
      detail: `${cell.domain} pass rate is ${cell.passRate}% across ${cell.total} outcomes.`,
      value: cell.passRate,
      status: 'red',
      sourceRows: cell.sourceRows,
    });
  }

  return take(
    alerts.sort((a, b) => {
      const severityRank = { critical: 0, warning: 1, info: 2 };
      return severityRank[a.severity] - severityRank[b.severity] || a.title.localeCompare(b.title);
    }),
    6
  );
}

export function buildCommandDashboardFromRows(source: CommandDashboardSourceData): CommandDashboardPayload {
  const performanceRecords = [...source.performanceRecords].sort((a, b) => compareDateDesc(a.completionDate, b.completionDate));
  const nonCancelledCapsules = source.capsules.filter((row) => row.status !== 'Cancelled');
  const totalVacancies = sum(nonCancelledCapsules, (row) => row.vacancies);
  const totalNominations = sum(nonCancelledCapsules, (row) => row.nominations);
  const capacityUtilization = percent(totalNominations, totalVacancies);
  const totalRecords = performanceRecords.length;
  const passCount = performanceRecords.filter((row) => row.result === 'Pass').length;
  const rtuCount = performanceRecords.filter((row) => row.isRtu).length;
  const overallPassRate = percent(passCount, totalRecords);
  const overallRtuRate = percent(rtuCount, totalRecords);
  const personnelTrained = uniqueCount(performanceRecords.map((row) => `${row.traineeId}:${row.courseId}`));
  const completedCapsules = source.capsules.filter((row) => row.status === 'Completed');
  const activeCourses = source.capsules
    .filter((row) => row.status === 'Ongoing')
    .sort((a, b) => new Date(a.endDate).getTime() - new Date(b.endDate).getTime())
    .map(buildCourseWindow);
  const upcomingCourses = source.capsules
    .filter((row) => row.status === 'Scheduled')
    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
    .map(buildCourseWindow);

  const heatMap = buildHeatMap(performanceRecords);
  const alerts = buildAlerts(source, heatMap, capacityUtilization, overallPassRate, overallRtuRate);
  const activeConstraints = source.constraints.filter((row) => row.isActive).length;

  return {
    generatedAt: new Date().toISOString(),
    executiveSummary: {
      metrics: [
        {
          id: 'personnel-trained',
          label: 'Personnel Trained',
          value: personnelTrained,
          status: personnelTrained > 0 ? 'green' : 'red',
          detail: 'Distinct trainee-course completions recorded in performance data',
          sourceRows: take(performanceRecords.map(toPerformanceSupportRow), 20),
        },
        {
          id: 'courses-conducted',
          label: 'Courses Conducted',
          value: completedCapsules.length,
          status: completedCapsules.length > 0 ? 'green' : 'red',
          detail: 'Completed course capsules',
          sourceRows: take(completedCapsules.map(toCapsuleSupportRow), 20),
        },
        {
          id: 'capacity-utilization',
          label: 'Capacity Utilization',
          value: capacityUtilization,
          unit: '%',
          status: statusForPercentage(capacityUtilization),
          detail: `${totalNominations} nominations against ${totalVacancies} vacancies`,
          sourceRows: take(nonCancelledCapsules.map(toCapsuleSupportRow), 20),
        },
        {
          id: 'active-courses',
          label: 'Active Courses',
          value: activeCourses.length,
          status: activeCourses.length > 0 ? 'green' : 'yellow',
          detail: 'Ongoing capsules currently in execution',
          sourceRows: take(activeCourses.map((row) => ({
            course: row.courseName,
            courseCode: row.courseCode,
            capsule: row.capsuleNumber,
            startDate: row.startDate,
            endDate: row.endDate,
            vacancies: row.vacancies,
            nominations: row.nominations,
            utilization: row.utilization,
          })), 20),
        },
        {
          id: 'upcoming-courses',
          label: 'Upcoming Courses',
          value: upcomingCourses.length,
          status: upcomingCourses.length > 0 ? 'green' : 'yellow',
          detail: 'Scheduled capsules awaiting start',
          sourceRows: take(upcomingCourses.map((row) => ({
            course: row.courseName,
            courseCode: row.courseCode,
            capsule: row.capsuleNumber,
            startDate: row.startDate,
            endDate: row.endDate,
            vacancies: row.vacancies,
            nominations: row.nominations,
            utilization: row.utilization,
          })), 20),
        },
        {
          id: 'active-constraints',
          label: 'Active Constraints',
          value: activeConstraints,
          status: activeConstraints > 0 ? 'green' : 'yellow',
          detail: 'Enabled allocation and training constraints',
          sourceRows: take(source.constraints.filter((row) => row.isActive).map((row) => ({
            name: row.name,
            type: row.type,
            priority: row.priority,
            description: row.description,
            active: row.isActive,
          })), 20),
        },
      ],
      activeCourses,
      upcomingCourses,
      alerts,
    },
    performanceHeatMap: heatMap,
    geoDistribution: buildGeoDistribution(performanceRecords, source.capsules),
    trainingForecast: buildForecast(performanceRecords, source.capsules),
    pipeline: buildPipeline(source),
    orgComparison: buildOrgComparison(source),
  };
}

function loadCommandDashboardSourceData(db: Database.Database): CommandDashboardSourceData {
  const trainees = (db.prepare(`
    SELECT id, rank, name, army_no, organization, status, join_date
    FROM trainees
    ORDER BY organization, name
  `).all() as any[]).map((row) => ({
    id: String(row.id),
    rank: String(row.rank),
    name: String(row.name),
    armyNo: String(row.army_no),
    organization: String(row.organization),
    status: String(row.status),
    joinDate: String(row.join_date),
  }));

  const courses = (db.prepare(`
    SELECT id, name, code, duration
    FROM courses
    ORDER BY name
  `).all() as any[]).map((row) => ({
    id: String(row.id),
    name: String(row.name),
    code: String(row.code),
    duration: Number(row.duration ?? 0),
  }));

  const capsules = (db.prepare(`
    SELECT cap.id, cap.course_id, c.name AS course_name, c.code AS course_code,
      cap.capsule_number, cap.start_date, cap.end_date, cap.vacancies, cap.nominations, cap.status, cap.location_state
    FROM capsules cap
    INNER JOIN courses c ON c.id = cap.course_id
    ORDER BY cap.start_date DESC
  `).all() as any[]).map((row) => ({
    id: String(row.id),
    courseId: String(row.course_id),
    courseName: String(row.course_name),
    courseCode: String(row.course_code),
    capsuleNumber: Number(row.capsule_number ?? 0),
    startDate: String(row.start_date),
    endDate: String(row.end_date),
    vacancies: Number(row.vacancies ?? 0),
    nominations: Number(row.nominations ?? 0),
    status: String(row.status),
    locationState: row.location_state === null || row.location_state === undefined ? null : String(row.location_state),
  }));

  const performanceRecords = (db.prepare(`
    SELECT pr.id, pr.trainee_id, t.name AS trainee_name, t.army_no, t.organization,
      pr.course_id, c.name AS course_name, c.code AS course_code, pr.capsule_id,
      pr.result, pr.grade, pr.score, pr.completion_date, pr.is_rtu,
      pr.rtu_reason_code, pr.rtu_reason_details
    FROM performance_records pr
    INNER JOIN trainees t ON t.id = pr.trainee_id
    INNER JOIN courses c ON c.id = pr.course_id
    ORDER BY pr.completion_date DESC
  `).all() as any[]).map((row) => ({
    id: String(row.id),
    traineeId: String(row.trainee_id),
    traineeName: String(row.trainee_name),
    armyNo: String(row.army_no),
    organization: String(row.organization),
    courseId: String(row.course_id),
    courseName: String(row.course_name),
    courseCode: String(row.course_code),
    capsuleId: String(row.capsule_id),
    result: String(row.result),
    grade: row.grade === null || row.grade === undefined ? null : String(row.grade),
    score: row.score === null || row.score === undefined ? null : Number(row.score),
    completionDate: String(row.completion_date),
    isRtu: row.is_rtu === 1 || row.is_rtu === true,
    rtuReasonCode: row.rtu_reason_code === null || row.rtu_reason_code === undefined ? null : String(row.rtu_reason_code),
    rtuReasonDetails: row.rtu_reason_details === null || row.rtu_reason_details === undefined ? null : String(row.rtu_reason_details),
  }));

  const constraints = (db.prepare(`
    SELECT id, name, description, type, priority, is_active, rules
    FROM constraints
    ORDER BY priority ASC, name ASC
  `).all() as any[]).map((row) => ({
    id: String(row.id),
    name: String(row.name),
    description: row.description === null || row.description === undefined ? null : String(row.description),
    type: String(row.type),
    priority: Number(row.priority ?? 0),
    isActive: row.is_active === 1 || row.is_active === true,
    rules: String(row.rules ?? ''),
  }));

  const allocationRuns = (db.prepare(`
    SELECT ar.id, c.name AS course_name, c.code AS course_code, cap.capsule_number,
      ar.status, ar.total_slots, ar.confidence, ar.created_at
    FROM allocation_runs ar
    INNER JOIN courses c ON c.id = ar.course_id
    INNER JOIN capsules cap ON cap.id = ar.capsule_id
    ORDER BY ar.created_at DESC
    LIMIT 100
  `).all() as any[]).map((row) => ({
    id: String(row.id),
    courseName: String(row.course_name),
    courseCode: String(row.course_code),
    capsuleNumber: Number(row.capsule_number ?? 0),
    status: String(row.status),
    totalSlots: Number(row.total_slots ?? 0),
    confidence: Number(row.confidence ?? 0),
    createdAt: String(row.created_at),
  }));

  const activities = (db.prepare(`
    SELECT id, type, description, created_at
    FROM activities
    ORDER BY created_at DESC
    LIMIT 100
  `).all() as any[]).map((row) => ({
    id: String(row.id),
    type: String(row.type),
    description: String(row.description),
    createdAt: String(row.created_at),
  }));

  const users = (db.prepare(`
    SELECT id, name, email, role, organization, is_active
    FROM users
    ORDER BY name
  `).all() as any[]).map((row) => ({
    id: String(row.id),
    name: String(row.name),
    email: String(row.email),
    role: String(row.role),
    organization: row.organization === null || row.organization === undefined ? null : String(row.organization),
    isActive: row.is_active === 1 || row.is_active === true,
  }));

  return { trainees, courses, capsules, performanceRecords, constraints, allocationRuns, activities, users };
}

export function buildCommandDashboard(db: Database.Database): CommandDashboardPayload {
  return buildCommandDashboardFromRows(loadCommandDashboardSourceData(db));
}
