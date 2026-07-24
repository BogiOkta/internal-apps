# AI-Assisted Development Working Agreement

## 1. Repository as the source of truth

The repository, committed code, migrations, tests, and documentation are the
authoritative project state. Chat histories are temporary working context and
must not be treated as the primary project memory.

Every new AI session must inspect the current repository before making changes.
At minimum, read:

- `docs/PLATFORM_STATE.md`;
- `docs/AI_WORKING_AGREEMENT.md`;
- the documentation for the affected module;
- relevant architecture and coding-guideline documents;
- recent relevant entries in `docs/CHANGELOG.md`.

Do not rely only on summaries copied from previous AI sessions.

## 2. Short functional sessions

Each AI session must have one narrow, explicit goal. Preferred scope is one
small feature, backend or Portal slice, migration group, controlled smoke,
review and commit, or documentation task.

Do not combine several large implementation phases in one session. End a
session as soon as its defined goal is implemented, validated, documented, and
committed and pushed when those Git actions were part of the task. Start a new
session for the next independently meaningful task.

## 3. Frequent session reset

Reset Codex or Claude Code after each completed functional unit. Always reset
before a new sprint, a different application layer, an unrelated module, a
large review after a large implementation, or work whose context no longer
depends on the current session.

Do not preserve a long conversation merely because usage remains. Context
freshness and repository-grounded reasoning take priority.

## 4. Smallest useful delivery

Prefer the smallest independently useful and verifiable change. For example:

- database foundation before repository code;
- repository, service, and API before Portal;
- employee Portal before administrator Portal;
- implementation before controlled smoke;
- controlled smoke before commit;
- documentation before ending the session.

Do not implement speculative future functionality or redesign stable
architecture unless the task explicitly requires it.

## 5. Documentation after every successful increment

After every minimal successful functional increment, update the affected
repository documentation before closing the task. Relevant documents may
include:

- `docs/PLATFORM_STATE.md`;
- `docs/CHANGELOG.md`;
- `docs/modules/<module>.md`;
- `docs/domain/<domain>.md`;
- `docs/architecture/*`;
- operational or smoke documentation.

Documentation describes validated implementation, not plans or assumptions.
Do not postpone all documentation until the end of a large sprint.

## 6. Platform state snapshot

`docs/PLATFORM_STATE.md` is the concise current-state entry point for new
sessions. It remains short and operational and records:

- current platform status;
- latest validated milestone and relevant commit;
- completed modules and layers;
- active and next task;
- known limitations;
- required validation state;
- links to detailed module documentation.

It must not duplicate the changelog or detailed architecture. Update it
whenever a meaningful implementation milestone is completed and committed.

## 7. Session start contract

Every implementation session begins by:

1. Inspecting Git status and branch.
2. Reading `docs/PLATFORM_STATE.md`.
3. Reading `docs/AI_WORKING_AGREEMENT.md`.
4. Reading documentation for the affected module.
5. Inspecting relevant existing code and conventions.
6. Confirming the exact task boundary.
7. Implementing only that boundary.

Do not start by generating a new architecture from scratch.

## 8. Session end contract

Every functional session ends by:

1. Reviewing only the changed scope.
2. Building and running relevant tests.
3. Running the relevant controlled smoke when required.
4. Running `git diff --check`.
5. Updating affected documentation.
6. Reporting exact files changed and validation results.
7. Committing and pushing only when explicitly requested.
8. Confirming final Git status.
9. Ending the session.

Do not begin the next sprint after completing this sequence.

## 9. Codex usage

Use Codex primarily for focused repository implementation, local inspection,
builds and tests, controlled smoke scripts, targeted corrections, and final
review, commit, and push.

Codex prompts should be short and repository-grounded. Prefer references to
repository documentation over repeating project history. A typical prompt
states the repository and branch, documents to inspect, one exact task, locked
constraints, validation requirements, and whether commit is allowed.

## 10. Claude Code usage

Claude Code may be used when it offers clear value for broad frontend work
across related components, repository-wide semantic review, complex
multi-file refactoring, UI consistency review, analysis of a large existing
implementation, or a second independent security or architecture review.

Do not involve Codex and Claude Code automatically. One implementation agent
owns a task; a second normally acts only as reviewer, focused specialist, or
independent verifier. Do not allow overlapping uncontrolled changes to one
working tree. Commit or safely checkpoint work before handing it to another
agent.

## 11. ChatGPT usage

Use ChatGPT for architecture and domain decisions, sprint decomposition,
locking task boundaries, validation and smoke planning, reviewing
implementation reports, preparing concise implementation prompts, and
maintaining continuity between independent sessions.

ChatGPT relies on repository documentation and reported validation rather than
reconstructing state from memory alone.

## 12. Prompt-size discipline

Prompts must be as short as possible while remaining unambiguous. Do not repeat
stable documented architecture, completed sprint history, available schema
descriptions, or generic repository rules. Repeat only constraints whose
violation would materially change the task.

Prefer “Inspect and follow the existing repository conventions” over
restating every convention. Use detailed prompts only for new domain
decisions, security-sensitive or transactional behavior, destructive
operations, migrations, controlled smoke, and ambiguous cross-module work.

## 13. Validation before trust

AI completion claims are insufficient. A change is complete only after
relevant validation passes, which may include build, tests, type checking,
formatting, migration review or apply, controlled API or browser smoke,
database post-state verification, and Git diff review.

Documentation must distinguish implemented, statically reviewed, runtime
validated, and skipped scenarios caused by a missing safe fixture.

## 14. No uncontrolled continuation

When a task uncovers an adjacent defect or improvement, correct it only when
the current task requires it to work safely. Otherwise record it as a
follow-up. Do not silently expand a sprint. Report and revalidate every runtime
correction.

## 15. Secret and environment handling

Credentials and operator secrets remain in local environment files. Never:

- place secrets in prompts;
- place secrets directly in commands;
- print secret values;
- commit local environment files;
- copy credentials into documentation.

Environment templates contain placeholders only.

## 16. Git discipline

Prefer this lifecycle:

Implementation → validation → documentation → final review → commit → push →
new AI session.

Do not stack unrelated uncommitted changes across sessions. The working tree
should normally be clean before a new sprint.

## 17. Practical session-size rule

A session normally contains only one of implementation, controlled validation,
or finalization and commit. A very small implementation may combine
implementation and validation.

Large implementations should use:

- Session A: implementation and static validation;
- Session B: controlled runtime smoke and corrections;
- Session C: final review, documentation confirmation, commit, and push.

The goal is reliable progress per unit of context and usage, not maximum work
per session.
