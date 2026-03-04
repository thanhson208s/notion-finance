# AGENTS Playbook — Personal Finance App - Front End

This document guides AI agents working in this repo. All business logic, features, and code conventions are defined in `REQUIREMENTS.md` and `../backend/docs`.

## 1) Mandatory Objectives

- Follow business requirements strictly — prioritize correctness over optimization.
- Do not add features outside the scope of documentation.
- Use MCP context7 to access required resources (codebase, docs).
- Always update documentation when business logic changes or doc gaps are found.
- Always separate components by business domain and reuse shared components when possible — avoid copy/paste code.

## 2) Source of Truth

When information conflicts, follow this priority order:

1. `REQUIREMENTS.md`
2. `../backend/docs/feature-*.md` (detailed feature docs per module)
4. Current code in `src/`

When conflicts are found between docs and code:

- Do not guess business logic.
- Document the conflict in the handover report.
- Follow the higher-priority document.

## 3) Workflow Orchestration

### 3.1 Plan Mode Default

- Enter plan mode for any non-trivial task (3+ steps or architectural decisions)
- If something goes wrong, STOP and re-plan immediately — don't keep pushing
- Read `REQUIREMENTS.md` carefully and ask clarifying questions before planning

### 3.2 Subagent Strategy

- Use subagents to keep the main context window clean
- Offload research, exploration, and parallel analysis to subagents
- Each subagent focuses on a single task

### 3.3 Self-Improvement Loop

- After each user correction: update `tasks/lessons.md` with the pattern
- Write rules to prevent repeating the same mistakes
- Review lessons at session start

### 3.4 Verification Before Done

- Never mark a task as complete without proving it works
- Run tests, check logs, demonstrate correctness
- Ask yourself: "Would a senior engineer approve this?"

### 3.5 Demand Elegance (Balanced)

- For non-trivial changes: pause and ask "is there a more elegant way?"
- For simple fixes: don't over-engineer

### 3.6 Autonomous Bug Fixing

- When receiving a bug report: just fix it, don't ask for hand-holding
- Find logs, errors, failing tests → resolve them
- Zero context switching required from user

## 4) Task Management

1. **Plan First**: Write plan to `tasks/todo.md` with checkable items
2. **Verify Plan**: Check in before starting implementation
3. **Track Progress**: Mark items complete as you go
4. **Explain Changes**: High-level summary at each step
5. **Document Results**: Add review section to `tasks/todo.md`
6. **Capture Lessons**: Update `tasks/lessons.md` after corrections

## 5) Standard AI Workflow

Every task follows this flow:

1. Identify affected components/pages in `src/`.
2. Read `REQUIREMENTS.md` and related `../backend/docs/feature-*.md`.
3. Only modify code within the scope described in documentation.
4. Run minimum checks after changes:
   - `npm run lint`
   - `npm run test`
   - `npm run build`
5. If code changed, update version/changelog before commit with format in `CHANGELOG.md` like this template:

```markdown
## [0.7.4] - 2026-02-23

### Changed

- fix(test-cases): sectionId not updating when editing test case
```

Brief report: what was changed, which docs were followed, remaining issues.

### Core Principles

- **Simplicity First**: Keep changes as simple as possible. Minimal code impact.
- **No Laziness**: Find root causes. No temporary fixes. Senior developer standards.
- **Minimal Impact**: Only touch what's necessary. Avoid introducing bugs.

## 6) Pre-task Checklist

- [ ] Read all related feature docs.
- [ ] Follow conventions in REQUIREMENTS.md.
- [ ] Maintain response/error/pagination standards.
- [ ] Handle error handling correctly (toast/inline).
- [ ] Check role-based UI behavior.
- [ ] Run lint/test/build (or state reason if not possible).
- [ ] Update version/changelog if code changed.
- [ ] Document scope of changes and remaining risks.
- [ ] Update `tasks/lessons.md` if new lessons learned.
