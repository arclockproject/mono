# Contributing to ArcLock Project

Thank you for your interest in contributing to ArcLock Project! This guide will help you get started with the development process.

## Etiquette

> [!IMPORTANT]
>
> Please be aware that vibe-coding contributions are **🚫 STRICTLY PROHIBITED**. We are humans behind these open source projects, trying hard to maintain good quality and a healthy community. Not only do vibe-coding contributions pollute the code, but they also drain A LOT of unnecessary energy and time from maintainers and toxify the community and collaboration.
>
> All vibe-coded, AI-generated PRs will be rejected and closed without further notice. In severe cases, your account might be banned organization-wide and reported to GitHub.
>
> **PLEASE SHOW SOME RESPECT** and do not do so.

###### We hold the same belief as [github.com/antfu/contribute](https://github.com/antfu/contribute?tab=readme-ov-file#-etiquette) and thus we too abide by same said etiquette.

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

## Pull Request Guidelines

1. Update documentation if needed
2. Ensure all tests pass
3. Address any feedback from code reviews
4. Once approved, your PR will be merged

## Code of Conduct

Please be respectful and constructive in all interactions within our community.

## Questions?

If you have any questions, please [open an issue](https://github.com/ArcLockProject/mono/issues/new) for discussion.

Thank you for contributing to @arclockproject!
