# Manual Test Checklist

## Setup
- [ ] Server running on port 4000 (`npm run dev`)
- [ ] Extension built (`npm run build --workspace=apps/extension`)
- [ ] Extension loaded from `apps/extension/dist` in `chrome://extensions` (Developer Mode)

## Google Meet Tab
- [ ] Open a Google Meet call in Chrome
- [ ] Click the extension icon → side panel opens
- [ ] Click **Start** → connection state shows "Live"
- [ ] Captions appear in real time
- [ ] Detected questions are highlighted with "Question" badge
- [ ] Claude suggested answer appears (collapsed) on each detected question
- [ ] Translation appears if target language differs from spoken language

## Microsoft Teams (browser tab)
- [ ] Open Teams in Chrome browser (not desktop app)
- [ ] Repeat capture/caption test above

## Capture Controls
- [ ] **Pause** — caption stream stops; meeting audio continues
- [ ] **Resume** — captions resume from where paused
- [ ] **Stop** — session ends; elapsed timer resets

## Translation
- [ ] Set spoken language to English, target to Spanish in Settings
- [ ] Translations appear in both Captions tab (below each segment) and Translation tab

## Saving Questions
- [ ] Click **💾 Save Question** on a detected question
- [ ] Navigate to Saved tab → question appears
- [ ] Edit question text and notes
- [ ] Delete question
- [ ] Export JSON / Export TXT / Copy All

## Practice Mode
- [ ] Navigate to Practice tab
- [ ] Acknowledge the disclaimer
- [ ] Enter a question, role, experience level, answer style, technologies
- [ ] Click **Generate Answer** → Claude returns a structured answer
- [ ] Type your own answer → click **Review My Answer** → feedback appears
- [ ] Send a saved question to Practice Mode via **Practice →** button

## Network & Error Handling
- [ ] Stop the backend server → extension shows "Error" state
- [ ] Restart backend → click Start again → reconnects
- [ ] Close the meeting tab mid-session → extension shows error

## Permission Denial
- [ ] Deny tab capture permission → extension shows meaningful error message
