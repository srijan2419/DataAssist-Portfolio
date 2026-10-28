import { ipcMain } from 'electron';
import { getSqliteDb } from '../database/connection';
import {
  generateAllocationRun,
  getRecentAllocationRuns,
  updateAllocationStatus,
  type AllocationStatus,
} from '../services/allocation.service';
import { requireRole } from './auth.ipc';
import { ALLOCATION_GENERATE_ROLES, ALLOCATION_STATUS_ROLES } from '../auth/roles';

export function registerAllocationsHandlers(): void {
  ipcMain.handle('allocations:generate', async (_event, courseId: string, capsuleId?: string) => {
    try {
      requireRole(ALLOCATION_GENERATE_ROLES);
      const db = getSqliteDb();
      return generateAllocationRun(db, courseId, capsuleId);
    } catch (error: any) {
      console.error('[Allocations] generate failed:', error.message);
      throw error;
    }
  });

  ipcMain.handle('allocations:updateStatus', async (_event, id: string, status: AllocationStatus) => {
    try {
      requireRole(ALLOCATION_STATUS_ROLES);
      const db = getSqliteDb();
      return updateAllocationStatus(db, id, status);
    } catch (error: any) {
      console.error('[Allocations] updateStatus failed:', error.message);
      throw error;
    }
  });

  ipcMain.handle('allocations:getRecent', async (_event, limit?: number) => {
    try {
      const db = getSqliteDb();
      requireRole(ALLOCATION_GENERATE_ROLES);
      return getRecentAllocationRuns(db, limit ?? 10);
    } catch (error: any) {
      console.error('[Allocations] getRecent failed:', error.message);
      throw error;
    }
  });
}
