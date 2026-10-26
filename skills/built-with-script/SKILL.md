---
name: built-with-script
description: Adopt and operate the Built with Script (BWS) kit — a local text-to-reading/storyboard pipeline with optional Google Apps Script cloud integration. Start with the local route (no API key needed), then optionally add the Google side for Gmail/Drive automation.
version: 1.0.0
metadata:
  author: Sourov Deb
  date: 2026-10-27
  source: E:\knowledge\New Good Stuff from chatgpt\BWS_Start_Here.md
  tags: [bws, built-with-script, reading, storyboard, google-apps-script, automation, local]
---

# Built with Script (BWS)

A local text-to-reading/storyboard pipeline with optional Google Apps Script cloud integration.

## 1. Local Route (Start Here)

Download and extract the entire source ZIP into a new folder, e.g. `E:\Studio\built-with-script`. Do not run from inside the ZIP.

### Quick Start

```cmd
START.cmd
```

Choose **1** to inspect, then **2** for the reading demonstration. Python 3.10+ required.

### Terminal Commands

```bash
python worker/bws.py doctor
python worker/pipeline.py examples/reading-workflow.json --workspace .
```

Open `reading.html` and `storyboard.html` under `output/<job-id>/`. Read each `receipt.json`:
- `DONE` = requested operation completed
- `PARTIAL` = only part of the request did
- `BLOCKED` = unavailable native apps produce a handoff, not fake success

### Using Your Own Writing

1. Create `inbox` in the kit folder
2. Put a UTF-8 `.txt` or `.md` file there
3. Open `web/index.html`, select **text.pack**, enter `inbox/my-writing.txt`
4. Download `task.json` into the kit folder
5. Run: `python worker/bws.py run --task task.json --workspace .`

Paths in tasks are relative to the workspace. Original files remain unchanged. Unchanged inputs reuse verified existing outputs.

## 2. Optional Image/Video Tools

The text reader, CSV ranking, and draft assembly use Python standard library. Optional packages:

```bash
python -m venv .venv
.venv\Scripts\python -m pip install -r requirements-optional.txt
.venv\Scripts\python worker/bws.py doctor
```

- **Pillow** — image exports
- **CairoSVG + FFmpeg** — symbolic animatic
- **FFmpeg** — proxies and MP3 extraction
- **FFprobe** — stream/duration checks
- **Blender, Resolve, Affinity** — your own installed applications

Set missing executable paths with `BWS_FFMPEG`, `BWS_FFPROBE`, or `BWS_BLENDER`.

For video after tools are available:
```bash
python worker/bws.py run --task examples/storyboard.job.json --workspace .
```

The example makes a six-second silent symbolic storyboard, not a full illustrated film.

## 3. Google Apps Script Integration

1. Open https://script.google.com/ and create a **new** project named "Built with Script"
2. Delete the empty starter function. Add script files: `00_Core`, `01_Setup`, `02_Queue`, `03_Collectors`, `04_Actions`. Copy matching `.gs` contents from `apps-script/`.
3. Add an HTML file named **Dashboard** and copy `Dashboard.html` into it.
4. Open Project Settings. Enable **Show appsscript.json manifest file in editor**. Replace its content with the supplied `appsscript.json` (sets Réunion timezone).
5. Run **setupBWS** in the editor. Review requested permissions (Gmail, Drive, Sheets, HTTPS, triggers, identity, mail quota).
6. Run **doctorBWS**. Inspect any blocked service.
7. Deploy → New deployment → Web app. Use your own account and **Only myself** access. Never make an owner-authority dashboard public.
8. Open the private dashboard. Queue the default **text.capture** example. Choose **Run ready tasks once**.
9. Choose **Collect one batch** to test metadata intake. Only after checks pass, choose **Start hourly routine**.

Google authorization/deployment must be completed in your account. Files uploaded to Drive is not the same as an installed Apps Script project.

## 4. Adoption Rules (for Hermes/Agents)

1. Read START_HERE.md. Run `python worker/bws.py doctor`. Inspect the actual return value.
2. Run the standard-library reading example once. Verify real output HTML and receipt.
3. Report only actionable blockers. Missing optional video/image software does not block text/jobs work.
4. For image/video tasks, select an implemented action and a bounded sample. Ask before installing missing dependencies.
5. Use the user's actual source and current reviewed profile. Never invent credentials or publication rights.
6. For cloud adoption, provide exact file names and current diagnostic. User must authorize Google account/deployment.
7. Continue independent work when one integration fails. A missing Affinity API produces a handoff.
8. Finish with actual output paths, hashes, test results, and one next action per blocked stage.

## 5. Key Paths

| Purpose | Path |
|---|---|
| Kit folder | `E:\Studio\built-with-script\` |
| Worker entry | `worker/bws.py` |
| Pipeline | `worker/pipeline.py` |
| Web UI | `web/index.html` |
| Examples | `examples/` |
| Output | `output/<job-id>/` |
| Apps Script files | `apps-script/` |
