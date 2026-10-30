# Keeping Chat and Cowork in Step

GitHub is the shared copy of the project. Both sides read from and write to the same repository.

## One-time setup (you)
1. In GitHub, give the connected account write access to `carecentrale/free-game-vitale`.
2. In Cowork, clone that repository, or open the unzipped `kids-game` folder and run `git remote -v` to confirm it points there.

## Each session
- **Start:** run `./scripts/sync.sh pull` to get the latest work.
- **End:** run `./scripts/sync.sh push "what changed"` to send your work to GitHub.

## Rules
- Only one side edits a file at a time. Pull before you start.
- Each new version gets a `CHANGELOG.md` entry and a tag (`git tag vX.Y.0`).
- Never commit keystores, passwords, or service account keys.
