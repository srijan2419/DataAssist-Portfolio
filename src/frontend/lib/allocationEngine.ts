export type AllocationConstraintType = 'Hard' | 'Soft' | string;

export interface AllocationRule {
  field: string;
  operator: 'equals' | 'greater_than' | 'less_than' | 'between' | 'in' | string;
  value: string | number | string[];
}

export interface AllocationConstraint {
  id: string;
  name: string;
  type: AllocationConstraintType;
  isActive: boolean;
  rules: AllocationRule[];
}

export interface AllocationOrgMetrics {
  organization: string;
  activeTrainees: number;
  historicalCount: number;
  passRate: number;
  rtuRate: number;
}

export interface AllocationEngineInput {
  courseId: string;
  courseName: string;
  capsuleId: string;
  totalVacancies: number;
  organizations: AllocationOrgMetrics[];
  constraints: AllocationConstraint[];
}

export interface ConstraintResult {
  id: string;
  name: string;
  type: AllocationConstraintType;
  satisfied: boolean;
  detail: string;
}

export interface AllocationRecommendationResult {
  organization: string;
  recommendedCount: number;
  justification: string;
  successProbability: number;
  historicalCount: number;
}

export interface AllocationEngineResult {
  id?: string;
  courseId: string;
  courseName: string;
  capsuleId: string;
  totalSlots: number;
  recommendations: AllocationRecommendationResult[];
  appliedConstraints: string[];
  constraintResults: ConstraintResult[];
  confidence: number;
}

interface RankedOrg extends AllocationOrgMetrics {
  score: number;
  adjustments: string[];
}

function toNumber(value: unknown, fallback: number): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function ruleValueAsList(value: string | number | string[]): string[] {
  if (Array.isArray(value)) return value.map(String);
  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function findRule(constraints: AllocationConstraint[], field: string): AllocationRule | undefined {
  for (const constraint of constraints) {
    const rule = constraint.rules.find((candidate) => candidate.field === field);
    if (rule) return rule;
  }
  return undefined;
}

function minimumForRule(rule: AllocationRule | undefined, fallback: number): number {
  if (!rule) return fallback;
  const value = Math.max(1, Math.floor(toNumber(rule.value, fallback)));
  return value;
}

function uniqueMinimumForRule(rule: AllocationRule | undefined): number {
  if (!rule) return 0;
  const value = Math.max(0, Math.floor(toNumber(rule.value, 0)));
  return rule.operator === 'greater_than' ? value + 1 : value;
}

function calculateScore(
  org: AllocationOrgMetrics,
  priorityOrganizations: Set<string>,
  passRateThreshold: number | null,
  rtuThreshold: number | null
): RankedOrg {
  const adjustments: string[] = [];
  let score = org.passRate + Math.log(Math.max(1, org.activeTrainees)) * 4;

  if (priorityOrganizations.has(org.organization)) {
    score += 18;
    adjustments.push('priority organization');
  }

  if (passRateThreshold !== null && org.passRate > passRateThreshold) {
    score += 10;
    adjustments.push(`pass rate above ${passRateThreshold}%`);
  }

  if (rtuThreshold !== null && org.rtuRate > rtuThreshold) {
    score -= 20;
    adjustments.push('RTU rate above threshold');
  }

  return { ...org, score: Math.max(1, score), adjustments };
}

function buildJustification(org: RankedOrg): string {
  const parts = [
    `Historical pass rate ${org.passRate.toFixed(1)}%`,
    `${org.activeTrainees} active eligible trainees`,
    `${org.rtuRate.toFixed(1)}% RTU rate`,
  ];

  if (org.adjustments.length > 0) {
    parts.push(org.adjustments.join(', '));
  }

  return parts.join('; ') + '.';
}

function evaluateConstraints(
  constraints: AllocationConstraint[],
  recommendations: AllocationRecommendationResult[],
  organizations: RankedOrg[],
  totalVacancies: number
): ConstraintResult[] {
  const allocated = recommendations.reduce((sum, rec) => sum + rec.recommendedCount, 0);

  return constraints.map((constraint) => {
    let satisfied = true;
    const details: string[] = [];

    for (const rule of constraint.rules) {
      switch (rule.field) {
        case 'organization_percentage': {
          const limit = toNumber(rule.value, 100);
          const largest = recommendations.length
            ? Math.max(...recommendations.map((rec) => (rec.recommendedCount / totalVacancies) * 100))
            : 0;
          satisfied = satisfied && largest <= limit;
          details.push(`largest organization share ${largest.toFixed(1)}% <= ${limit}%`);
          break;
        }
        case 'vacancy_utilization': {
          const minimum = toNumber(rule.value, 0);
          const utilization = totalVacancies > 0 ? (allocated / totalVacancies) * 100 : 0;
          satisfied = satisfied && utilization >= minimum;
          details.push(`vacancy utilization ${utilization.toFixed(1)}% >= ${minimum}%`);
          break;
        }
        case 'organization': {
          const prioritySet = new Set(ruleValueAsList(rule.value));
          const represented = recommendations.some((rec) => prioritySet.has(rec.organization));
          satisfied = satisfied && represented;
          details.push(represented ? 'priority organization represented' : 'priority organization not represented');
          break;
        }
        case 'historical_pass_rate': {
          const threshold = toNumber(rule.value, 0);
          const qualifying = organizations.filter((org) => org.passRate > threshold);
          const represented = recommendations.some((rec) =>
            qualifying.some((org) => org.organization === rec.organization)
          );
          satisfied = satisfied && represented;
          details.push(`${qualifying.length} organization(s) above ${threshold}% pass rate`);
          break;
        }
        case 'rank_distribution': {
          details.push('rank mix tracked at nomination level');
          break;
        }
        case 'unique_organizations': {
          const minimum = uniqueMinimumForRule(rule);
          satisfied = satisfied && recommendations.length >= minimum;
          details.push(`${recommendations.length} unique organizations >= ${minimum}`);
          break;
        }
        case 'rtu_rate': {
          const threshold = toNumber(rule.value, 100);
          const highRtu = organizations.filter((org) => org.rtuRate > threshold);
          const highRtuAllocations = recommendations.filter((rec) =>
            highRtu.some((org) => org.organization === rec.organization)
          );
          const reduced = highRtuAllocations.every((rec) => rec.recommendedCount <= 2);
          satisfied = satisfied && reduced;
          details.push(
            highRtu.length > 0
              ? `${highRtu.length} high-RTU organization(s) reduced`
              : `all organizations below ${threshold}% RTU`
          );
          break;
        }
        case 'min_allocation_per_org': {
          const minimum = minimumForRule(rule, 1);
          const allMeetMinimum = recommendations.every((rec) => rec.recommendedCount >= minimum);
          satisfied = satisfied && allMeetMinimum;
          details.push(`minimum allocation ${minimum} seat(s) per organization`);
          break;
        }
        default:
          details.push(`${rule.field} recorded for audit`);
      }
    }

    return {
      id: constraint.id,
      name: constraint.name,
      type: constraint.type,
      satisfied,
      detail: details.join('; '),
    };
  });
}

export function generateAllocationRecommendations(input: AllocationEngineInput): AllocationEngineResult {
  const totalVacancies = Math.max(0, Math.floor(input.totalVacancies));
  const activeConstraints = input.constraints.filter((constraint) => constraint.isActive);
  const maxOrgPercentageRule = findRule(activeConstraints, 'organization_percentage');
  const minAllocationRule = findRule(activeConstraints, 'min_allocation_per_org');
  const uniqueOrganizationsRule = findRule(activeConstraints, 'unique_organizations');
  const priorityOrganizationRule = findRule(activeConstraints, 'organization');
  const passRateRule = findRule(activeConstraints, 'historical_pass_rate');
  const rtuRule = findRule(activeConstraints, 'rtu_rate');

  const priorityOrganizations = new Set(
    priorityOrganizationRule ? ruleValueAsList(priorityOrganizationRule.value) : []
  );
  const passRateThreshold = passRateRule ? toNumber(passRateRule.value, 80) : null;
  const rtuThreshold = rtuRule ? toNumber(rtuRule.value, 15) : null;

  const rankedOrganizations = input.organizations
    .filter((org) => org.activeTrainees > 0)
    .map((org) => calculateScore(org, priorityOrganizations, passRateThreshold, rtuThreshold))
    .sort((a, b) => b.score - a.score || a.organization.localeCompare(b.organization));

  if (totalVacancies === 0 || rankedOrganizations.length === 0) {
    return {
      courseId: input.courseId,
      courseName: input.courseName,
      capsuleId: input.capsuleId,
      totalSlots: totalVacancies,
      recommendations: [],
      appliedConstraints: activeConstraints.map((constraint) => constraint.name),
      constraintResults: evaluateConstraints(activeConstraints, [], rankedOrganizations, Math.max(1, totalVacancies)),
      confidence: 0,
    };
  }

  const minimumAllocation = minimumForRule(minAllocationRule, 1);
  const uniqueMinimum = uniqueMinimumForRule(uniqueOrganizationsRule);
  const maxOrgPercentage = maxOrgPercentageRule ? toNumber(maxOrgPercentageRule.value, 100) : 100;
  const maxPerOrganization = Math.max(
    minimumAllocation,
    Math.floor((totalVacancies * maxOrgPercentage) / 100) || totalVacancies
  );

  let desiredOrganizations = Math.min(
    rankedOrganizations.length,
    Math.max(
      3,
      uniqueMinimum,
      Math.ceil(totalVacancies / Math.max(minimumAllocation, 2)),
      Math.ceil(totalVacancies / maxPerOrganization)
    ),
    10
  );

  while (desiredOrganizations > 1 && desiredOrganizations * minimumAllocation > totalVacancies) {
    desiredOrganizations--;
  }

  const selected = rankedOrganizations.slice(0, desiredOrganizations);
  const allocations = new Map<string, number>();
  selected.forEach((org) => allocations.set(org.organization, Math.min(minimumAllocation, totalVacancies)));

  let remaining = totalVacancies - selected.reduce((sum, org) => sum + (allocations.get(org.organization) ?? 0), 0);

  while (remaining > 0) {
    const candidate = selected
      .filter((org) => (allocations.get(org.organization) ?? 0) < maxPerOrganization)
      .sort((a, b) => {
        const aAllocated = allocations.get(a.organization) ?? 0;
        const bAllocated = allocations.get(b.organization) ?? 0;
        return b.score / (bAllocated + 1) - a.score / (aAllocated + 1);
      })[0];

    if (!candidate) break;
    allocations.set(candidate.organization, (allocations.get(candidate.organization) ?? 0) + 1);
    remaining--;
  }

  const recommendations = selected
    .map((org) => ({
      organization: org.organization,
      recommendedCount: allocations.get(org.organization) ?? 0,
      justification: buildJustification(org),
      successProbability: Math.max(35, Math.min(98, Math.round((org.passRate - org.rtuRate * 0.25) * 10) / 10)),
      historicalCount: org.historicalCount,
    }))
    .filter((rec) => rec.recommendedCount > 0)
    .sort((a, b) => b.recommendedCount - a.recommendedCount || b.successProbability - a.successProbability);

  const constraintResults = evaluateConstraints(
    activeConstraints,
    recommendations,
    rankedOrganizations,
    Math.max(1, totalVacancies)
  );
  const satisfiedCount = constraintResults.filter((constraint) => constraint.satisfied).length;
  const confidence =
    constraintResults.length === 0
      ? 0.8
      : Math.round((0.65 + (satisfiedCount / constraintResults.length) * 0.3) * 1000) / 1000;

  return {
    courseId: input.courseId,
    courseName: input.courseName,
    capsuleId: input.capsuleId,
    totalSlots: totalVacancies,
    recommendations,
    appliedConstraints: activeConstraints.map((constraint) => constraint.name),
    constraintResults,
    confidence,
  };
}
