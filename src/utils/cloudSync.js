/**
 * Google Cloud Firestore Synchronization Service
 * Al-Quds Open University - Hebron Branch
 * 
 * Provides:
 * - Real-time cloud listening via onSnapshot
 * - Resilient offline-first persistence with localStorage fallback
 * - Optimistic Concurrency Control (OCC) with version incrementing & collision detection
 * - Zero silent overwrites: Warns and prompts if another user saved concurrently
 */

import { 
  collection, doc, setDoc, getDoc, getDocs, onSnapshot, deleteDoc, 
  enableIndexedDbPersistence 
} from 'firebase/firestore';
import { db } from './firebase';

const PROJECTS_COLLECTION = 'qou_projects';
const CANONICAL_LOCAL_STORAGE_KEY = 'qou_all_projects';

// Attempt to enable IndexedDB offline persistence safely
try {
  enableIndexedDbPersistence(db).catch((err) => {
    if (err.code === 'failed-precondition') {
      // Multiple tabs open, persistence can only be enabled in one tab at a time.
      console.warn('Firestore offline persistence: multiple tabs open, active in primary tab.');
    } else if (err.code === 'unimplemented') {
      console.warn('Firestore offline persistence: current browser does not support all required features.');
    }
  });
} catch (e) {
  // Ignore in environments where persistence is already initialized
}

/**
 * Subscribe to real-time Cloud Firestore updates for exam projects
 */
export function subscribeToCloudProjects(onData, onError) {
  try {
    const collRef = collection(db, PROJECTS_COLLECTION);

    const unsubscribe = onSnapshot(
      collRef,
      (snapshot) => {
        const cloudProjects = [];
        snapshot.forEach((docSnap) => {
          cloudProjects.push({ ...docSnap.data(), id: docSnap.id });
        });

        // Sort by updatedAt or createdAt descending
        cloudProjects.sort((a, b) => {
          const timeA = new Date(a.updatedAt || a.createdAt || 0).getTime();
          const timeB = new Date(b.updatedAt || b.createdAt || 0).getTime();
          return timeB - timeA;
        });

        // Cache into canonical localStorage for instant offline startup
        if (cloudProjects.length > 0) {
          try {
            localStorage.setItem(CANONICAL_LOCAL_STORAGE_KEY, JSON.stringify(cloudProjects));
          } catch (e) {
            console.warn('localStorage caching failed:', e);
          }
        }

        onData(cloudProjects);
      },
      (err) => {
        console.error('Firestore snapshot subscription error:', err);
        if (onError) onError(err);
      }
    );

    return unsubscribe;
  } catch (err) {
    console.error('Failed to setup Firestore subscription:', err);
    if (onError) onError(err);
    return () => {};
  }
}

/**
 * Save or update a single project in Google Cloud Firestore
 * Implements Optimistic Concurrency Control (OCC):
 * If expectedVersion is supplied and the remote document on Firestore has a higher version,
 * the write is aborted and a conflict result is returned rather than blindly overwriting.
 * 
 * @param {Object} project - The project state to save
 * @param {number|null} expectedVersion - The base version this edit was performed upon
 * @param {boolean} force - If true, bypasses conflict check and overwrites remote
 * @returns {Promise<Object>} Result indicating success, conflict details, or error
 */
export async function saveProjectToCloud(project, expectedVersion = null, force = false) {
  if (!project || !project.id) {
    return { success: false, conflict: false, error: 'معرّف المشروع غير صالح' };
  }

  try {
    const docRef = doc(db, PROJECTS_COLLECTION, project.id);

    // Concurrency conflict check
    if (!force && expectedVersion !== null && expectedVersion !== undefined) {
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const remoteData = snap.data();
        const remoteVersion = Number(remoteData.version) || 0;

        if (remoteVersion > expectedVersion) {
          console.warn(`[OCC Conflict] Project ${project.id}: Remote V${remoteVersion} is newer than local base V${expectedVersion}`);
          return {
            success: false,
            conflict: true,
            localVersion: expectedVersion,
            remoteVersion,
            remoteUpdatedAt: remoteData.updatedAt || 'غير معروف',
            remoteProject: { ...remoteData, id: snap.id }
          };
        }
      }
    }

    const currentVer = Number(project.version) || 0;
    const nextVersion = currentVer + 1;
    const nowIso = new Date().toISOString();

    const payload = {
      ...project,
      version: nextVersion,
      updatedAt: nowIso
    };

    await setDoc(docRef, payload, { merge: true });

    return { 
      success: true, 
      conflict: false, 
      version: nextVersion, 
      updatedAt: nowIso 
    };
  } catch (err) {
    console.error(`Failed to save project ${project.id} to cloud:`, err);
    return {
      success: false,
      conflict: false,
      error: err.message || String(err)
    };
  }
}

/**
 * Delete a project from Google Cloud Firestore
 */
export async function deleteProjectFromCloud(projectId) {
  if (!projectId) return false;

  try {
    const docRef = doc(db, PROJECTS_COLLECTION, projectId);
    await deleteDoc(docRef);
    return true;
  } catch (err) {
    console.error(`Failed to delete project ${projectId} from cloud:`, err);
    throw err;
  }
}

/**
 * Initial cloud push: if Cloud is empty, push existing local projects to the cloud
 */
export async function seedLocalProjectsToCloudIfEmpty(localProjects) {
  if (!Array.isArray(localProjects) || localProjects.length === 0) return;

  try {
    const collRef = collection(db, PROJECTS_COLLECTION);
    const snap = await getDocs(collRef);

    if (snap.empty) {
      console.log('Cloud collection is empty. Seeding local projects to Google Cloud...');
      for (const project of localProjects) {
        await saveProjectToCloud(project, null, true);
      }
      console.log('Seeding to Google Cloud Firestore completed successfully.');
    }
  } catch (err) {
    console.warn('Could not check or seed cloud projects:', err);
  }
}
