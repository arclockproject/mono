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

### Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/ArcLockProject/mono.git`
3. Navigate to the project directory: `cd mono`
4. Install dependencies: `pnpm install`
5. Build packages and run dev docusaurus: `pnpm run dev`

### Development Mode

`pnpm run docs:dev` - This starts a docusaurus site at http://localhost:3000 to test components in real-time.
`pnpm run packages:build` - This builds all packages.
`pnpm run dev` - This runs `packages:build` then `docs:dev`.

## Development Workflow

1. Create a new branch: `git checkout -b feat/your-feature-name`
2. Start development mode: `pnpm run dev`
3. Make your changes and test them live in the components dedicated index.stories.tsx
4. Check and fix code style and formatting issues: `pnpm run typecheck`
5. Build the storybook app: `pnpm run docs:build`
6. Commit your changes using the conventions below
7. Push your branch to your fork
8. Open a pull request

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

Current Scopes:

- `(docs)` Docusaurus documentation
- `(common)` @arclockproject/common
- `(mmd-player)` @arclockproject/mmd-player
- `(mono)` For anything else outside those scopes. Generally monorepo related.

## Pull Request Guidelines

1. Update documentation if needed
2. Ensure all tests pass
3. Address any feedback from code reviews
4. Once approved, your PR will be merged

## Code of Conduct

Please be respectful and constructive in all interactions within our community.

## Questions?

If you have any questions, please [open an issue](https://github.com/ArcLockProject/mono/issues/new) for discussion.

Thank you for contributing to [@arclockproject](https://github.com/ArcLockProject)!
