import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp,
  writeBatch,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Activity, SyncQueueItem } from '@/types/unified';
import type { TrainingPlan } from '@/types/training';
import type { PersonalRecordsDTO } from '@/types/records';
import * as idb from './indexed-db';

// Convert Activity for Firestore (dates as Timestamps)
function activityToFirestore(activity: Activity): Record<string, unknown> {
  return {
    ...activity,
    startTime: Timestamp.fromMillis(activity.startTime),
    endTime: Timestamp.fromMillis(activity.endTime),
    createdAt: Timestamp.fromMillis(activity.createdAt),
    updatedAt: Timestamp.fromMillis(activity.updatedAt),
    lastSyncedAt: Timestamp.now(),
    syncStatus: 'synced',
    // Convert points timestamps
    points: activity.points.map((p) => ({
      ...p,
      timestamp: Timestamp.fromMillis(p.timestamp),
    })),
    // Convert best efforts dates
    bestEfforts: activity.bestEfforts.map((e) => ({
      ...e,
      date: Timestamp.fromMillis(e.date),
    })),
  };
}

// Convert Firestore document to Activity
function firestoreToActivity(data: Record<string, unknown>): Activity {
  return {
    ...data,
    startTime: (data.startTime as Timestamp).toMillis(),
    endTime: (data.endTime as Timestamp).toMillis(),
    createdAt: (data.createdAt as Timestamp).toMillis(),
    updatedAt: (data.updatedAt as Timestamp).toMillis(),
    lastSyncedAt: data.lastSyncedAt ? (data.lastSyncedAt as Timestamp).toMillis() : undefined,
    syncStatus: 'synced',
    points: (data.points as Array<Record<string, unknown>>).map((p) => ({
      ...p,
      timestamp: (p.timestamp as Timestamp).toMillis(),
    })),
    bestEfforts: (data.bestEfforts as Array<Record<string, unknown>>).map((e) => ({
      ...e,
      date: (e.date as Timestamp).toMillis(),
    })),
  } as Activity;
}

// Sync a single activity to Firebase
export async function syncActivityToFirebase(activity: Activity): Promise<void> {
  const docRef = doc(db, 'activities', activity.id);
  await setDoc(docRef, activityToFirestore(activity));

  // Update local with synced status
  await idb.saveActivity({
    ...activity,
    syncStatus: 'synced',
    lastSyncedAt: Date.now(),
  });
}

// Fetch activity from Firebase
export async function fetchActivityFromFirebase(id: string): Promise<Activity | null> {
  const docRef = doc(db, 'activities', id);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) return null;
  return firestoreToActivity(docSnap.data());
}

// Fetch all activities for a user from Firebase
export async function fetchActivitiesFromFirebase(userId: string): Promise<Activity[]> {
  const q = query(
    collection(db, 'activities'),
    where('userId', '==', userId),
    orderBy('startTime', 'desc')
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => firestoreToActivity(doc.data()));
}

// Delete activity from Firebase
export async function deleteActivityFromFirebase(id: string): Promise<void> {
  const docRef = doc(db, 'activities', id);
  await deleteDoc(docRef);
}

// Sync training plan to Firebase
export async function syncTrainingPlanToFirebase(plan: TrainingPlan): Promise<void> {
  const docRef = doc(db, 'trainingPlans', plan.id);
  await setDoc(docRef, {
    ...plan,
    createdAt: Timestamp.fromMillis(plan.createdAt),
    updatedAt: Timestamp.fromMillis(plan.updatedAt),
    startDate: Timestamp.fromMillis(plan.startDate),
    endDate: Timestamp.fromMillis(plan.endDate),
  });
}

// Fetch training plans from Firebase
export async function fetchTrainingPlansFromFirebase(userId: string): Promise<TrainingPlan[]> {
  const q = query(collection(db, 'trainingPlans'), where('userId', '==', userId));

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      ...data,
      createdAt: (data.createdAt as Timestamp).toMillis(),
      updatedAt: (data.updatedAt as Timestamp).toMillis(),
      startDate: (data.startDate as Timestamp).toMillis(),
      endDate: (data.endDate as Timestamp).toMillis(),
    } as TrainingPlan;
  });
}

// Sync personal records to Firebase
export async function syncPersonalRecordsToFirebase(records: PersonalRecordsDTO): Promise<void> {
  const docRef = doc(db, 'personalRecords', records.userId);
  await setDoc(docRef, {
    ...records,
    updatedAt: Timestamp.fromMillis(records.updatedAt),
  });
}

// Fetch personal records from Firebase
export async function fetchPersonalRecordsFromFirebase(
  userId: string
): Promise<PersonalRecordsDTO | null> {
  const docRef = doc(db, 'personalRecords', userId);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) return null;
  const data = docSnap.data();
  return {
    ...data,
    updatedAt: (data.updatedAt as Timestamp).toMillis(),
  } as PersonalRecordsDTO;
}

// Process sync queue
export async function processSyncQueue(): Promise<{ success: number; failed: number }> {
  const queue = await idb.getSyncQueue();
  let success = 0;
  let failed = 0;

  for (const item of queue) {
    try {
      switch (item.collection) {
        case 'activities':
          if (item.type === 'delete') {
            await deleteActivityFromFirebase(item.documentId);
          } else {
            const activity = await idb.getActivity(item.documentId);
            if (activity) {
              await syncActivityToFirebase(activity);
            }
          }
          break;

        case 'trainingPlans':
          if (item.type === 'delete') {
            await deleteDoc(doc(db, 'trainingPlans', item.documentId));
          } else {
            const plan = await idb.getTrainingPlan(item.documentId);
            if (plan) {
              await syncTrainingPlanToFirebase(plan);
            }
          }
          break;

        case 'personalRecords':
          const records = await idb.getPersonalRecords(item.documentId);
          if (records) {
            await syncPersonalRecordsToFirebase(records);
          }
          break;
      }

      await idb.removeSyncQueueItem(item.id);
      success++;
    } catch (error) {
      console.error('Sync failed for item:', item.id, error);
      failed++;

      // Increment retry count
      await idb.addToSyncQueue({
        ...item,
        retryCount: item.retryCount + 1,
      });
    }
  }

  return { success, failed };
}

// Full sync: download all data from Firebase and merge with local
export async function fullSync(userId: string): Promise<void> {
  // First, push pending changes
  await processSyncQueue();

  // Fetch activities from Firebase
  const remoteActivities = await fetchActivitiesFromFirebase(userId);
  const localActivities = await idb.getAllActivities(userId);

  // Create maps for easy lookup
  const localMap = new Map(localActivities.map((a) => [a.id, a]));
  const remoteMap = new Map(remoteActivities.map((a) => [a.id, a]));

  // Merge: prefer newer version
  for (const remote of remoteActivities) {
    const local = localMap.get(remote.id);

    if (!local || remote.updatedAt > local.updatedAt) {
      await idb.saveActivity(remote);
    }
  }

  // Push local-only activities to Firebase
  for (const local of localActivities) {
    if (!remoteMap.has(local.id) && local.syncStatus !== 'synced') {
      await syncActivityToFirebase(local);
    }
  }

  // Sync training plans
  const remotePlans = await fetchTrainingPlansFromFirebase(userId);
  for (const plan of remotePlans) {
    await idb.saveTrainingPlan(plan);
  }

  // Sync personal records
  const remoteRecords = await fetchPersonalRecordsFromFirebase(userId);
  if (remoteRecords) {
    await idb.savePersonalRecords(remoteRecords);
  }
}

// Check if online
export function isOnline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine;
}

// Add activity with offline support
export async function addActivity(activity: Activity): Promise<void> {
  // Always save locally first
  await idb.saveActivity({
    ...activity,
    syncStatus: isOnline() ? 'pending' : 'local_only',
  });

  if (isOnline()) {
    try {
      await syncActivityToFirebase(activity);
    } catch (error) {
      console.error('Failed to sync activity:', error);
      // Add to sync queue for later
      await idb.addToSyncQueue({
        id: `sync-${activity.id}-${Date.now()}`,
        type: 'create',
        collection: 'activities',
        documentId: activity.id,
        timestamp: Date.now(),
        retryCount: 0,
      });
    }
  } else {
    // Add to sync queue for when we're back online
    await idb.addToSyncQueue({
      id: `sync-${activity.id}-${Date.now()}`,
      type: 'create',
      collection: 'activities',
      documentId: activity.id,
      timestamp: Date.now(),
      retryCount: 0,
    });
  }
}

// Fast local-only add (for bulk imports)
export async function addActivityLocalOnly(activity: Activity): Promise<void> {
  await idb.saveActivity({
    ...activity,
    syncStatus: 'pending',
  });

  // Queue for later sync
  await idb.addToSyncQueue({
    id: `sync-${activity.id}-${Date.now()}`,
    type: 'create',
    collection: 'activities',
    documentId: activity.id,
    timestamp: Date.now(),
    retryCount: 0,
  });
}

// Bulk add activities (local only, fast)
export async function addActivitiesBulk(activities: Activity[]): Promise<void> {
  for (const activity of activities) {
    await idb.saveActivity({
      ...activity,
      syncStatus: 'pending',
    });
  }

  // Queue all for later sync
  for (const activity of activities) {
    await idb.addToSyncQueue({
      id: `sync-${activity.id}-${Date.now()}`,
      type: 'create',
      collection: 'activities',
      documentId: activity.id,
      timestamp: Date.now(),
      retryCount: 0,
    });
  }
}

// Background sync to Firebase (call after bulk import)
export async function syncPendingActivities(
  onProgress?: (current: number, total: number) => void
): Promise<{ success: number; failed: number }> {
  const queue = await idb.getSyncQueue();
  const activityItems = queue.filter((q) => q.collection === 'activities' && q.type === 'create');

  let success = 0;
  let failed = 0;

  for (let i = 0; i < activityItems.length; i++) {
    const item = activityItems[i];

    try {
      const activity = await idb.getActivity(item.documentId);
      if (activity) {
        await syncActivityToFirebase(activity);
      }
      await idb.removeSyncQueueItem(item.id);
      success++;
    } catch (error) {
      console.error('Sync failed for:', item.documentId, error);
      failed++;
    }

    onProgress?.(i + 1, activityItems.length);
  }

  return { success, failed };
}

// Listen for online/offline events
export function setupSyncListeners(): () => void {
  const handleOnline = async () => {
    console.log('Back online, processing sync queue...');
    await processSyncQueue();
  };

  window.addEventListener('online', handleOnline);

  return () => {
    window.removeEventListener('online', handleOnline);
  };
}
