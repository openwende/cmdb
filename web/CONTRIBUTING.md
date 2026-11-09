# Contributing to cmdb-web

> **We are not accepting outside pull requests yet.** See the [organization contributing guide](https://github.com/openwende/.github/blob/main/CONTRIBUTING.md) for why and for other ways to help. The notes below are for project members and for anyone working on their own fork.

## Set up

You need Node.js 22 or later, and a running [cmdb-server](https://github.com/openwende/cmdb-server).

```bash
corepack enable
pnpm install
pnpm dev
```

## Checks

CI runs these checks. Run them locally before you push:

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm exec vitest run
pnpm build
```

## Guidelines

- **Text:** user-facing text goes in both `src/locales/en-US.json` and `src/locales/zh-CN.json`.
- **API calls:** go through the shared client in `src/api`, which handles tokens and sign-in redirects.
- **Types:** avoid `any` in new code. ESLint warns about it, and existing warnings are being cleaned up over time.
- **Tests:** add tests with behavior changes, using Vitest and Testing Library.
