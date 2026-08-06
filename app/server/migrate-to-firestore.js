// One-shot migration: app/data/*.json → Firestore. Run once, keep for the
// record — it documents exactly what the dev store held at swap time.
//
//   node app/server/migrate-to-firestore.js          # migrate
//   node app/server/migrate-to-firestore.js --wipe   # clear target first
//
// Document ids are preserved, so every cross-collection reference
// (submission.analysisId, turn.conversationId, …) survives untouched.

const fs = require('fs');
const path = require('path');
const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { config } = require('./school');

const DATA_DIR = path.join(__dirname, '..', 'data');
const BATCH = 400; // Firestore's limit is 500 writes per batch

async function main() {
  const wipe = process.argv.includes('--wipe');
  const projectId = config().gcp.projectId;
  initializeApp({ credential: applicationDefault(), projectId });
  const db = getFirestore();
  db.settings({ ignoreUndefinedProperties: true });
  console.log(`target: ${projectId}${wipe ? '  (wiping first)' : ''}\n`);

  const files = fs.readdirSync(DATA_DIR).filter((f) => f.endsWith('.json'));
  let grand = 0;

  for (const file of files) {
    const name = file.replace(/\.json$/, '');
    const raw = JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), 'utf8'));
    const docs = Array.isArray(raw) ? raw : Object.values(raw);

    if (wipe) {
      const existing = await db.collection(name).get();
      for (let i = 0; i < existing.docs.length; i += BATCH) {
        const batch = db.batch();
        for (const d of existing.docs.slice(i, i + BATCH)) batch.delete(d.ref);
        await batch.commit();
      }
    }

    for (let i = 0; i < docs.length; i += BATCH) {
      const batch = db.batch();
      for (const doc of docs.slice(i, i + BATCH)) {
        if (!doc.id) throw new Error(`${name}: document without an id — refusing to guess`);
        batch.set(db.collection(name).doc(doc.id), doc);
      }
      await batch.commit();
    }

    const after = (await db.collection(name).get()).size;
    console.log(`${name.padEnd(16)} ${String(docs.length).padStart(5)} written → ${after} in Firestore`);
    grand += docs.length;
  }

  console.log(`\ntotal written: ${grand}`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
