# Dates are instants or calendar days

**Status:** Accepted
**Date:** 2026-11-08

Vita OS stores a day without a time as local midnight (Vita OS ADR 0027). A day stored that way drifts when the person travels or the clocks change, and every reader has to know that midnight means "no time".

## Decision

Two kinds of value:

- **An instant**, stored in UTC, for things that happened: when an Entry was written, when a Follow-up date was completed, when a Thread was resolved.
- **A calendar day** (`2026-11-15`) with an optional local time of day (`09:30`), for Follow-up dates. Repeats count calendar days.

Vita OS's rule carries over: a time orders Entries within a day, and never moves one to another day.

## Considered Options

- **Everything as UTC timestamps**, with a day as local midnight (Vita OS). One type, but days drift.
- **A date-time with an IANA time zone on every value.** The most exact, but heavier than this app needs, and a Follow-up date's time zone is rarely meaningful.
