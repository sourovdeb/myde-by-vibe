---
name: hermes-video-prompts
description: Four reusable video production prompts for Resolve (popups, charts) and Blender+Manim (recording sync, chapter storyboards). Use for adding visual overlays, charts, diagrams, and synchronized animations to existing timelines.
version: 1.0.0
metadata:
  author: Sourov Deb
  date: 2026-10-27
  source: E:\knowledge\New Good Stuff from chatgpt\HERMES_VIDEO_PROMPTS.md
  tags: [video, resolve, blender, manim, prompts, overlays, charts, storyboard]
---

# Hermes Video Prompts

Four reusable prompts for adding visual production to existing video timelines. Use one prompt per task. Do not run all four together.

## When to Use

- Adding popup text and colour emphasis to a Resolve timeline (Prompt 1)
- Adding charts, diagrams, and arrows to explanations (Prompt 2)
- Building Blender/Manim animations synchronized to a recording (Prompt 3)
- Creating a storyboard for a book chapter or ELT passage (Prompt 4)

## Prerequisites

- Resolve timeline open with transcript available
- Existing Resolve-Automation scripts at `E:\Resolve-Automation\`
- Blender and/or Manim installed (for Prompts 3-4)
- Source text/book file for Prompt 4

## The Four Prompts

### Prompt 1 — Resolve: Popups and Colours

Add popup text from the transcript to the open Resolve timeline. Select meaning-bearing words or phrases. Use scale-in, underline, and fade animations. Keep captions as captions. Avoid covering faces and demonstrations.

**Settings:**
- Accent palette: `#FFD166` / `#70D6FF` / `#C8A2FF`
- Random seed: 42
- Colour changes at phrase boundaries; minimum 3 seconds between changes
- Popup density: maximum one per sentence
- Popup length: 1–6 source words
- Entrance/exit: 0.15–0.25 seconds

**Rules:**
- Work on a duplicate timeline. Leave cuts and audio unchanged.
- Randomize accents between phrase blocks. Keep each phrase's colour stable.
- Never flash or recolour footage.
- Preview 20 seconds before expansion. Test placement, readability, and reruns.

### Prompt 2 — Resolve: Charts and Diagrams

Add charts, diagrams, and arrows matched to spoken explanations. Use comparisons, arrows, and diagrams. Reveal steps when discussed. Use charts for sourced numbers only.

**Rules:**
- Work on a duplicate timeline. Leave cuts and audio unchanged.
- Show labels, units, and sources. Never invent statistics or relationships.
- Reserve two-thirds for explanation graphics. Keep presenter within one-third.
- Don't obscure screen demonstrations.
- Test Fusion support before building. If unsupported, report and offer Manim.
- Preview 20 seconds before expansion.

### Prompt 3 — Blender + Manim: Recording Sync

Build animations synchronized to an existing recording. Validate timestamps against the recording. Use the timeline after editing. Build one shared cue manifest.

**Rules:**
- Never invent word timings. Keep narration and pauses unchanged.
- Manim: text, charts, diagrams. Blender: people, props, storyboard scenes.
- Choose 2D or 3D purposefully. Don't force both into everything.
- Keep character identities across scenes. Use source-supported actions.
- Match every animation's cue interval. Use the project's frame rate.
- Render one scene per job. Test 20 seconds before expansion.
- Import renders without shifting footage. Preserve editable projects.

### Prompt 4 — Blender + Manim: Chapter Storyboard

Create a storyboard for a book chapter or ELT passage. Anchor actions to words/phrases. Label interpretations and timings as PROPOSED. Do not claim recording synchronization.

**Rules:**
- Preserve source words and sequence. Separate reading text from directions.
- Don't duplicate pronunciation lines.
- For fiction, map source-supported events. For ELT, retain chapter objectives.
- Keep answers hidden until reveal.
- Preview three storyboard beats. Wait before expanding.
- After recording, use Prompt 3 for synchronization.

## Shared Execution Rules

### A. Reuse Before Building

Inspect versions, connections, and documentation. Test required operations before implementation. Locate `E:\Resolve-Automation\`. Read SCRIPT-GUIDE.md and MagicScript's CATALOGUE.md.

Reuse candidates:
- `_sourov.py`: cues, orchestration, fingerprints
- `_sourov_fx.py`: Fusion composition builders
- `_motion_text.py`: text animation
- `_performance_subtitles.py`: reading emphasis
- `_book_nouns.py`: phrase highlighting
- `_book_finish.py`: reading layouts
- `_asset_picker.py`: asset selection

### B. Timing Is Authoritative

Complete cleaning before adding visuals. Preserve cuts, speed, and pauses. Prefer the final timeline's transcript. Maintain one `cues.json` per job with source/timeline identities and fingerprints.

Placement tolerance: one frame maximum. Word highlighting needs word timestamps — SRT cues aren't word timestamps. Without word alignment, animate phrases.

### C. Colour and Layout

| Parameter | Starting value |
|---|---|
| Accent palette | #FFD166 / #70D6FF / #C8A2FF |
| Random seed | 42 |
| Colour changes | Phrase boundaries; minimum 3 seconds |
| Popup density | Maximum one per sentence |
| Popup length | 1–6 source words |
| Emphasis | One focus per thought-group |
| Entrance / exit | 0.15–0.25 seconds |
| Reading layout | Left 2/3 visuals; right 1/3 presenter |
| Preview | 20 seconds; 720p; project fps |
| Render jobs | One at a time |
| Audio processing | OFF |

### D. Content Determines Visuals

Charts need values, units, provenance. Never invent numbers. ELT chapters determine learning objectives. Fiction requires source-supported events.

### E. Build and Test

- Manim: text, charts, diagrams. Check labels, fonts, and layout.
- Blender: people, props, scene staging. Reuse rigs, actions, and assets.
- Test 20 seconds before expansion. Include clip joins when present.
- Test one-clip and two-clip cases. Rerun with the same inputs.
- Repair only the failing component. Two repairs per component maximum.
- Save verified builders for reuse. Separate BUILT, RENDERED, IMPORTED, TESTED.

## Reuse

Reuse the same numbered prompt. Change its source when needed. Retain the builder and settings. After approving the pilot, say: "Continue using this builder/settings. Keep the timing contract. Don't repeat completed work."
