// Which Vertex project a call bills to.
//
// Deployment model 1 (SaaS, the default): every school's inference runs in our
// project. Model 2 (BYO-inference): a district pins its own project, so its
// students' inference lands on its Google bill and never transits ours — the
// answer to "I don't want a company reading my students' work."
//
// This is a separate seam from llm.js because llm.js has to ask *something* on
// every call. Adding the question later, once schools live in Firestore and
// every lookup is async, would be a migration rather than an edit.
//
// There is no schools collection yet, so overrides are config-driven. When one
// exists, only resolveOverride() changes — and it becomes async, which is why
// vertexTarget() is already awaited at its call sites.

const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(__dirname, '..', '..', 'config.json');

let cached = null;

// Dev reads config.json from the repo root. That file is gitignored and is
// deliberately not in the container image, so deployed instances are
// configured by environment instead — same values, no file to leak or forget.
// Env wins where both exist, so a deploy can never be silently overridden by a
// stale file someone copied in.
function config() {
  if (cached) return cached;

  const fromFile = fs.existsSync(CONFIG_PATH)
    ? JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'))
    : {};

  const gcp = { ...(fromFile.gcp || {}) };
  if (process.env.GCP_PROJECT_ID) gcp.projectId = process.env.GCP_PROJECT_ID;
  if (process.env.GCP_LOCATION) gcp.location = process.env.GCP_LOCATION;
  if (process.env.GCP_CHAT_MODEL || process.env.GCP_ANALYSIS_MODEL) {
    gcp.models = {
      ...(gcp.models || {}),
      ...(process.env.GCP_CHAT_MODEL ? { chat: process.env.GCP_CHAT_MODEL } : {}),
      ...(process.env.GCP_ANALYSIS_MODEL ? { analysis: process.env.GCP_ANALYSIS_MODEL } : {}),
    };
  }

  if (!gcp.projectId) {
    throw new Error('No GCP project configured: set GCP_PROJECT_ID, or add gcp.projectId to config.json (app/gcp-setup.md step 9)');
  }

  cached = { ...fromFile, gcp };
  return cached;
}

// Config that routes data is a security boundary: a school admin must never be
// able to point inference somewhere else. Overrides are deliberately read from
// deploy-time config, not from anything a school-level role can write.
function resolveOverride(schoolId) {
  if (!schoolId) return null;
  return config().gcp?.schools?.[schoolId] || null;
}

// Returns { projectId, location } for a call. schoolId is optional today —
// the app is single-tenant until the schools collection lands.
async function vertexTarget(schoolId = null) {
  const gcp = config().gcp;
  if (!gcp?.projectId) {
    throw new Error('config.json has no gcp.projectId — see app/gcp-setup.md step 9');
  }
  const override = resolveOverride(schoolId);
  return {
    projectId: override?.projectId || gcp.projectId,
    location: override?.location || gcp.location || 'global',
    // Model 2 schools get a per-school cost report; usage records need to know
    // whose bill a call landed on, which is not derivable from projectId alone.
    billsTo: override ? 'school' : 'platform',
  };
}

module.exports = { vertexTarget, config };
