import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { checkFirebaseConfig } from '../scripts/lib/firebase-config-guard.mjs';

const root = new URL('../', import.meta.url);

describe('production Firebase config build guard', () => {
  it('rejects a built firebase-core chunk with missing config', () => {
    const bundle = 'Pi={apiKey:void 0,authDomain:void 0,databaseURL:void 0,projectId:void 0,storageBucket:void 0,messagingSenderId:void 0,appId:void 0},Fi=re(Pi);window.firebaseConfig=Pi;';
    expect(checkFirebaseConfig(bundle, 'main.js')).toEqual([
      'main.js: 7 field Firebase kosong di bundel — apiKey, authDomain, databaseURL, projectId, storageBucket, messagingSenderId, appId',
      'Bundle dibangun tanpa env VITE_FIREBASE_*; set di .env (lokal) atau GitHub Secrets, lalu build ulang.',
    ]);
  });

  it('accepts Firebase config values embedded in the built chunk', () => {
    const bundle = 'Pi={apiKey:"key",authDomain:"project.firebaseapp.com",databaseURL:"https://db.example",projectId:"project",storageBucket:"project.appspot.com",messagingSenderId:"123",appId:"1:123:web:abc"},Fi=re(Pi);window.firebaseConfig=Pi;';
    expect(checkFirebaseConfig(bundle, 'main.js')).toEqual([]);
  });

  it('accepts Vite output that serializes Firebase values as template literals', () => {
    const bundle = 'Pi={apiKey:`key`,authDomain:`project.firebaseapp.com`,databaseURL:`https://db.example`,projectId:`project`,storageBucket:`project.appspot.com`,messagingSenderId:`123`,appId:`1:123:web:abc`,measurementId:``},Fi=re(Pi);window.firebaseApp=Fi,window.firebaseConfig=Pi;';
    expect(checkFirebaseConfig(bundle, 'main.js')).toEqual([]);
  });

  it('runs the Firebase guard as part of the build verification gate', () => {
    const verify = readFileSync(new URL('scripts/verify-precache.mjs', root), 'utf8');
    expect(verify).toContain('checkFirebaseConfig');
  });
});
