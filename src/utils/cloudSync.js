/**
 * Google Cloud Firestore Synchronization Service
 * Al-Quds Open University - Hebron Branch
 * 
 * Provides:
 * - Real-time cloud listening via onSnapshot
 * - Resilient offline-first persistence with localStorage fallback
 * - Auto-sync for projects, assignments, and proctors
 */

import { 
  collection, doc, setDoc, getDocs, onSnapshot, deleteDoc, 
  serverTimestamp, enableIndexedDbPersistence 
} from 'firebase/firestore';
import { db } from './firebase';

const PROJECTS_COLLECTION = 'qou_projects';
const LOCAL_STORAGE_KEY = 'qou_exam_projects';

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

        // Cache into localStorage for instant offline startup
        if (cloudProjects.length > 0) {
          try {
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(cloudProjects));
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
 */
export async function saveProjectToCloud(project) {
  if (!project || !project.id) return false;

  try {
    const docRef = doc(db, PROJECTS_COLLECTION, project.id);
    const payload = {
      ...project,
      updatedAt: new Date().toISOString()
    };

    await setDoc(docRef, payload, { merge: true });
    return true;
  } catch (err) {
    console.error(`Failed to save project ${project.id} to cloud:`, err);
    throw err;
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
        await saveProjectToCloud(project);
      }
      console.log('Seeding to Google Cloud Firestore completed successfully.');
    }
  } catch (err) {
    console.warn('Could not check or seed cloud projects:', err);
  }
}
