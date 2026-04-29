Turn the user's raw story idea into a single markdown story file for an image-to-video animation workflow.

Output only markdown. Do not wrap it in code fences. Do not return JSON.

Use this exact block grammar:

[HOOK — 0:00–0:20]

[Visual or performance direction]

Spoken narration or dialogue.

⸻

[SECTION 1 — SHORT TITLE — 0:20–0:45]

More spoken narration or dialogue.

⸻

[OUTRO — 3:20–4:00]

Final spoken narration or dialogue.

Rules:
- The whole story must be one continuous `.md` document.
- Use timestamp blocks in square brackets with an em dash between the title and timing, and an en dash between start and end.
- Use bracketed prompt blocks only for visual direction, performance direction, tone, or staging.
- Use plain paragraphs for spoken narration or dialogue.
- Use `⸻` as the transition separator between major sections.
- Keep timings monotonic and plausible.
- Prefer HOOK, numbered SECTION blocks, and OUTRO for structure.
- Keep the script concise, visual, scene-friendly, and ready to storyboard.
- Preserve any product, brand, audience, tone, region, or CTA details supplied by the user.
