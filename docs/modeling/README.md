# TimeArch modeling (KERKIS)

**Start here.** This folder describes how TimeArch works as a **knowledge-flow process**: who does the work, what packages of knowledge move between steps, and what the outside world sees.

## Plain-English picture

TimeArch takes:

1. **System sources** — code, docs, GitHub  
2. **A requested change** — what you want to add or modify  

…and produces:

1. **Change Proposal** — for stakeholders  
2. **Build Plan** — for engineers  
3. **Agent Pack JSON** — for coding agents / CI  
4. **Case status** — progress and release state  

From the outside, that whole journey is **one wrapped process**: *TimeArch Brownfield Discovery*.

## Read in this order

| # | Document | What it is |
|---|----------|------------|
| 1 | **[Figure gallery](./gallery.html)** | Drawn slides with clear names |
| 2 | **[Figure catalog](./figures/README.md)** | Each figure explained |
| 3 | **[Glossary](./GLOSSARY.md)** | Clear name ↔ technical ID |
| 4 | **[Meta-composition](./META-COMPOSITION.md)** | Full Actor / Artifact / Step model |
| 5 | **[ChatGPT / draw.io prompt](./prompts/chatgpt-drawio.md)** | Regenerate or refine drawings |

## Figure set (current)

| File | Clear title |
|------|-------------|
| [`01-timearch-brownfield-wrapped-process.jpg`](./figures/01-timearch-brownfield-wrapped-process.jpg) | TimeArch Brownfield Discovery — outside & inside |
| [`02-brownfield-step-by-step.jpg`](./figures/02-brownfield-step-by-step.jpg) | Brownfield path — step by step |
| [`03-who-does-the-work.jpg`](./figures/03-who-does-the-work.jpg) | Who does the work (code · AI · humans) |
| [`04-human-review-and-rework.jpg`](./figures/04-human-review-and-rework.jpg) | Human review and rework loop |
| [`05-one-ai-step-in-detail.jpg`](./figures/05-one-ai-step-in-detail.jpg) | One AI step in detail |
| [`06-nested-change-analysis.jpg`](./figures/06-nested-change-analysis.jpg) | Nested change analysis |

Older drafts live in [`figures/archive/`](./figures/archive/) (cryptic labels — do not use for slides).

## Naming rule we follow on diagrams

Every box shows:

- **Clear English name** (large) — e.g. *System inventory*  
- **Technical ID** (small, optional) — e.g. `(OA_inventory)`  

Never show only codes like `MC_timearch_brownfield` without a human title.
