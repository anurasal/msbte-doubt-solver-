# MSBTE Doubt Solver

A resource hub + doubt-solving chatbot for MSBTE Diploma students, addressing the gap
where subject-specific, syllabus-aligned, regional-language study content barely exists
online (see problem research: notes/PYQs are scattered, English-only, and not chapter-aligned
to MSBTE's syllabus).

## What it does (v1)

- **Semester + subject selector** covering Semester I–VI. Only launch subjects have real
  content; the rest show "Coming soon — vote for this subject" so the app is architecturally
  complete without requiring content for 40+ subjects on day one.
- **Language toggle** (English / Hindi / Marathi) for notes, PYQs, and chatbot answers.
- **Notes and PYQs** structured by chapter/unit, matching MSBTE's own syllabus breakdown.
- **Doubt-solving chatbot** using the Gemini API. Each subject's notes are injected directly
  into the prompt as context, so answers stay grounded in the actual syllabus content instead
  of the model freely generating unrelated material. This achieves the same grounding RAG
  would provide, without needing a vector database, since each subject's content is small
  enough to fit directly in a prompt.

## Why this stack (no backend, no database)

Notes and PYQs are static content authored once, not user-generated or frequently updated —
there's no need for persistence, accounts, or server-side logic. Keeping it to HTML/CSS/JS
+ the Gemini API means it runs by opening `index.html` in a browser, no server setup required.
This was a deliberate scope decision, not a limitation: a backend would only be justified if
the app needed accounts, submissions, or moderation, none of which v1 requires.

## Content pipeline

1. `admin-generate.html` — a separate tool (not in student navigation) where the content
   author inputs a subject name and chapter list, and gets a draft JSON response from Gemini.
2. **Every draft is manually reviewed before going live.** Generated Hindi/Marathi technical
   translations are not verified for accuracy by default — the `"reviewed": false` flag in
   each note tracks this, and is shown to users on non-English notes until a human confirms it.
3. Reviewed content is pasted into `data/[subject-id].json`, following the schema in
   `data/microprocessor-8086.json`.

## What's intentionally out of scope for v1

- Additional subjects beyond the launch set (added incrementally based on the vote count)
- Video content (the original research identified this gap, but producing video is a
  content-creation task, not a software feature)
- User accounts / login / progress tracking
- Admin panel / analytics dashboard
- RAG / vector database (unnecessary at this content scale — direct prompt injection
  achieves the same grounding effect)

## Running it

Open `index.html` directly in a browser. For the chatbot, paste a Gemini API key into the
field in the "Ask a Doubt" tab — it's stored only in that browser's localStorage and sent
directly to Google's API, never through any server of this project's own.
