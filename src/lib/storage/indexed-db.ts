import { openDB, DBSchema, IDBPDatabase } from 'idb';
import type { Activity, SyncQueueItem } from '@/types/unified';
import type { TrainingPlan } from '@/types/training';
import type { PersonalRecordsDTO } from '@/types/records';

// Database schema
interface RunTrackDB extends DBSchema {
  activities: {
    key: string;
    value: Activity;
    indexes: {
      'by-user': string;
      'by-date': number;
      'by-sync': string;
    };
  };
  trainingPlans: {
    key: string;
    value: TrainingPlan;
    indexes: {
      'by-user': string;
      'by-active': [string, number]; // [userId, isActive as 0/1]
    };
  };
  personalRecords: {
    key: string;
    value: PersonalRecordsDTO;
  };
  pendingSync: {
    key: string;
    value: SyncQueueItem;
    indexes: {
      'by-timestamp': number;
    };
  };
}

const DB_NAME = 'runtrack-pro';
const DB_VERSION = 1;

let dbInstance: IDBPDatabase<RunTrackDB> | null = null;

// Initialize the database
export async function initDB(): Promise<IDBPDatabase<RunTrackDB>> {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB<RunTrackDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Activities store
      if (!db.objectStoreNames.contains('activities')) {
        const activityStore = db.createObjectStore('activities', { keyPath: 'id' });
        activityStore.createIndex('by-user', 'userId');
        activityStore.createIndex('by-date', 'startTime');
        activityStore.createIndex('by-sync', 'syncStatus');
      }

      // Training plans store
      if (!db.objectStoreNames.contains('trainingPlans')) {
        const planStore = db.createObjectStore('trainingPlans', { keyPath: 'id' });
        planStore.createIndex('by-user', 'userId');
        planStore.createIndex('by-active', ['userId', 'isActive']);
      }

      // Personal records store
      if (!db.objectStoreNames.contains('personalRecords')) {
        db.createObjectStore('personalRecords', { keyPath: 'userId' });
      }

      // Pending sync queue
      if (!db.objectStoreNames.contains('pendingSync')) {
        const syncStore = db.createObjectStore('pendingSync', { keyPath: 'id' });
        syncStore.createIndex('by-timestamp', 'timestamp');
      }
    },
  });

  return dbInstance;
}

// Activity operations
export async function saveActivity(activity: Activity): Promise<void> {
  const db = await initDB();
  await db.put('activities', activity);
}

export async function getActivity(id: string): Promise<Activity | undefined> {
  const db = await initDB();
  return db.get('activities', id);
}

export async function getAllActivities(userId: string): Promise<Activity[]> {
  const db = await initDB();
  const index = db.transaction('activities').store.index('by-user');
  return index.getAll(userId);
}

export async function getActivitiesByDateRange(
  userId: string,
  startDate: number,
  endDate: number
): Promise<Activity[]> {
  const db = await initDB();
  const activities = await getAllActivities(userId);
  return activities.filter((a) => a.startTime >= startDate && a.startTime <= endDate);
}

export async function deleteActivity(id: string): Promise<void> {
  const db = await initDB();
  await db.delete('activities', id);
}

export async function getActivitiesPendingSync(): Promise<Activity[]> {
  const db = await initDB();
  const index = db.transaction('activities').store.index('by-sync');
  return index.getAll('pending');
}

// Training plan operations
export async function saveTrainingPlan(plan: TrainingPlan): Promise<void> {
  const db = await initDB();
  await db.put('trainingPlans', plan);
}

export async function getTrainingPlan(id: string): Promise<TrainingPlan | undefined> {
  const db = await initDB();
  return db.get('trainingPlans', id);
}

export async function getAllTrainingPlans(userId: string): Promise<TrainingPlan[]> {
  const db = await initDB();
  const index = db.transaction('trainingPlans').store.index('by-user');
  return index.getAll(userId);
}

export async function getActiveTrainingPlan(userId: string): Promise<TrainingPlan | undefined> {
  const db = await initDB();
  const plans = await getAllTrainingPlans(userId);
  return plans.find((p) => p.isActive);
}

export async function deleteTrainingPlan(id: string): Promise<void> {
  const db = await initDB();
  await db.delete('trainingPlans', id);
}

// Personal records operations
export async function savePersonalRecords(records: PersonalRecordsDTO): Promise<void> {
  const db = await initDB();
  await db.put('personalRecords', records);
}

export async function getPersonalRecords(userId: string): Promise<PersonalRecordsDTO | undefined> {
  const db = await initDB();
  return db.get('personalRecords', userId);
}

// Sync queue operations
export async function addToSyncQueue(item: SyncQueueItem): Promise<void> {
  const db = await initDB();
  await db.put('pendingSync', item);
}

export async function getSyncQueue(): Promise<SyncQueueItem[]> {
  const db = await initDB();
  const index = db.transaction('pendingSync').store.index('by-timestamp');
  return index.getAll();
}

export async function removeSyncQueueItem(id: string): Promise<void> {
  const db = await initDB();
  await db.delete('pendingSync', id);
}

export async function clearSyncQueue(): Promise<void> {
  const db = await initDB();
  await db.clear('pendingSync');
}

// Utility: count activities
export async function countActivities(userId: string): Promise<number> {
  const activities = await getAllActivities(userId);
  return activities.length;
}

// Utility: get recent activities
export async function getRecentActivities(userId: string, limit: number = 10): Promise<Activity[]> {
  const activities = await getAllActivities(userId);
  return activities.sort((a, b) => b.startTime - a.startTime).slice(0, limit);
}
