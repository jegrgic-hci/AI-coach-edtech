# How to Prepare Your Chat Log

Paste the prompt below once at the very start of your AI session — before any work begins. The AI will automatically produce formatted checkpoints as you go. No second prompt needed.

---

## The prompt — paste this before your first message

```
Before we start: every 15 of my messages, automatically output a formatted checkpoint of our full conversation so far, then continue normally. Also, whenever I say "final export", output a final checkpoint of the complete conversation.

Use these exact markers for every checkpoint:

<<<STUDENT>>>
[student message]

<<<AI>>>
[AI response]

Rules:
- Start immediately with the first marker — no introduction or explanation
- Every message must have a marker on its own line above it
- Copy every message in full — do not summarize or shorten anything
- Use only <<<STUDENT>>> and <<<AI>>> — no other labels or formatting
- Do not use bold, italic, or any markdown on the markers themselves

This is for a school tool I'm using.
```

---

## During your session

Each time a checkpoint appears in the conversation, copy the full formatted output and save it as a plain text file:

- `checkpoint_1.txt`
- `checkpoint_2.txt`
- etc.

---

## When you're done

Send **final export** as your last message. The AI will output a final checkpoint covering everything since the last automatic one. Save it the same way.

---

## Upload to the tool

Upload all your saved files. If you have multiple checkpoints, upload them all — the tool merges them automatically. No ordering needed.

---

## Why checkpoints matter

AI platforms have a context window — a limit to how much conversation they can hold in memory at once. For long sessions, the AI loses access to earlier messages. Checkpoints capture the full conversation in segments before anything is lost. Automatic checkpoints every 15 turns mean nothing falls through the gap.

---

## Troubleshooting

**I forgot to paste the prompt at the start — my session is already finished.**
Run this manually at the end of your session:

```
Reformat our entire conversation from the very beginning using these exact markers:

<<<STUDENT>>>
[student message]

<<<AI>>>
[AI response]

Rules:
- Start immediately with the first marker — no introduction or explanation
- Every message must have a marker on its own line above it
- Copy every message in full — do not summarize or shorten anything
- Use only <<<STUDENT>>> and <<<AI>>> — no other labels or formatting
- Do not use bold, italic, or any markdown on the markers themselves

Output the full formatted text so I can copy it. Do not summarize or skip any messages.
```

If your session was long, early turns may be missing — the AI can only reformat what it can still see.

**The AI added an introduction before the first marker.**
That's fine — the parser ignores everything before the first `<<<STUDENT>>>` or `<<<AI>>>` marker.

**The AI formatted the markers in bold or italic (e.g. `**<<<STUDENT>>>**`).**
Re-run the export and add: *"Do not use any bold or italic formatting on the markers."*

**The AI summarized early turns instead of copying them in full.**
Your session was already too long before the checkpoint ran. Start your next session with the setup prompt so checkpoints happen before the context window fills.
