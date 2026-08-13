# 063 - Meta-tool ranking, recall and pagination

## Ranking stages

1. exact qualified name;
2. exact short name when unique;
3. namespace + prefix;
4. token/BM25 lexical score;
5. optional semantic rerank over a bounded candidate set.

Exact matches always outrank semantic similarity.

## Default result count

Use at least 10, not 5. Similar tool families commonly push the correct result below five.

## Pagination

Every incomplete result must state:

```json
{ "hasMore": true, "nextCursor": "..." }
```

The model must not interpret an unmarked partial result as an exhaustive catalog.

## Evaluation

Create a 100+ tool corpus with:

- image/get/view/generate collisions;
- repeated `search` names across namespaces;
- abbreviations;
- Korean and English descriptions;
- exact qualified-name queries;
- semantic queries with no name overlap.

Measure recall@5, @10, @20 and wrong-namespace rate.
