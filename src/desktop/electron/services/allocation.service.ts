import type Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import {
  generateAllocationRecommendations,
  type AllocationConstraint,
  type AllocationEngineResult,
  type AllocationOrgMetrics,
} from '../../src/lib/allocationEngine';

interface CourseRow {
  id: string;
  name: string;
}

interface CapsuleRow {
  id: string;
  course_id: string;
  capsule_number: number;
  vacancies: number;
}

interface ConstraintRow {
  id: string;
  name: string;
  type: string;
  is_active: number;
  rules: string;
}

interface AllocationRunRow {
  id: string;
  course_id: string;
  capsule_id: string;
  status: 'generated' | 'review' | 'applied';
  total_slots: number;
  confidence: number;
  recommendations: string;
  applied_constraints: string;
  constraint_results: string;
  created_at: string;
  updated_at: string;
}

export type AllocationStatus = 'generated' | 'review' | 'applied';

function mapConstraint(row: ConstraintRow): AllocationConstraint {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    isActive: row.is_active === 1,
    rules: JSON.parse(row.rules),
  };
}

function getTargetCapsule(db: Database.Database, courseId: string, capsuleId?: string): CapsuleRow {
  if (capsuleId) {
    const capsule = db.prepare('SELECT * FROM capsules WHERE id = ? AND course_id = ?').get(capsuleId, courseId) as CapsuleRow | undefined;
    if (!capsule) throw new Error(`Capsule not found for selected course: ${capsuleId}`);
    return capsule;
  }

  const capsule = db
    .prepare(
      `SELECT * FROM capsules
       WHERE course_id = ?
       ORDER BY
         CASE status WHEN 'Ongoing' THEN 0 WHEN 'Scheduled' THEN 1 ELSE 2 END,
         start_date ASC
       LIMIT 1`
    )
    .get(courseId) as CapsuleRow | undefined;

  if (!capsule) throw new Error(`No capsule found for course: ${courseId}`);
  return capsule;
}

function getOrganizationMetrics(db: Database.Database, courseId: string): AllocationOrgMetrics[] {
  const activeRows = db
    .prepare(
      `SELECT organization, COUNT(*) AS active_trainees
       FROM trainees
       WHERE status IN ('Active', 'In Training')
       GROUP BY organization`
    )
    .all() as { organization: string; active_trainees: number }[];

  const performanceRows = db
    .prepare(
      `SELECT t.organization,
              COUNT(pr.id) AS historical_count,
              SUM(CASE WHEN pr.result = 'Pass' THEN 1 ELSE 0 END) AS passed,
              SUM(CASE WHEN pr.is_rtu = 1 THEN 1 ELSE 0 END) AS rtu_count
       FROM performance_records pr
       JOIN trainees t ON t.id = pr.trainee_id
       WHERE pr.course_id = ?
       GROUP BY t.organization`
    )
    .all(courseId) as {
      organization: string;
      historical_count: number;
      passed: number | null;
      rtu_count: number | null;
    }[];

  const performanceByOrg = new Map(performanceRows.map((row) => [row.organization, row]));

  return activeRows.map((row) => {
    const perf = performanceByOrg.get(row.organization);
    const historicalCount = perf?.historical_count ?? 0;
    const passed = perf?.passed ?? 0;
    const rtuCount = perf?.rtu_count ?? 0;
    return {
      organization: row.organization,
      activeTrainees: row.active_trainees,
      historicalCount,
      passRate: historicalCount > 0 ? (passed / historicalCount) * 100 : 50,
      rtuRate: historicalCount > 0 ? (rtuCount / historicalCount) * 100 : 0,
    };
  });
}

function mapAllocationRun(row: AllocationRunRow) {
  return {
    id: row.id,
    courseId: row.course_id,
    capsuleId: row.capsule_id,
    status: row.status,
    totalSlots: row.total_slots,
    confidence: row.confidence,
    recommendations: JSON.parse(row.recommendations),
    appliedConstraints: JSON.parse(row.applied_constraints),
    constraintResults: JSON.parse(row.constraint_results),
    generatedAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function generateAllocationRun(
  db: Database.Database,
  courseId: string,
  capsuleId?: string
): AllocationEngineResult & { id: string; generatedAt: string; status: AllocationStatus } {
  const course = db.prepare('SELECT id, name FROM courses WHERE id = ?').get(courseId) as CourseRow | undefined;
  if (!course) throw new Error(`Course not found: ${courseId}`);

  const capsule = getTargetCapsule(db, courseId, capsuleId);
  const organizations = getOrganizationMetrics(db, courseId);
  const constraints = (db.prepare('SELECT * FROM constraints ORDER BY priority ASC').all() as ConstraintRow[]).map(mapConstraint);

  const result = generateAllocationRecommendations({
    courseId: course.id,
    courseName: course.name,
    capsuleId: capsule.id,
    totalVacancies: capsule.vacancies,
    organizations,
    constraints,
  });

  const id = uuidv4();
  const now = new Date().toISOString();
  const allocation = { ...result, id, generatedAt: now, status: 'generated' as AllocationStatus };

  db.prepare(
    `INSERT INTO allocation_runs
      (id, course_id, capsule_id, status, total_slots, confidence, recommendations, applied_constraints, constraint_results, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    allocation.courseId,
    allocation.capsuleId,
    allocation.status,
    allocation.totalSlots,
    allocation.confidence,
    JSON.stringify(allocation.recommendations),
    JSON.stringify(allocation.appliedConstraints),
    JSON.stringify(allocation.constraintResults),
    now,
    now
  );

  db.prepare(
    `INSERT INTO activities (id, user_id, type, description, metadata, created_at)
     VALUES (?, NULL, 'allocation_generated', ?, ?, ?)`
  ).run(
    uuidv4(),
    `Allocation generated for ${course.name} (Capsule ${capsule.capsule_number})`,
    JSON.stringify({ allocationId: id, courseId: course.id, capsuleId: capsule.id }),
    now
  );

  return allocation;
}

export function updateAllocationStatus(
  db: Database.Database,
  id: string,
  status: AllocationStatus
) {
  const existing = db.prepare('SELECT * FROM allocation_runs WHERE id = ?').get(id) as AllocationRunRow | undefined;
  if (!existing) throw new Error(`Allocation run not found: ${id}`);

  const now = new Date().toISOString();
  db.prepare('UPDATE allocation_runs SET status = ?, updated_at = ? WHERE id = ?').run(status, now, id);

  db.prepare(
    `INSERT INTO activities (id, user_id, type, description, metadata, created_at)
     VALUES (?, NULL, 'allocation_generated', ?, ?, ?)`
  ).run(
    uuidv4(),
    status === 'applied' ? 'Allocation marked as applied' : 'Allocation saved for review',
    JSON.stringify({ allocationId: id, status }),
    now
  );

  const updated = db.prepare('SELECT * FROM allocation_runs WHERE id = ?').get(id) as AllocationRunRow;
  return mapAllocationRun(updated);
}

export function getRecentAllocationRuns(db: Database.Database, limit = 10) {
  const rows = db
    .prepare('SELECT * FROM allocation_runs ORDER BY created_at DESC LIMIT ?')
    .all(limit) as AllocationRunRow[];
  return rows.map(mapAllocationRun);
}
