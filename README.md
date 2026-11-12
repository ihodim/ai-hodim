# iHodim

A social web app for nights out. Friends say where they're going ("Friday, Club X, with Ivan and Maria"), everyone taps **Going / Maybe / Out**, and the confusion over who's coming is gone.

Launching first in **Blagoevgrad** with AUBG students and 5–6 local clubs.

- Product decisions and rules for contributors (and for Claude Code): see [CLAUDE.md](CLAUDE.md)
- Status: pre-v1, stack not chosen yet

## Working on this repo

```
git switch main && git pull          # always start from the latest main
git switch -c feature/<short-name>   # one branch per feature
# ...work, commit...
git push -u origin feature/<short-name>
# open a Pull Request on GitHub; the other person reviews and merges
```

Never commit directly to `main`. Never commit `.env` files or keys.
