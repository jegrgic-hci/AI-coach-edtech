# TAUS AI-Use Analyzer — Local Setup

## Getting Started

The analyzer is a single HTML file that runs in your browser. No build step needed, but you'll need a Groq API key for NLP validation.

### 1. Get a Groq API Key

1. Visit [console.groq.com/keys](https://console.groq.com/keys)
2. Sign in (or create a free account)
3. Create a new API key (copy it — you'll only see it once)
4. Keys start with `gsk_`

### 2. Add Your Key Locally

Choose **one** of these methods:

#### Option A: config.json (Recommended for Development)

1. Copy the template:
   ```bash
   cp config.json.example config.json
   ```

2. Edit `config.json` and paste your Groq API key:
   ```json
   {
     "groq": {
       "apiKey": "gsk_your_actual_key_here"
     }
   }
   ```

3. **Never commit `config.json`** — it's in `.gitignore`

#### Option B: Browser Settings (Always Works)

If you don't want to create a config file:

1. Open `taus-analyzer.html` in your browser
2. Click **⚙ NLP Settings** (top right)
3. Paste your Groq API key
4. Enable "Enable NLP validation"
5. Click "Done"

The key is saved in your browser's local storage (persists across sessions).

### 3. Use the Analyzer

```
1. Paste an AI conversation (ChatGPT, Claude, or "You:" / "AI:" format)
2. Paste your final essay
3. Click "Analyze my AI use"
4. Algorithmic score appears instantly
5. NLP validation from Groq appears below (2-3 sec)
```

---

## Security

✅ **Your API key is never committed to git**
- `.env` and `config.json` are in `.gitignore`
- Only `.env.example` and `config.json.example` are safe to commit (they contain no secrets)

✅ **How it works**
- On load, the app tries to fetch `config.json` (if present locally)
- Falls back to browser's localStorage
- If neither exists, you can enter the key via settings UI

✅ **Never hardcode secrets in the HTML**
- The key was removed from the source code
- Each developer/deployment has its own config file (gitignored)

---

## Deployment

For production deployment:

1. **Static hosting** (Netlify, Vercel, GitHub Pages): 
   - Set environment variables in the hosting platform's dashboard
   - The app will use localStorage or require manual key entry
   
2. **Self-hosted**:
   - Use `.env` file on the server
   - Modify the load sequence if needed (e.g., add a server route to load config)

3. **No backend needed**: This is a client-side app — API calls go directly from the browser to Groq's API.

---

## Troubleshooting

**NLP validation isn't working:**
- Check that NLP is enabled (⚙ button)
- Verify your Groq key is valid (test at console.groq.com)
- Check browser console (F12) for error messages

**"Config not found" error:**
- This is normal — the app looks for `config.json` but falls back gracefully if it doesn't exist
- Either create `config.json` or enter your key in settings

**API key keeps resetting:**
- Browser privacy mode clears localStorage
- Use `config.json` instead (more reliable)
