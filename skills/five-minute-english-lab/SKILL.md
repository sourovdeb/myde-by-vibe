---
name: five-minute-english-lab
description: Design blueprint and workflow setup for the 5-Minute English Lab — a free, visual microlearning library. One master lesson format produces HTML player, WordPress article, Medium post, LinkedIn carousel, and Gmail delivery. Hourly schedule, one objective per lesson, A2–B1 level.
version: 1.0.0
metadata:
  author: Sourov Deb
  date: 2026-10-27
  source: E:\knowledge\New Good Stuff from chatgpt\blueprint.md
  tags: [english, elt, microlearning, education, wordpress, github-pages, linkedin, medium, gmail]
---

# Five-Minute English Lab

A free, visual microlearning library. One reusable lesson system, several publishing outputs.

## The Recommendation

Build **one free learning library, one reusable lesson system, and several publishing outputs**. Keep your website as the main home, use the `free_education` repository for approved source files and a GitHub Pages mirror, and use LinkedIn and Medium to distribute useful reading versions.

**Core idea:** Turn valuable teaching knowledge into original, small learning experiences that people can actually use.

## Three Learner Paths

| Entrance | Learner promise | Example |
|---|---|---|
| **Use English** | Solve a small real-life communication problem | Ask for something politely; understand a short notice |
| **Teach English** | Make a better teaching decision and explain why | Choose a useful concept-checking question |
| **English for children** | Explore language through simple pictures, sounds, actions | Match a spoken quantity to original drawings |

Start with older teens and adults learning practical English around A2–B1 (editorial estimate).

## Platform Roles

| Platform | Role | What the learner receives |
|---|---|---|
| **WordPress website** | Main home, library, explanations, route into lesson player | Complete lesson, interaction, feedback, reading mode, downloads |
| **GitHub Pages** | Independently usable static mirror of approved lessons | Same playable lesson, not merely a repository file |
| **LinkedIn** | Discovery and useful standalone learning | Short post with diagram, or small PDF carousel, plus lesson link |
| **Medium** | Readable explanation and distribution | Properly formatted article with visuals, self-check, link to play |

## The Five-Minute Learning Contract

Every lesson finishes this sentence: **"After this, the learner can…"**

| Time | Experience | Purpose |
|---|---|---|
| 0:00–0:20 | Meet a tiny situation or puzzle | Establish a reason to learn |
| 0:20–1:00 | See one diagram and a short example | Make the idea understandable |
| 1:00–2:30 | Make two or three meaningful decisions | Practise the target skill |
| 2:30–3:20 | See why the choices worked or failed | Correct the misunderstanding |
| 3:20–4:30 | Try a new situation without the same scaffolding | Check transfer beyond memorising |
| 4:30–5:00 | Keep a takeaway and a suggested later review | Connect to continued learning |

## Visual Direction

- Restrained, high-contrast interface with one clear challenge at a time
- Generous text, original line drawings, simple shapes, very little decorative movement
- Map is optional; default is a clear set of cards or a list
- Engineering budget: under 250 KB for core text-and-diagram lesson (excluding optional audio)
- System fonts, small original visuals, no compulsory video, no external advertising/analytics
- Large controls (~48 CSS pixels), keyboard support, visible focus, readable contrast
- Feedback that doesn't rely on colour alone

## Ten Game Patterns

| Pattern | What the learner does | What the lesson checks |
|---|---|---|
| Conversation fork | Choose a reply and see a short consequence | Whether it achieves the intended meaning |
| Sentence workshop | Tap phrase blocks into place, then change one part | A usable construction |
| Timeline detective | Place events on a line and choose a sentence | Time and intended meaning |
| Evidence hunt | Tap words in a short notice that support an answer | Reading evidence, not guessing |
| Collocation pairs | Connect words, then complete a new example | Meaningful combinations |
| Stress spotlight | Tap the stressed word and compare a recording | How emphasis changes meaning |
| Direction grid | Follow or choose instructions on a small map | Understanding directions |
| Email repair shop | Replace an unclear or unsuitable phrase | Clarity and register |
| Teacher decision room | Choose a question, instruction, or next action | Reason for the decision |
| Picture-and-quantity trail | Match sounds, words, and original pictures | Small language/number objective |

**Build only three interaction families initially:** choose-and-explain, arrange-and-match, find-the-evidence.

## One Master Lesson, Several Outputs

**HTML** provides the page and readable lesson; **CSS** controls appearance; **JavaScript** handles choices and feedback; **SVG** holds simple diagrams.

### Lesson Record Schema

```text
Identity     Stable ID, version, title, language
Audience     Who it is for; prior knowledge
Outcome      One observable ability
Lesson       Situation, model, activity, feedback
Transfer     New task and acceptable responses
Visual       Diagram plus its text equivalent
Evidence     References; source and asset rights
Publication  Review status; canonical address
```

## Rights and Quality Gates

| Status | Meaning | Action |
|---|---|---|
| **Cleared** | Original work, verified open licence, or explicit permission | Publish with required attribution |
| **Unclear** | Ownership, licence, or permitted use is uncertain | Keep private; clarify permission |
| **Not cleared for redistribution** | No suitable permission for public reuse | Do not publish; create original material |

## Workflow Setup

| Setting | Value |
|---|---|
| Cadence | One lesson each hour |
| Timezone | Indian/Reunion, UTC+4 |
| Duration target | Three to five minutes |
| Starting pathway | Use English; A2–B1 estimates |

### Every Lesson Pack

| Platform | Required output |
|---|---|
| Website / GitHub Pages | HTML/CSS/JavaScript player |
| WordPress | Article HTML for review |
| Medium | Article with diagram and self-check |
| LinkedIn | Post text and four-panel PDF |
| Master record | JSON, SVG and text diagram |
| Documentation | Instructions, sources, rights and tests |

### Storage

- **Drive folder:** https://drive.google.com/drive/folders/1bdFvDns1G3zQXVpIYavA_oZAMwGpGQdW
- **Repository:** `sourovdeb/free_education`
- **Branch:** `microlearning/hourly`
- **Path:** `interactive-lessons/five-minute-lab/`
- **Gmail destination:** `sourovdeb.is@gmail.com`
- **Gmail label:** `Free Education/5-Minute English Lab`

### Publication Rules

- Saving is not website deployment. GitHub changes remain under review.
- WordPress, Medium, and LinkedIn remain unpublished.
- No website settings are changed. No Pages deployment is configured.
- Verify every upload and email acceptance. Retry failures without duplicating completed packs.

## First Pilot

1. **Audit rather than generate.** Reconcile existing indices into a single registry of stable lesson IDs, files, rights status, and actual publication status.
2. **Revise three existing topic candidates:** Polite requests, Reading for gist and evidence, Everyday collocations.
3. **Produce playable and reading/social versions together.** Test with 5–10 people using ordinary phones.
4. **Do not expand** until the first set passes rights review, teaching review, mobile/keyboard checks, reader-mode checks, and the agreed download budget.

## Automation (After Pilot Works)

```
Approved master lesson
    ↓
Generate pages + diagrams + exports
    ↓
Check learning, rights, accessibility
    ↓
Private preview and human approval
    ↓
Deploy website and independent mirror
    ↓
Verify the real public lesson URLs
    ↓
Prepare WordPress drafts
Medium import / LinkedIn manual pack
```
