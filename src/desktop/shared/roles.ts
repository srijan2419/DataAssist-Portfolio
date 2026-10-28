export const USER_ROLES = ['Admin', 'Manager', 'Data Entry', 'Viewer'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const OPERATIONAL_CREATE_ROLES = ['Admin', 'Manager', 'Data Entry'] as const;
export const OPERATIONAL_MODIFY_ROLES = ['Admin', 'Manager'] as const;
export const ALLOCATION_GENERATE_ROLES = ['Admin', 'Manager', 'Data Entry'] as const;
export const ALLOCATION_STATUS_ROLES = ['Admin', 'Manager'] as const;
export const CONSTRAINT_MANAGE_ROLES = ['Admin', 'Manager'] as const;
export const SYSTEM_ADMIN_ROLES = ['Admin'] as const;

export function isUserRole(value: unknown): value is UserRole {
  return typeof value === 'string' && (USER_ROLES as readonly string[]).includes(value);
}

export function hasAllowedRole(role: string | null | undefined, allowedRoles: readonly string[]): boolean {
  return Boolean(role && allowedRoles.includes(role));
}

export function canCreateOperationalData(role: string | null | undefined): boolean {
  return hasAllowedRole(role, OPERATIONAL_CREATE_ROLES);
}

export function canModifyOperationalData(role: string | null | undefined): boolean {
  return hasAllowedRole(role, OPERATIONAL_MODIFY_ROLES);
}

export function canGenerateAllocations(role: string | null | undefined): boolean {
  return hasAllowedRole(role, ALLOCATION_GENERATE_ROLES);
}

export function canUpdateAllocationStatus(role: string | null | undefined): boolean {
  return hasAllowedRole(role, ALLOCATION_STATUS_ROLES);
}
