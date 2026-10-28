import { describe, expect, it } from 'vitest';
import { generateAllocationRecommendations } from './allocationEngine';

const orgs = [
  { organization: 'Alpha Unit', activeTrainees: 40, historicalCount: 40, passRate: 94, rtuRate: 4 },
  { organization: 'Delta Unit', activeTrainees: 18, historicalCount: 18, passRate: 74, rtuRate: 6 },
  { organization: 'Echo Unit', activeTrainees: 14, historicalCount: 14, passRate: 71, rtuRate: 4 },
  { organization: 'Bravo Unit', activeTrainees: 20, historicalCount: 20, passRate: 63, rtuRate: 16 },
  { organization: 'Charlie Unit', activeTrainees: 10, historicalCount: 10, passRate: 68, rtuRate: 7 },
];

describe('generateAllocationRecommendations', () => {
  it('fills all vacancies while respecting maximum organization percentage and minimum seats', () => {
    const result = generateAllocationRecommendations({
      courseId: 'CRS001',
      courseName: 'Advanced Leadership Course',
      capsuleId: 'CAP001',
      totalVacancies: 20,
      organizations: orgs,
      constraints: [
        {
          id: 'CNS001',
          name: 'Maximum Trainees Per Organization',
          type: 'Hard',
          isActive: true,
          rules: [{ field: 'organization_percentage', operator: 'less_than', value: 30 }],
        },
        {
          id: 'CNS008',
          name: 'Minimum Organization Allocation',
          type: 'Hard',
          isActive: true,
          rules: [{ field: 'min_allocation_per_org', operator: 'greater_than', value: 2 }],
        },
      ],
    });

    const totalRecommended = result.recommendations.reduce((sum, rec) => sum + rec.recommendedCount, 0);
    const largestAllocation = Math.max(...result.recommendations.map((rec) => rec.recommendedCount));
    const smallestAllocation = Math.min(...result.recommendations.map((rec) => rec.recommendedCount));

    expect(totalRecommended).toBe(20);
    expect(largestAllocation).toBeLessThanOrEqual(6);
    expect(smallestAllocation).toBeGreaterThanOrEqual(2);
    expect(result.appliedConstraints).toEqual([
      'Maximum Trainees Per Organization',
      'Minimum Organization Allocation',
    ]);
    expect(result.constraintResults.every((constraint) => constraint.satisfied)).toBe(true);
  });

  it('uses priority organization, pass-rate, and RTU constraints to influence the ranking', () => {
    const result = generateAllocationRecommendations({
      courseId: 'CRS001',
      courseName: 'Advanced Leadership Course',
      capsuleId: 'CAP001',
      totalVacancies: 12,
      organizations: orgs,
      constraints: [
        {
          id: 'CNS003',
          name: 'Priority Organizations',
          type: 'Soft',
          isActive: true,
          rules: [
            {
              field: 'organization',
              operator: 'in',
              value: ['Echo Unit', 'Delta Unit'],
            },
          ],
        },
        {
          id: 'CNS004',
          name: 'Performance-Based Allocation',
          type: 'Soft',
          isActive: true,
          rules: [{ field: 'historical_pass_rate', operator: 'greater_than', value: 80 }],
        },
        {
          id: 'CNS007',
          name: 'RTU Rate Threshold',
          type: 'Hard',
          isActive: true,
          rules: [{ field: 'rtu_rate', operator: 'less_than', value: 15 }],
        },
      ],
    });

    const deltaOrg = result.recommendations.find((rec) => rec.organization === 'Delta Unit');
    const bravo = result.recommendations.find((rec) => rec.organization === 'Bravo Unit');

    expect(deltaOrg).toBeDefined();
    expect(bravo).toBeDefined();
    expect(deltaOrg!.recommendedCount).toBeGreaterThanOrEqual(bravo!.recommendedCount);
    expect(deltaOrg!.justification).toContain('priority organization');
    expect(bravo!.justification).toContain('RTU rate above threshold');
  });

  it('ignores inactive constraints and reports active vacancy utilization', () => {
    const result = generateAllocationRecommendations({
      courseId: 'CRS001',
      courseName: 'Advanced Leadership Course',
      capsuleId: 'CAP001',
      totalVacancies: 10,
      organizations: orgs.slice(0, 3),
      constraints: [
        {
          id: 'inactive',
          name: 'Inactive Priority',
          type: 'Soft',
          isActive: false,
          rules: [{ field: 'organization', operator: 'in', value: ['Alpha Unit'] }],
        },
        {
          id: 'CNS002',
          name: 'Minimum Vacancy Utilization',
          type: 'Hard',
          isActive: true,
          rules: [{ field: 'vacancy_utilization', operator: 'greater_than', value: 85 }],
        },
      ],
    });

    expect(result.appliedConstraints).toEqual(['Minimum Vacancy Utilization']);
    expect(result.constraintResults).toContainEqual(
      expect.objectContaining({
        name: 'Minimum Vacancy Utilization',
        satisfied: true,
      })
    );
  });
});
