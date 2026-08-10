# Cloud Run image for the app/ server. The root index.html CTA is a separate
# single-file tool and is deliberately not in here.
FROM node:24-alpine

WORKDIR /srv

# Dependencies first so a code-only change doesn't reinstall them.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY app/ ./app/

# Turns on every production guard at once: the demo seed refuses to run, admin
# -created accounts get random temp passwords instead of the dev constant, and
# the session cookie gets Secure. See auth.js and seed.js.
#
# A default rather than a fact about the image: Cloud Run's --set-env-vars wins
# over ENV, and the staging service overrides this to `staging` so it can seed
# (cloudbuild.staging.yaml). It defaults to the locked-down value so that
# forgetting to set anything fails closed.
ENV NODE_ENV=production

# Cloud Run injects PORT; index.js already prefers it.
EXPOSE 8080

# No API keys, no config.json — credentials come from the runtime service
# account via the metadata server, and settings from environment variables.
CMD ["node", "app/server/index.js"]
