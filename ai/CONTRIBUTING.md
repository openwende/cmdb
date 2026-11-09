# Contributing to cmdb-ai

> **We are not accepting outside pull requests yet.** See the [organization contributing guide](https://github.com/openwende/.github/blob/main/CONTRIBUTING.md) for why and for other ways to help. The notes below are for project members and for anyone working on their own fork.

## Set up

You need [uv](https://docs.astral.sh/uv/). Database tests also need PostgreSQL with pgvector; they are skipped when it is not available.

```bash
uv sync
```

## Checks

CI runs these checks. Run them locally before you push:

```bash
uv run ruff check .
uv run ruff format --check .
uv run pytest
```

Tests do not call the model or the network.

## Changing prompts or tools

These changes affect answer quality in ways unit tests cannot see:

1. **Measure:** run the same configuration three times with `eval/run_eval.py` and compare with `eval/compare.py`. Include the numbers in the pull request.
2. **Start small:** when changing a judging prompt, tune it on a few cases before running the full set, because runs spend model credit. Use `eval/judge.py --dry-run` to estimate calls.
3. **Keep answers out:** evaluation answers must not appear in prompts or in `knowledge/`.

## Database

The service only creates and changes tables in its own `ai` schema. It must not change CMDB tables or data.
