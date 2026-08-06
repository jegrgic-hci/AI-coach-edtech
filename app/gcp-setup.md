# Getting started on Google Cloud — a plain-language walkthrough

**Who this is for:** you, not a cloud engineer. Every step says what to do, what you should see, and what it means.

**What you're doing:** setting up a Google Cloud account so the tool can (a) use Google's AI instead of Groq, and (b) store data in Google's database instead of files on your laptop. Nothing about the app changes yet — this is just building the place it will eventually live.

**Time:** about 25 minutes, most of it waiting on Google.

**You'll need:** a Google account, a credit card, and the Terminal app.

> **On the credit card:** Google requires one, but new accounts come with free trial credit, and development usage is pennies — you'll spend more on coffee this week. Step 4 sets up an alert that emails you if spending ever goes above $25. You will not wake up to a surprise bill.

---

## A few words you'll see

| Word | What it means |
|---|---|
| **Project** | A container holding everything you're building. Like a folder for a whole app |
| **Vertex AI** | Google's AI service — the thing that replaces Groq |
| **Firestore** | Google's database — the thing that replaces the files in `app/data/` |
| **Cloud Run** | Where the app itself will eventually live and run |
| **API** | A service you switch on. Google keeps them all off by default so you only pay for what you use |
| **Terminal** | The black window where you type commands. Open it with Cmd+Space, type "Terminal", press Enter |

Commands go in Terminal. Copy, paste, press Enter. If one fails, stop and send me the error rather than pushing on — later steps assume earlier ones worked.

---

## Step 1 — Install Google's toolkit

This gives your laptop the `gcloud` command, which is how you talk to Google Cloud without clicking through the website.

⚠️ **gcloud needs Python 3.10 or newer. macOS ships 3.9.** The one-line installer everyone links to will install fine and then refuse to run. Its built-in fix wants a `sudo` password and fails in any non-interactive shell. So install a Python for it first — this one lives in its own folder and doesn't touch the system Python:

```bash
mkdir -p ~/.local/gcloud-python && cd ~/.local/gcloud-python
curl -fsSL -o py.tar.gz "https://github.com/astral-sh/python-build-standalone/releases/download/20260804/cpython-3.12.13%2B20260804-aarch64-apple-darwin-install_only.tar.gz"
tar -xzf py.tar.gz && rm py.tar.gz
```

*(That URL is for Apple Silicon. On an Intel Mac, swap `aarch64` for `x86_64` — and in the next block, `darwin-arm` for `darwin-x86_64`.)*

Then the SDK itself:

```bash
cd ~ && curl -fL -o gcloud.tar.gz https://dl.google.com/dl/cloudsdk/channels/rapid/downloads/google-cloud-cli-darwin-arm.tar.gz
tar -xzf gcloud.tar.gz && rm gcloud.tar.gz
export CLOUDSDK_PYTHON="$HOME/.local/gcloud-python/python/bin/python3"
~/google-cloud-sdk/install.sh --quiet --usage-reporting=false --path-update=true --command-completion=true
```

It will print a complaint about not being able to install Python 3.14 via sudo. **Ignore it** — that's it trying to solve a problem you already solved.

Finally, make the Python setting stick. Add this line to `~/.zshrc`, *above* the two lines the installer just added:

```bash
export CLOUDSDK_PYTHON="$HOME/.local/gcloud-python/python/bin/python3"
```

Then restart your terminal session:

```bash
exec -l $SHELL
```

**Check it worked:**

```bash
gcloud version
```

You should see a list of version numbers. If you see `command not found`, close Terminal entirely, open it again, and try once more. If you see a complaint about Python 3.9, the `~/.zshrc` line is missing or in the wrong place.

---

## Step 2 — Sign in

```bash
gcloud auth login
```

**What to expect:** your browser opens, you pick your Google account and click Allow, then the browser says you can close the tab. Terminal will confirm you're logged in.

---

## Step 3 — Create the project

Two things to know:

1. The project **ID** is permanent and has to be unique across all of Google — so `cta-pilot-dev` may be taken. If it is, add something: `cta-pilot-dev-jg`.
2. Use a *dev* project for now. The school's real project comes later; you don't want to be testing prompts inside a district's data.

```bash
gcloud projects create cta-pilot-dev --name="CTA Pilot dev"
```

*(No brackets, slashes or punctuation in the `--name` — Google rejects them.)*

Then tell your laptop this is the project you're working on, so you don't have to name it in every command:

```bash
gcloud config set project cta-pilot-dev
```

*(If you had to use a different ID, use that one in both commands and everywhere below.)*

---

## Step 4 — Turn on billing, then set a spending alert

**4a. Do you already have a billing account?** Check before creating one:

```bash
gcloud billing accounts list
```

If a row comes back with `OPEN: True`, you're set — skip to 4b with that `ACCOUNT_ID`. If nothing comes back, create one at <https://console.cloud.google.com/billing>. That part is browser-only; Google won't let card entry be scripted, deliberately.

**4b. Connect it to your project.** Using the `ACCOUNT_ID` from above:

```bash
gcloud billing projects link cta-pilot-dev --billing-account=YOUR-ACCOUNT-ID
```

Look for `billingEnabled: true` in the response.

**4c. Set the alert now, not later.** Go to <https://console.cloud.google.com/billing/budgets>, create a budget of **$25/month**, and tick the boxes to email you at 50%, 90%, and 100%.

This is a smoke alarm, not a limit — it tells you, it doesn't stop anything. Real protection comes from the per-student limits we build into the app later. But for development, $25 is roughly 10x what you could plausibly spend by accident, so if that email ever arrives, something is wrong and you'll know within hours.

---

## Step 5 — Switch on the services

Google keeps everything off by default. This turns on the five things the app needs.

```bash
gcloud services enable \
  aiplatform.googleapis.com \
  firestore.googleapis.com \
  run.googleapis.com \
  identitytoolkit.googleapis.com \
  cloudbuild.googleapis.com
```

**What to expect:** about a minute of nothing, then it returns to a normal prompt. Silence means success.

**If it errors** mentioning billing, step 4 hasn't finished propagating. Wait five minutes and run it again.

---

## Step 6 — Create the database

⚠️ **The location is permanent.** It cannot be changed later without rebuilding from scratch. `us-central1` is the right answer: US-based (which matters for school data), and cheaper than the multi-region option.

```bash
gcloud firestore databases create --location=us-central1
```

It comes up in Native mode on the free tier, with **delete protection off**. That's fine for a dev project you may well want to throw away. Turn it on for the school's real project, where an accidental `databases delete` is unrecoverable.

---

## Step 7 — Give your laptop permission to use the AI

This lets code running on your machine talk to Google's AI as you. It's why the new `llm.js` won't have an API key in it at all — a real improvement on the current Groq setup, where the key sits in a file that must never be committed.

```bash
gcloud auth application-default login
```

**What to expect:** the browser opens again — but this consent screen is *not* the same as step 2's. It shows a **checkbox**, roughly "See, edit, configure and delete your Google Cloud data", and it starts **unticked**. Tick it (or click "Select all") before Continue.

Miss the checkbox and you get this, which reads like a browser fault but isn't:

```
ERROR: There was a problem with web authentication. Try running again with --no-browser.
ERROR: ... cloud-platform scope is required but not consented.
```

Nothing is broken — run the command again and tick the box. If the browser handoff itself won't complete, `gcloud auth application-default login --no-launch-browser` prints a URL to open by hand and waits for you to paste a code back.

**Yes, this is the second time you've logged in.** Step 2 logged in *you*, so you can run `gcloud` commands. This one logs in *code running on your laptop*. Google keeps them separate on purpose.

**Check it worked:**

```bash
cat ~/.config/gcloud/application_default_credentials.json | grep quota_project
```

You want `"quota_project_id": "cta-pilot-dev"`. gcloud fills this in from step 3's `config set project`. If it's absent, Vertex calls from Node fail with a quota-project error even though step 8's test passes — fix it with `gcloud auth application-default set-quota-project cta-pilot-dev`.

---

## Step 8 — The test

This asks Google's AI to say one word. If it answers, the project, billing, services and AI access are all correct.

It's one long command — copy the whole block:

```bash
curl -X POST \
  -H "Authorization: Bearer $(gcloud auth print-access-token)" \
  -H "Content-Type: application/json" \
  "https://aiplatform.googleapis.com/v1/projects/cta-pilot-dev/locations/global/publishers/google/models/gemini-3.1-flash-lite:generateContent" \
  -d '{"contents":[{"role":"user","parts":[{"text":"Reply with the single word OK."}]}]}'
```

**Success looks like** a block of JSON with `"text": "OK"` somewhere inside it. It won't be pretty. `OK` in there means you're done.

**If it fails,** the message usually says which step to revisit:

| Message contains | What it means | Fix |
|---|---|---|
| `PERMISSION_DENIED` or `has not been used` | Services aren't on yet | Redo step 5, wait 5 min |
| `billing` | Billing isn't linked | Redo step 4b |
| `NOT_FOUND` | Project ID typo | Check it matches what you created in step 3 |

Stuck on something not in that table? Paste me the whole error.

**One more check — this test doesn't cover step 7.** The command above authenticates as *you* (that's what `gcloud auth print-access-token` means), not as code on your laptop, so it passes whether or not step 7 happened. Without step 7 the app fails to start much later, when the cause is no longer obvious. Confirm it now:

```bash
ls ~/.config/gcloud/application_default_credentials.json
```

A file path back means done. "No such file" means redo step 7.

---

## Step 9 — Write down your settings

`config.json` in the **repo root** (the folder containing `app/`) already exists and holds the Groq key. It's set up to never be committed, so it's safe for this. **Add** the `gcp` block — don't replace the file, or Groq stops working before its replacement is built:

```json
{
  "groq": {
    "apiKey": "..."
  },
  "gcp": {
    "projectId": "cta-pilot-dev",
    "location": "global"
  }
}
```

If you had to use a different project ID in step 3, use it here.

---

## You're done — what happens next

You've built the place the app will live. The app itself hasn't changed and still runs on Groq exactly as before.

**Next, I:**

1. Rewrite `llm.js` so the coach and the analysis use Google's AI instead of Groq
2. Add `school.js`, which decides which Google project each school's usage bills to
3. Fix the PQ scoring bug (backlog #9) while the analysis prompts are being rewritten anyway

You'll be able to test it the same way you test now — `node app/server/index.js`, open the browser, have a conversation, submit a draft, look at the report. If the scores look sensible, Google's AI is working.

**Two things you can do in parallel, both slower than the code:**

- **Start the school-agreement paperwork.** Legal review takes weeks; the code takes days. This is what actually gates a real pilot.
- **Line up the pilot school.** Their email domains and setup choices are inputs to everything we designed today.

---

*Architecture, phases, and the multi-school design live in `../built-in-chat-plan.md`. This file is just the setup steps.*
