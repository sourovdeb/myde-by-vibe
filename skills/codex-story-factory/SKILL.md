---
name: codex-story-factory
description: Six Codex prompts for building a local Story Factory — audit, asset factory, source-to-storyboard, adaptive script runner, Resolve handoff, and integration testing. Use with Codex CLI in a local project folder.
version: 1.0.0
metadata:
  author: Sourov Deb
  date: 2026-10-27
  source: E:\knowledge\New Good Stuff from chatgpt\Codex_Story_Factory_Prompts.md
  tags: [codex, story, factory, blender, resolve, animation, storyboard, assets]
---

# Codex Story Factory Prompts

Six sequential prompts for building a reusable local Story Factory. Use one at a time in a Codex session opened in the extracted kit folder. Start with 01.

## Delivery Boundary

The included scripts have Python/unit/media tests. The Blender-only adapter has not been executed in Blender. No Resolve integration has been run. These prompts close those gaps locally.

## MCP Setup (only after checking docs and approving installation)

```bash
codex mcp add blender -- uvx mcp-for-blender
codex mcp add openaiDeveloperDocs --url https://developers.openai.com/mcp
codex mcp list
```

Verify with a harmless scene-inspection call. A configured entry is not proof of a working connection.

---

## 01 — Audit and Reference Analysis

Implement a reusable local Story Factory, not a generic animation essay.

1. Read AGENTS.md, README.md, catalog.json, docs/SOURCES.md. Inspect existing files before proposing new architecture.
2. Read accessible descriptions/transcripts of reference videos. Deduplicate repeated links. Do not invent timestamps or observations.
3. Read current primary documentation: OpenAI Codex MCP docs, Blender manual/API matching installed version, upstream mcp-for-blender README, installed Resolve Developer/Scripting/README.txt.
4. Probe actual OS, Blender binary/version, Python environments, ffmpeg/ffprobe, Resolve version and edition, existing MCP configuration, free RAM/disk, GPU VRAM.
5. Inspect ten representative assets: cutout character, volumetric prop, stick pose, layered scene, alpha PNG, SVG, roots/pivots, materials.
6. Create only `docs/LOCAL_AUDIT.md` and `config.local.json`. Include actual executable paths, versions, evidence level for each video, supported adapters, remaining gaps, and one exact command for the first pilot.

**Deliverable:** Verified capabilities, blocked capabilities, next pilot. No giant installation plan.

---

## 02 — Reusable Asset Factory

Implement the reusable asset-factory stage. Reuse supplied assets rather than recreating catalogue entries.

1. Design two style presets: colourful layered papercut (literature/history) and high-contrast ink/stick figures (explainers).
2. Separate shape, palette, line weight, paper texture, shadow, camera, and lighting parameters from subject-specific names.
3. Implement a versioned asset contract: stable ID, display name, kind, version, units/up-axis, normalized bounds, root, editable parts, real pivot locations, material controls, optional rig/animation data, source/rights, file hashes, export formats, tested application versions.
4. Build a genuine three-asset pilot: one jointed stick figure, one layered papercut character, one volumetric ballot box.
5. Export each approved pilot as .blend master, GLB interchange copy, transparent PNG, and editable SVG.
6. Create one contact sheet from actual Blender renders, one alpha edge check, one small validation report.

**Deliverable:** Visible three-asset pilot for approval before expanding the library.

---

## 03 — Source to Storyboard

Build the source-to-storyboard stage using the existing asset catalogue and approved style preset.

1. Use only supplied source text or explicitly approved edition. Store edition/translation, chapter and paragraph/page locators.
2. For copyrighted material, do not republish source chapters. Keep private source references.
3. Define whether production scope means one programme, all programmes combined, or each subject.
4. Produce a shot schema: source locator, exact covered range, start/end frames, duration, speaker/character bindings, place/time, shot size, visible action, reusable asset IDs, on-screen text, motion preset, accessibility notes, citations/rights, quality status, source coverage.
5. Map every source passage once; flag gaps and overlaps.
6. Choose visuals by job: dialogue → stable staging; spatial action → wide view + detail; argument → comparison/diagram; historical → dated cited sequence; reflection → restrained visual metaphor.
7. Create only a six-shot pilot for a supplied passage. Include contact sheet, readable shot list, source-coverage report.

**Deliverable:** Six-shot pilot for approval before processing the next bounded chapter.

---

## 04 — Adaptive Script Runner

Implement one reusable command-line entry point with small tested modules behind it.

1. Read and extend `scripts/run.py` instead of replacing working functions blindly.
2. Add separate adapters for Blender-native construction/rendering, media packaging, and optional Resolve automation.
3. User-facing interface: `doctor`, `validate`, `build --id`, `preview --shot`, `render --episode`, `handoff`, `resume`.
4. Expose motions: hold, fade, slide, pop, camera push, parallax, rigged gesture. Each motion declares required capabilities.
5. Detect paths and versions, validate feature availability, resolve known adapter, estimate bounded workload.
6. Start with 640x360 or 960x540, 25 fps pilot, one worker. Choose final resolution only after measured performance.
7. Use render checkpoints, per-shot timeouts, job lock, content-hash caching, transactional output folders.
8. Add tests for: missing assets, unsupported schemas/API versions, paths with spaces/non-ASCII, traversal, no-overwrite, stale caches, locks, failed import, cancelled render, insufficient disk, timeout, failed output verification.

**Deliverable:** Tested 12-second pilot with command, receipt, and visible output.

---

## 05 — Resolve Handoff

Implement the Blender-to-Resolve handoff with a fully usable manual path and optional verified API adapter.

1. Read installed Resolve Developer/Scripting/README.txt. Identify actual edition/version and supported Python/Lua environment.
2. Default handoff: numbered PNG RGBA sequence for transparent motion, separate transparent PNG elements for manual Fusion compositing, normal review MP4 with no alpha.
3. Record resolution, exact FPS, inclusive frame range, duration, colour transform, bit depth, alpha interpretation, intended background, source hashes.
4. Inspect transparent edges over light and dark backgrounds. Do not double-apply AgX/display transform.
5. Create a disposable, uniquely named Resolve pilot project/timeline only after user saves current work and approves.
6. Import a 12-second sequence and optional user-supplied audio. Place on intended tracks. Add readable title. Verify duration and frame rate by readback.
7. Expose reusable parameters of a simple Fusion composition: media paths, subject/background layers, transform, timing, text, outline/shadow.

**Deliverable:** Media handoff folder, tested adapter or explicit unsupported status, manual import card, compact verification receipt.

---

## 06 — Integration and Acceptance

Run acceptance testing on the existing Story Factory. Do not rebuild accepted assets.

1. Read AGENTS.md. Compare catalogue, source coverage, approved style, input hashes, native masters, export receipts.
2. Run pure Python tests first. Then one Blender import/render test in a fresh background process.
3. Use six deliberately different pilot cases: layered cutout person, volumetric prop, rigged gesture or honestly labelled unrigged pose, transparent overlay, two-character scene, text/diagram scene.
4. Demonstrate: one parameter file changes colour, scale, camera, and timing; second run reuses only valid outputs; changing an input invalidates the right output; cancelled job resumes safely; unsupported feature produces explicit fallback.
5. Final acceptance package: one 12–30 second video, Blender master if native stage ran, Resolve-friendly media folder, small reusable scripts, one beginner-readable command card, one evidence report.

**Deliverable:** PASS / PARTIAL / FAILED per stage, with exact output paths and next actionable correction.
