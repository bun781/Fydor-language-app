# Fydor Product Audit — July 2026

A full-app audit performed screen by screen: every button, modal, shortcut, workflow, setting,
empty/loading/error state. Findings are rated by **Difficulty** (S/M/L), **Impact** (1–5),
**Frequency** (how often a user hits it), and **Priority** (P0 blocker → P3 polish).

Screens covered: Lesson Manager (Builder / JSON / Lessons tabs), Review (start menu, session,
complete, stats, reset), Flashcards (progressive reveal, checkpoint quiz, lesson review),
Fill Blank, Multiple Choice, Fydor Exchange (install / share / my packs), Learning Science,
app shell (sidebar, brand, guided tour, tooltips, audio, session persistence).

---

## 1. Top 100 improvements

### A. Onboarding & first-run (learner's first 5 minutes)

| # | Finding | Diff | Impact | Freq | Pri |
|---|---------|------|--------|------|-----|
| 1 | No true first-run onboarding. New users land on Lesson Manager (an authoring tool) with an empty library. A learner who just wants to *study* sees a builder. Add a welcome screen: "Create a lesson / Install a pack / Try the sample". | M | 5 | once/user | P0 |
| 2 | Home `/` does a client-side `window.location.replace` full reload with a flash of placeholder content. Use router navigation (fixed in this pass). | S | 3 | every launch | P1 |
| 3 | The sample lesson is hidden behind a small "Sample lesson" button; the empty library should promote it front-and-center ("Try Fydor with a sample Chinese lesson"). | S | 4 | once/user | P1 |
| 4 | Empty states on Review/Flashcards say "Import a lesson first" — but the nav item is called "Builder" and the page "Lesson Manager". Three names for the same destination. | S | 4 | early | P1 |
| 5 | Guided tour exists per-tab, but never auto-offers itself on first visit to a screen. First-run should show a one-time "Take a 30-second tour?" prompt. | M | 4 | once | P1 |
| 6 | No sample `.fydorpack` bundled — Exchange is a dead end for a user with no teacher. Ship 2–3 starter packs (or a "Get packs" link). | M | 5 | early | P0 |
| 7 | No explanation anywhere of the core loop (create → validate → study → review). README has it; the app doesn't. Add a compact "How Fydor works" card on the home/dashboard. | M | 4 | early | P1 |

### B. Information architecture & navigation

| # | Finding | Diff | Impact | Freq | Pri |
|---|---------|------|--------|------|-----|
| 8 | "Builder" (`/admin/imports`) and "Lessons" (`/lessons/manage`) are the *same page* with a different initial tab. Two nav entries for one screen confuses the mental model and doubles the active-state logic. Collapse to one nav item ("Lessons") with tabs. | M | 4 | daily | P1 |
| 9 | Route names leak internals: `/admin/imports` (learners aren't admins), `/study/imported-content` (users don't think "imported content" — it's "Flashcards"). Rename routes; keep redirects. | M | 3 | constant (URLs, tour text) | P2 |
| 10 | No dashboard/home. The single most valuable screen for a returning learner — "X cards due today, streak, continue where you left off" — doesn't exist. `/` should be that. | L | 5 | daily | P0 |
| 11 | Sidebar is icon-only until hover/pin; labels appear on hover. Fine on desktop, but there's no visible pin affordance explanation and the pinned state control is a hamburger icon (usually means "open menu", not "pin"). Use a pin/chevron icon. | S | 2 | daily | P2 |
| 12 | "Fydor Exchange" sits under "Create" but is mostly about *installing* content (consuming). Split: "Get lessons" under Study, "Share" under Create — or rename the section "Library". | S | 3 | weekly | P2 |
| 13 | No keyboard navigation between nav sections; no skip-to-content link for screen readers. | S | 3 | constant (a11y) | P2 |
| 14 | Active nav state uses `pathname.startsWith(href + "/")` — fine, but `/study/imported-content` never highlights when arriving from `/study/sentence-forge` redirect flash. Minor. | S | 1 | rare | P3 |

### C. Lesson Manager / Builder

| # | Finding | Diff | Impact | Freq | Pri |
|---|---------|------|--------|------|-----|
| 15 | The Builder's central interaction — select text in the sentence to annotate — is undiscoverable. Nothing says "highlight text to tag a word". Add an inline hint in the selectable sentence area. | S | 5 | every authoring session | P0 |
| 16 | Annotation form asks for Surface/Lemma/Role/Meaning/Explanation with no examples or placeholder text. A teacher won't know what "Lemma" or "Role" means here. Add placeholders + tooltips. | S | 4 | every annotation | P1 |
| 17 | No undo. Deleting a sentence or annotation is instant and unrecoverable (except discarding the whole draft). Add at least single-step undo, ideally an undo stack. | M | 5 | weekly | P0 |
| 18 | Sentence tabs become unusable at scale — 50+ sentences render as a strip of buttons with full sentence text. Needs a virtualized list with search / jump-to. | M | 4 | large lessons | P1 |
| 19 | No bulk sentence entry. Teachers have sentence lists in a doc; there's no "paste 20 lines, one sentence per line" flow — only JSON. Add "Paste lines → sentences". | M | 5 | weekly | P0 |
| 20 | The "Target: [select]" + "Append Sentence JSON" area is the most confusing part of the app: three save behaviors (Save / Update / Append) whose label silently changes based on two dropdowns and a textarea. Needs an explicit mode choice with plain-language descriptions. | L | 5 | every save to existing | P0 |
| 21 | `Check` vs `Preview` buttons do the same call with different status text. Merge into one "Validate" that always shows the preview. | S | 3 | often | P2 |
| 22 | Save gives no visual proximity feedback — success/status renders in a card far below the fold; after saving you must scroll to learn it worked. Use a toast or move status next to the buttons. | M | 4 | every save | P1 |
| 23 | Draft persistence to sessionStorage is great, but there is no explicit "unsaved changes" indicator (dirty dot) until you try to navigate away. | S | 3 | often | P2 |
| 24 | Tag input commits on blur silently; there's no visual affordance that Enter/comma adds a tag. Placeholder should say "Add tag (Enter)". | S | 2 | occasional | P3 |
| 25 | Language field: free text resolves against a code list, but an unrecognized language silently becomes whatever `resolveLanguageValue` returns; no validation error for typos ("Chinnese"). | M | 3 | occasional | P2 |
| 26 | JSON mode textarea has no line numbers, no error line/col reporting — "Invalid JSON." is the entire error. Surface the parse error message and position. | S | 4 | every JSON import mistake | P1 |
| 27 | Uploading a `.json` file replaces the editor after a confirm — good — but there's no drag-and-drop target, which is how most desktop users will try to import. | M | 3 | weekly | P2 |
| 28 | Delete lesson dialog: good confirm, optimistic removal with rollback. But no undo-toast after delete ("Lesson deleted — Undo"), the stronger pattern. | M | 3 | occasional | P2 |
| 29 | The library list has no search, sort, or filter. Fine at 5 lessons, unusable at 50. | M | 4 | daily at scale | P1 |
| 30 | Library detail panel wastes its space — it could show a sentence preview of the selected lesson instead of a paragraph telling you to open the editor. | M | 3 | daily | P2 |
| 31 | No lesson duplication ("Duplicate lesson" for making variants). | S | 3 | occasional | P2 |
| 32 | No per-sentence audio preview in builder to verify TTS pronunciation of the target text. | S | 2 | authoring | P3 |
| 33 | `->` rendered as ASCII arrow between language fields (`-&gt;`); use a real arrow glyph. Cosmetic (fixed in this pass). | S | 1 | constant | P3 |
| 34 | Tag chips remove with a literal letter "x"; use × and an aria-label (fixed in this pass). | S | 1 | occasional | P3 |
| 35 | Character-by-character `<span>` rendering of the selectable sentence will lag on long sentences/paragraphs (one DOM node per char). Fine for sentences; document the limit or chunk it. | M | 2 | long texts | P3 |
| 36 | Annotation surface matching is by exact char selection; there's no fuzzy "this word appears twice" disambiguation UI. | L | 2 | occasional | P3 |

### D. Review (SRS)

| # | Finding | Diff | Impact | Freq | Pri |
|---|---------|------|--------|------|-----|
| 37 | Grading buttons (Forgot/Hard/Remembered/Easy) give no interval feedback — Anki shows "10m / 1d / 3d / 7d" on each button. Learners can't build trust in the scheduler without it. | M | 5 | every card | P0 |
| 38 | No daily new-card limit or session size cap. "Mixed" can open a 300-card session with no way to know how long it'll take. Add session length control (10/25/50/all). | M | 5 | daily | P0 |
| 39 | Space-to-reveal on keyup with sentence-id matching is solid, but there is no visible focus/keyboard hint until the card is revealed; the hotkey hint only shows under controls. Show "Space to reveal" on the card itself (it does — good) — but Escape exits the session with no confirm, mid-session. Session state does persist, so acceptable; document it. | S | 2 | occasional | P3 |
| 40 | The four stat pills (Total/Unknown/Forgotten/Remembered) use jargon: "Unknown" means "never reviewed" (it reads like an error). Rename to "New". | S | 3 | daily | P1 |
| 41 | Start menu has *three* stat surfaces (pills, three pie charts, queue dashboard) before any Start button — visual hierarchy inverts importance. The Start Mixed Review button should be the largest element at the top. | M | 4 | daily | P1 |
| 42 | Pie charts have `aria-hidden` on the chart but no text alternative summarizing the ratio for screen readers beyond the copy block — partially OK; make the percent semantic. | S | 2 | a11y | P3 |
| 43 | "Reset Progress" on the start screen is placed inline with the start filter buttons — a destructive action sitting beside primary actions. Move it into Stats view or behind a menu. | S | 4 | rare but catastrophic | P1 |
| 44 | Reset dialog: "Cancel" gets autofocus (good) but there's no focus trap — Tab escapes the dialog into the page behind it. Applies to all confirm dialogs. | M | 3 | a11y | P2 |
| 45 | No way to see *which* card is due when — no per-card browser (Anki's card browser). The stats browser partially covers this; expose next-due per sentence with sort. | L | 3 | weekly | P2 |
| 46 | Recall modes (full support → fill blank → reverse translate) are a killer feature and completely invisible — nothing explains that cards "level up". The completion screen mentions "promoted" with no explanation. Add a recall-mode legend / explanation panel. | M | 5 | daily | P0 |
| 47 | No sound/speech auto-play option on reveal for listening practice. | S | 3 | daily | P2 |
| 48 | No session timer or cards/minute pacing info in the header during review. | S | 2 | daily | P3 |
| 49 | Review error (save failure) renders as a small paragraph; the grade appears applied optimistically. Needs retry affordance ("Couldn't save — Retry"). | M | 3 | rare | P2 |
| 50 | No streak/consistency tracking (days studied). This is the #1 retention mechanic in every successful learning app. | M | 5 | daily | P0 |
| 51 | Interleaving is implemented but not surfaced: "Lessons mixed: 3" appears only after the session. Show the mix composition before starting. | S | 2 | daily | P3 |
| 52 | Keyboard: 1–4 and arrows work — excellent — but there's no `?` overlay listing all shortcuts app-wide. | M | 3 | early | P2 |

### E. Flashcards (imported-content study)

| # | Finding | Diff | Impact | Freq | Pri |
|---|---------|------|--------|------|-----|
| 53 | The checkpoint quiz fires every 5 cards unconditionally and cannot be disabled — an interruption some learners will hate. Make it a setting (Off / every 5 / every 10). | S | 4 | every 5 cards | P1 |
| 54 | Checkpoint quiz is one single question — the payoff doesn't justify the interruption. Offer 3 quick questions or fold into the completion screen. | M | 3 | frequent | P2 |
| 55 | Grades (Again/Hard/Good/Easy) on flashcards are session-only and do NOT feed the SRS — while Review's grades do. Two grading systems with identical labels and different consequences. Learners will believe flashcard grading schedules reviews. Unify or clearly label ("session marks only"). | L | 5 | every session | P0 |
| 56 | Space always reveals translation but the reveal buttons (Hint/Words/Grammar) have shortcuts H/W/G shown only in tooltips. Surface a shortcut hint line like other modes. | S | 2 | daily | P3 |
| 57 | Progressive reveal is strong pedagogy but the default flow doesn't encourage it: all four buttons look equal. Order/emphasize: Hint → Words → Grammar → Translation as an escalation ladder. | M | 3 | daily | P2 |
| 58 | Token chips speak on click (nice) but there's no visual indicator that clicking a chip plays audio + opens details; first-time users won't discover it. | S | 3 | daily | P2 |
| 59 | `grade-row` buttons have no keyboard shortcuts (1–4) unlike Review. Inconsistent. | S | 3 | daily | P1 |
| 60 | Lesson/language selects hide when only one exists (good), but when they hide there's no indication of *which* lesson you're studying except the small header in the card. | S | 2 | daily | P3 |
| 61 | No progress indication across sessions ("You've studied 30/50 sentences in this lesson historically"). Session progress resets silently. | M | 3 | daily | P2 |
| 62 | Restart/random-order toggle resets grades without warning. | S | 2 | occasional | P3 |
| 63 | RelatedSentences only appear after selecting a token — great feature, invisible until accidental discovery. | S | 3 | daily | P2 |

### F. Fill Blank & Multiple Choice

| # | Finding | Diff | Impact | Freq | Pri |
|---|---------|------|--------|------|-----|
| 64 | Escape during an active test wipes the attempt instantly with zero confirmation — one keypress destroys a 20-question run (progress is even cleared from storage). Confirm before discarding (fixed in this pass). | S | 5 | accidental | P0 |
| 65 | Question-count input can't be cleared while typing (`Number(value) || 1` snaps to 1); typing "25" fights the user. Use a draft value, clamp on blur (fixed in this pass). | S | 3 | every setup | P1 |
| 66 | Full-test type mode: Enter on the last question does nothing (moveFull clamps); user must find "Check test". Enter should finish (fixed in this pass). | S | 3 | every full test | P1 |
| 67 | Full-test completion shows only totals — no per-question review of what you got wrong. The single highest-value missing piece in test modes. | M | 5 | every test | P0 |
| 68 | Wrong answers are not fed back into any queue — a missed cloze disappears forever. "Retry missed questions" button on the results screen. | M | 5 | every test | P0 |
| 69 | Fill Blank picks ONE deterministic cloze per sentence (`stableShuffle(candidates, sentence.id)[0]`) — every test blanks the same word in the same sentence, forever. Vary by attempt (seed with attempt id). | S | 4 | every repeat test | P1 |
| 70 | The "Clue" card can fully give away the answer (meaning + note) while the answer is also playable via the Listen button before answering. Pedagogically intended for typing mode but defeats choice mode. Gate the Listen button or make it optional per-mode. | M | 3 | every question | P2 |
| 71 | `answersMatch` normalization: how forgiving is it (accents, punctuation, case)? Typing modes need explicit "close enough" feedback ("Almost — check accents"). | M | 4 | typing users | P1 |
| 72 | Continuous vs Full test terminology unexplained. "Continuous" means "check each answer immediately". Rename: "Instant feedback" / "Exam mode" with one-line descriptions. | S | 3 | every setup | P1 |
| 73 | Past results ("Statistics") stores only last 20 in localStorage, no trend, no per-lesson accuracy. | M | 3 | weekly | P2 |
| 74 | Multiple Choice mixes word-meaning and sentence-translation questions with no setup control over the ratio or type. | M | 3 | weekly | P2 |
| 75 | Distractor quality: options are random other meanings from the pool — with small lessons you get 2-option questions or absurd distractors. Consider same-POS / similar-length heuristics. | L | 3 | small lessons | P2 |
| 76 | Setup screens ignore the shared lesson browser's selected lesson only partially (initial selection seeds from `lesson`), but changing lessons midway through the *selector bar* isn't possible in these modes (bar hidden). Consistency gap. | M | 2 | occasional | P3 |
| 77 | The `role="tablist"` mode toggles lack `role="tab"`/`aria-selected` semantics (fixed in this pass). | S | 2 | a11y | P2 |

### G. Fydor Exchange

| # | Finding | Diff | Impact | Freq | Pri |
|---|---------|------|--------|------|-----|
| 78 | "Advanced pack data" textarea is the primary visual element even though 95% of users will use "Select file". Collapse the textarea behind a details/"Paste JSON instead" toggle. | S | 3 | weekly | P2 |
| 79 | After choosing a file, install requires noticing the preview appeared below — on long pages the preview renders off-screen. Scroll-to or restructure. | S | 3 | every install | P2 |
| 80 | Uninstall doesn't exist: "My Packs" tracks installs but you can't remove a pack (and its lessons) as a unit. | M | 4 | occasional | P1 |
| 81 | "My Packs" metadata lives in localStorage while lessons live in SQLite — deleting lessons in the manager leaves ghost pack records; clearing browser storage orphans the registry. Move pack registry into the DB. | L | 3 | eventual | P2 |
| 82 | Export metadata form silently allows empty author/version; packs shared with "Unknown author" hurt the sharing ecosystem. Nudge required fields. | S | 2 | sharing | P3 |
| 83 | No pack-level versioning UX: installing v1.1 over v1.0 isn't detected as an upgrade — just duplicate warnings by title. Compare pack id+version and offer "Update pack". | L | 4 | ecosystem | P1 |
| 84 | Search/filter for *installed packs* exists, but the lesson picker for export has no search. | S | 2 | at scale | P3 |
| 85 | No online discovery — "Exchange" implies a marketplace but it's file-passing only. Even a curated GitHub-hosted pack index ("Browse community packs") would transform it. | L | 5 | ecosystem | P0 |

### H. Cross-cutting: accessibility, visual, performance, platform

| # | Finding | Diff | Impact | Freq | Pri |
|---|---------|------|--------|------|-----|
| 86 | No visible focus indicator on buttons/links — only inputs and token chips have `:focus` styles. Keyboard users can't see where they are (fixed in this pass: global `:focus-visible`). | S | 5 | constant | P0 |
| 87 | No `prefers-reduced-motion` support for transitions/animations (fixed in this pass). | S | 3 | a11y | P2 |
| 88 | No dark mode. Study apps get used at night; this is a top-5 request in every review of a study tool. | M | 4 | nightly | P1 |
| 89 | Tooltips are CSS hover/focus-within only: they never show on touch devices and can clip at viewport edges; content inside tooltips (like "Double-click for slow speech") is undiscoverable on tablets. | M | 3 | touch | P2 |
| 90 | AudioButton's 180 ms single-click delay (to detect double-click) makes audio feel laggy on every click. Consider tap = play, long-press or modifier = slow, or a dedicated slow button on reveal. | M | 3 | constant | P2 |
| 91 | Web Speech quality varies wildly by OS voice; no voice picker, no rate setting, no per-language voice preference. Add a small speech settings panel (voice, rate) persisted via `saveUserSettings` (API already exists, unused!). | M | 4 | daily | P1 |
| 92 | There is no Settings screen at all, despite a `save_user_settings` Tauri command existing. Speech, checkpoint-quiz cadence, session size, theme all need a home. | M | 5 | weekly | P0 |
| 93 | sessionStorage-based progress means closing the app mid-test loses fill-blank/MC/flashcard positions (sessionStorage dies with the window in most WebViews). Long-lived progress should be localStorage or SQLite. | M | 4 | every app restart | P1 |
| 94 | Review page loads *all* full lesson bodies on mount for the stats browser ("without blocking first paint" — but it still fetches everything). At 100 lessons this is heavy; lazy-load on stats open. | S | 3 | at scale | P2 |
| 95 | `getReviewQueue` fetches the entire queue with no pagination; fine locally today, a scalability wall for power users with 10k sentences. | L | 3 | at scale | P2 |
| 96 | No data export/backup of the whole database (only per-lesson JSON / packs). One-click "Back up everything" + restore is table stakes for a local-first app. | M | 5 | rare but critical | P0 |
| 97 | No error boundary content review: `error.tsx`/`global-error.tsx` exist but weren't linked from flows; verify they offer "copy error / restart" actions. | S | 2 | rare | P3 |
| 98 | Window title never changes per screen (always the app name) — bad for alt-tab and browser dev. Set `document.title` per route. | S | 2 | constant | P3 |
| 99 | No i18n of the UI itself — a language-learning app whose UI is English-only limits the audience that teachers can bring. | L | 4 | ecosystem | P2 |
| 100 | No telemetry-free usage insights for the user ("You studied 4 days this week; 82% retention") — the learner-facing analytics layer that turns data into motivation. | L | 4 | weekly | P1 |

---

## 2. Top 20 immediate fixes

(✅ = applied in this pass)

1. ✅ Global `:focus-visible` outlines for all interactive elements (#86).
2. ✅ `prefers-reduced-motion` support (#87).
3. ✅ Confirm before Escape/Back discards an active Fill Blank / Multiple Choice test (#64).
4. ✅ Question-count input: free typing, clamp on blur/start (#65).
5. ✅ Enter finishes the full test on the last question in type mode (#66).
6. ✅ Router-based redirects for `/` and `/study/sentence-forge` — no full-page reload flash (#2).
7. ✅ Escape closes the Import Help panel (#and click-away hygiene).
8. ✅ Proper `role="tab"` / `aria-selected` on all mode tab groups (#77).
9. ✅ AudioButton communicates when speech is unsupported (#90-adjacent).
10. ✅ Rename "Unknown" pill to "New" in review summaries (#40).
11. ✅ Cosmetics: real arrow between language fields, × for tag removal with aria-labels (#33, #34).
12. ✅ Inline hint in Builder: "Select text in the sentence to annotate it" (#15).
13. ✅ Flashcard grading hotkeys 1–4 to match Review (#59).
14. ✅ Vary the fill-blank cloze per test attempt instead of forever blanking the same word (#69).
15. ✅ Surface JSON parse error details instead of bare "Invalid JSON." (#26).
16. ✅ Per-route document titles (#98).
17. Show scheduler interval preview on grade buttons ("Forgot · soon", "Easy · 7d") (#37) — needs scheduler read API surfaced to controls.
18. "Retry missed questions" on test completion (#68).
19. Wrong-answer review list on full-test completion (#67).
20. Settings screen (speech rate/voice, checkpoint quiz cadence, session size) using the existing `save_user_settings` command (#92).

## 3. Top 10 killer features

1. **Today dashboard** — due count, streak, "Continue" button, weekly retention. The retention engine. (#10, #50, #100)
2. **Unified SRS** — flashcard grades feed the same scheduler as Review; one memory model everywhere. (#55)
3. **Recall-mode ladder made visible** — show cards leveling up full-support → cloze → production; nobody else does sentence-level graduated recall this cleanly. (#46)
4. **Paste-lines lesson creation + AI-prompt round trip** — paste raw sentences, get a lesson skeleton; the prompt templates already close the AI loop. (#19)
5. **Community pack index** — a curated, in-app browseable catalog (static JSON on GitHub Pages is enough to start). (#85)
6. **One-click full backup/restore** (.fydorbackup). Trust anchor for local-first. (#96)
7. **Teacher mode** — export a pack + printable sentence sheet + a class progress rubric. (#educators)
8. **Listening mode** — audio-first review (hear → recall → reveal text), reusing existing TTS. (#47)
9. **Wrong-answer recycling** — every missed test question flows into a "weak items" queue shared across modes. (#68)
10. **Per-lesson mastery map** — heatmap of sentences × recall strength, clickable to drill. (#45, #61)

## 4. What would make users switch from Quizlet

- **Sentences, not term pairs**: every word/grammar/chunk stays attached to a real sentence with graduated recall — Quizlet can't represent this.
- **True SRS with intervals shown** (Quizlet's is paywalled and opaque). Fydor must show its scheduler to win this argument. (#37)
- **Local-first + free forever**: no login wall, no ads, offline. Say it louder on the landing surface than the sidebar note.
- **Import freedom**: JSON + AI prompt templates mean any textbook chapter becomes a lesson in minutes; Quizlet import is CSV term/def only.
- **No enshittification risk**: open pack format (.fydorpack) = your content is portable. Make "Export everything" one click to prove it. (#96)
- Missing today: polish parity (dark mode, mobile/touch), content catalog, and a today-dashboard habit loop — items #10, #85, #88.

## 5. What would make users recommend Fydor to friends

- A shareable artifact: "I made this lesson pack — install it in one click." Deep link / file association for `.fydorpack` (double-click installs).
- Visible progress worth bragging about: streaks, retention %, mastery maps (#50, #100).
- A magical first five minutes: sample lesson → first review → "come back tomorrow, 8 cards will be due" (#1, #37).
- Zero-friction pitch: "free, offline, no account" survives word-of-mouth intact.
- Delight details: token chips that speak, related-sentence discovery — make them discoverable so people *see* the magic (#58, #63).

## 6. What would make educators adopt it

- **Packs as courseware**: versioned packs with upgrade flow (#83), author/organization credit, license field already present — add a class-ready pack template.
- **Bulk authoring**: paste-lines + CSV import + AI prompt templates make lesson prep fit a teacher's planning hour (#19).
- **Printables & offline parity**: export a worksheet (cloze + answer key) from any lesson.
- **Progress visibility without accounts**: student exports a progress report file the teacher can read — keeps the no-server promise while enabling assessment.
- **Predictable content**: validation + preview before install already exists — a genuinely strong story; document the schema publicly for institutional trust.
- **UI in the classroom language** (#99).

## 7. What would make reviewers call this the best language learning app

- The **graduated sentence-recall ladder**, visible and explained — a defensible pedagogical differentiator reviewers can name (#46).
- **Local-first with zero telemetry** at a moment when every competitor is subscription + data harvesting; lean into it as the headline.
- **Craft**: dark mode, reduced motion, full keyboard operability, flawless focus states — reviewers punish jank in the first ten minutes (#86–88).
- **Instant time-to-value**: sample lesson auto-offered, tour that appears once, due-today dashboard (#1, #5, #10).
- **An ecosystem signal**: even a small curated pack catalog turns "note-taking tool for my own sentences" into "platform" (#85).
- **Radical data ownership**: one-click backup, documented open formats, working import/export round-trip (#96).

---

*Applied fixes from this audit are listed in section 2 (✅ items). Everything else is ranked backlog.*
