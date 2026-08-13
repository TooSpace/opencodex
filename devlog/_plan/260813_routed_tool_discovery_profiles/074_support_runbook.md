# 074 - Support runbook

## Symptom: plugin tool missing

1. record client/OpenCodex versions;
2. inspect catalog row;
3. check resolved mode and source;
4. inspect `ALL_TOOLS`/local tools if Code Mode;
5. compare a fresh session;
6. apply exact model direct override as A/B—not as permanent global fix;
7. capture payload and call sequence.

## Symptom: model says it will run a tool, then stops

Inspect translation for lost tool declarations, especially Responses Lite `additional_tools`. Do not classify as streaming failure until tool presence is proven.

## Symptom: very large first request

Check whether direct mode or search false caused full schemas to enter `exec.description`. Report tool count/schema bytes.

## Symptom: session dies after resume

Search for durable references to transient or removed tools. Reconcile rather than clearing the entire session where possible.

## Escalation bundle

Use the capture list in `040_phase4_live_e2e.md`; redact secrets and prompt content.
