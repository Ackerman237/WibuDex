# Manga Scraper Platform — Project Documentation

This folder is the single source of truth for the project: what it is, how
we work, what's done, what's next, and why key decisions were made.

> Repository code: `Scrapper-manga` (frontend + API application)
> Reference prototype: `doujin-scraper` (hardened scraping engine)

## Structure

| Folder | Purpose |
|---|---|
| [`01-project-overview/`](01-project-overview/project-charter.md) | What the project is, goals, scope, tech stack |
| [`02-guidelines/`](02-guidelines/development-guidelines.md) | Rules and conventions the team follows |
| [`03-current-focus/`](03-current-focus/current-sprint.md) | What we're actively working on right now |
| [`04-progress-log/`](04-progress-log/changelog.md) | Changelog + dated session/work reports |
| [`05-roadmap/`](05-roadmap/backlog.md) | Backlog and future plans, prioritized |
| [`06-architecture/`](06-architecture/system-architecture.md) | System design + the scraper migration blueprint |
| [`07-security/`](07-security/security-policy.md) | Security policy and hardening checklist |
| [`08-decisions/`](08-decisions/decision-log.md) | Architecture Decision Records (ADRs) — why we chose what we chose |

## How to use this folder

- Update `03-current-focus/` every time the active task changes.
- Every time a feature is finished, add one line to `04-progress-log/changelog.md`
  and commit **before** moving to the next feature.
- When a non-trivial choice is made (e.g. "keep old app, replace only the
  scraper core"), write a short entry in `08-decisions/decision-log.md`
  instead of letting the reasoning live only in chat history.
- `05-roadmap/backlog.md` is the only place "not done yet" items should live —
  don't duplicate them into current-focus until they're actually started.
