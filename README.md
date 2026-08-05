# Interview Caption Assistant

A production-ready Chrome extension that captures browser meeting audio, provides real-time captions, translates them, and detects interview questions. Claude answers detected questions inline (brief reference hints) and provides full practice-mode coaching.

---

## Architecture

```
interview-caption-assistant/
  apps/
    extension/   Chrome Extension (MV3, React, TypeScript, Vite, Tailwind)
    server/      Node.js backend (Express, WebSocket, Claude, Whisper)
  packages/
    shared/      Types, Zod schemas, events shared between extension and server
```

---

## Quick Start

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment
```bash
cp .env.example apps/server/.env
```

Edit `apps/server/.env`:
```env
# Required for live AI answers and Practice Mode
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-3-5-haiku-20241022

# Optional — set to 'openai' to use Whisper instead of mock transcription
TRANSCRIPTION_PROVIDER=mock
TRANSCRIPTION_API_KEY=sk-...

# Optional — set to 'openai' for real translation
TRANSLATION_PROVIDER=mock
TRANSLATION_API_KEY=sk-...

SESSION_TOKEN_SECRET=replace-with-a-long-random-secret
```

### 3. Start development
```bash
npm run dev
```
- Backend: `http://localhost:4000`
- Extension: rebuilt to `apps/extension/dist` on save

### 4. Load the extension in Chrome
1. Open `chrome://extensions`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked**
4. Select `apps/extension/dist`

---

## Provider Configuration

### Transcription — OpenAI Whisper
```env
TRANSCRIPTION_PROVIDER=openai
TRANSCRIPTION_API_KEY=<your-openai-key>
```
> The real adapter is in `apps/server/src/providers/transcription/openai-provider.ts`.  
> It batches audio chunks and calls `whisper-1` every ~3 s. For production, upgrade to the [OpenAI Realtime API](https://platform.openai.com/docs/guides/realtime) for true streaming by replacing `OpenAITranscriptionSession.flush()`.

### Translation — OpenAI GPT
```env
TRANSLATION_PROVIDER=openai
TRANSLATION_API_KEY=<your-openai-key>
```
> Swap `OpenAITranslationProvider` in `apps/server/src/providers/translation/openai-provider.ts` for DeepL or Google Translate for better language coverage.

### Claude (Answers + Practice Mode)
```env
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-3-5-haiku-20241022
```
Claude is used for:
- **Live captions**: Brief reference answers for detected interview questions (both tabs).
- **Practice Mode**: Full structured answers (STAR, concise, technical, etc.), follow-up generation, and answer review.

---

## Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start server + extension in watch mode |
| `npm run build` | Build all workspaces |
| `npm run test` | Run all Vitest tests |
| `npm run lint` | Lint all workspaces |
| `npm run typecheck` | Type-check all workspaces |
| `npm run format` | Prettier format |

---

## Docker

```bash
# Copy and fill .env first
docker-compose up --build
```

Server runs on port 4000.

---

## MVP Limitations

- Only browser-tab audio is captured. The standalone Microsoft Teams or Zoom desktop applications are not supported.
- Speaker identification (diarisation) is not available unless the selected transcription provider supports it. Audio is labelled as "Meeting audio".
- Transcription quality depends on meeting audio quality and network conditions.
- Users must obtain any legally or contractually required consent from other participants before capturing audio.
- Practice Mode generated answers must not be presented as unaided responses where an employer prohibits assistance.
- Chrome extension capture must be initiated by an explicit user action.
- System audio outside the selected browser tab is not captured.
- The OpenAI Whisper adapter batches audio; for sub-second latency, connect the OpenAI Realtime API or Deepgram streaming.

---

## Supported Platforms (browser tab only)

- Google Meet
- Microsoft Teams (browser)
- Zoom (browser)
- Any other browser-based meeting platform

---

## Supported Languages

English · French · Spanish · German · Portuguese · Arabic · Yoruba · Igbo · Hausa

To add a language: add it to `Language` in `packages/shared/src/types.ts` and `LANGUAGE_LABELS`.
