import 'dotenv/config';

let dbInstance: any = null;
let initialized = false;

export const db = (): any => {
    if (initialized) return dbInstance;
    initialized = true;

    const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    if (!serviceAccountKey) {
        console.warn('[DB] No FIREBASE_SERVICE_ACCOUNT_KEY found. Database features disabled (user sync, roles). App will still work without them.');
        dbInstance = null;
        return null;
    }

    try {
        // Dynamic require to avoid crashing when credentials are missing
        const { initializeApp, getApps, cert } = require('firebase-admin/app');
        const { getFirestore } = require('firebase-admin/firestore');

        if (!getApps().length) {
            initializeApp({
                credential: cert(JSON.parse(serviceAccountKey)),
                projectId: process.env.FIREBASE_PROJECT_ID || 'souq-saada',
            });
        }
        dbInstance = getFirestore();
        console.log('[DB] Firestore initialized successfully.');
    } catch (err: any) {
        console.warn('[DB] Firestore initialization failed (non-fatal):', err.message);
        dbInstance = null;
    }

    return dbInstance;
};
