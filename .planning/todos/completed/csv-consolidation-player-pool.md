---
slug: csv-consolidation-player-pool
created: 2026-07-03
source: user-request
phase_context: post-19
priority: low
resolves_phase: 29
status: complete
completed: 2026-08-21
resolution: >
  Verified during v1.7 Phase 41 discussion — packages/shared/src/data/ now contains
  a single player-pool.csv with no per-team CSVs remaining. Consolidation already done.
---

# Idea: Consolidate all CSV files into a single player-pool.csv

**Request:** Merge all 7 player CSV files (cosmos_players.csv, xolos_players.csv, city_players.csv, crew_players.csv, fa_players.csv, mls.csv, national.csv) into a single `player-pool.csv`.

**Motivation:** Simpler data model — one source of truth for all players instead of 7 separate files. The seed script currently handles multi-team CSVs (mls.csv, national.csv) by reading the `Team` column; a unified file would extend that pattern to all squads.

**Approach:** Add a `SourceTeam` column to the unified CSV (matching the `sourceTeamId` slug convention). The seed script's `toSlug()` normalizer and multi-team processing logic (already in place from Phase 19) would handle it with minimal changes. Legacy 4-team CSVs would need a `SourceTeam` column added.

**Best phase to pick up:** Phase 21 (New Teams) or Phase 24 (Auto-Assignment) — both touch the player data pipeline.
