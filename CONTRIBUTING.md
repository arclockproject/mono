# Contributing to ArcLock Project

Thank you for your interest in contributing to ArcLock Project! This guide will help you get started with the development process.

## 🤖 Using AI

You're welcome to use AI tools to help you contribute. But there are two important ground rules:

### 1. Never let an LLM speak for you

When you write a comment, issue, or PR description, use your own words. Grammar and spelling don't matter &ndash; real connection does. AI-generated summaries tend to be long-winded, dense, and often inaccurate. Simplicity is an art. The goal is not to sound impressive, but to communicate clearly.

### 2. Never let an LLM think for you

Feel free to use AI to write code, tests, or point you in the right direction. But always understand what it's written before contributing it. Take personal responsibility for your contributions. Don't say "ChatGPT says..." &ndash; tell us what _you_ think.

PRs that we consider fully vibe-coded may be closed without further explanation.

For more context, see [Using AI in open source](https://roe.dev/blog/using-ai-in-open-source).

###### We hold the same belief as [github.com/antfu/contribute](https://github.com/antfu/contribute?tab=readme-ov-file#-using-ai) and thus we too abide by same said etiquette.

## Development Setup

### Prerequisites

- Node: ^20.20.0
- PNPM: ^10.28.2
- Recommended to use NVM and do `nvm install 20 && nvm use 20`
- PNPM can be enabled with `corepack enable`, which uses the version set in `package.json`

### Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/<your-username>/mono.git`
3. Navigate to the project directory: `cd mono`
4. Install dependencies: `pnpm install`
5. Build packages and run dev docusaurus: `pnpm run dev`

### Development Mode

- `pnpm run dev` - Runs `packages:build`, then `docs:dev`.
- `pnpm run dev-host` - Same as `dev`, but binds to `0.0.0.0` so other devices on your network can open the site.
- `pnpm run docs:dev` - Starts the docusaurus site at http://localhost:3000 to test components in real-time.
- `pnpm run packages:build` - Builds all packages.

The docs site uses the built packages, so run `pnpm run packages:build` (or restart `pnpm run dev`) after changing package code.

## Development Workflow

1. Create a new branch: `git checkout -b <type>/<short-description>`, e.g. `feat/audio-fade` or `fix/common-random-range`. Use a type from the list below. Adding the scope is optional.
2. Start development mode: `pnpm run dev`
3. Make your changes and test them live in the docs site at http://localhost:3000
4. Check types: `pnpm run docs:typecheck`, and `pnpm type-check` in the package you changed
5. Check code style: `pnpm lint` in the package you changed (`pnpm lint:fix` fixes what it can)
6. Build the docs site: `pnpm run docs:build`
7. Commit your changes using the conventions below, e.g. `feat(common): Add fade option to Audio.`
8. Push your branch to your fork
9. Open a pull request

## Documentation

- **API pages** are generated from the JSDoc in `packages/`. To change them, edit the JSDoc, not the files in `docs/docs/api/` (they are generated and gitignored).
- **Guide pages** are written by hand in `docs/docs/common/` and `docs/docs/mmd-player/`. Use them for live examples (` ```tsx live `) and longer explanations.
- New components and libraries get an API page automatically. Add a guide page if they need examples.

See [AGENTS.md](./AGENTS.md) for the full JSDoc style guide.

## Commit Message Conventions

We follow [Conventional Commits](https://www.conventionalcommits.org/) for clear and structured commit messages:

- `feat:` New features
- `fix:` Bug fixes
- `docs:` Documentation changes
- `style:` Code style changes (formatting, etc.)
- `refactor:` Code changes that neither fix bugs nor add features
- `perf:` Performance improvements
- `test:` Adding or updating tests
- `chore:` Maintenance tasks, dependencies, etc.

For a breaking change, add `!` after the type or scope, e.g. `feat(common)!: Rename Audio to AudioManager.`

Current Scopes:

- `(docs)` Docusaurus documentation
- `(common)` @arclockproject/common
- `(mmd-player)` @arclockproject/mmd-player
- `(mono)` For anything else outside those scopes. Generally monorepo related.

## Releasing

1. Preview: `pnpm run release-preview:common` (or swap for other package).
2. Actions → **Release** on `dev`, pick the package.
3. Approve on npmjs.com → package → **Staged Packages**.

Only commits with the package's scope count. `!` → major, `feat` → minor, else patch.

## Pull Request Guidelines

1. Update the JSDoc and guide pages if needed
2. Ensure type checks, lint and `pnpm run docs:build` pass
3. Address any feedback from code reviews
4. Once approved, your PR will be merged

## Code of Conduct

Please be respectful and constructive in all interactions within our community.

## Questions?

If you have any questions, please [open an issue](https://github.com/ArcLockProject/mono/issues/new) for discussion.

Thank you for contributing to [@arclockproject](https://github.com/ArcLockProject)!
