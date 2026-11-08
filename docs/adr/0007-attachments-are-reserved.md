# Attachments are reserved, not built

**Status:** Accepted
**Date:** 2026-11-08

Health cases involve prescriptions, lab results and letters. Attachments are not built yet, but their shape is reserved now so that adding them never means versioning existing events (ADR 0002).

## Decision

**Files are stored by content hash.** A file lives on the device under its SHA-256 and syncs to Cloudflare R2, encrypted (ADR 0004). An Entry refers to a file by its hash. An "attachment added" event carries the hash, name, size and type, and is defined when attachments are built.

## Considered Options

- **No attachments**, text and links only. People would keep their documents somewhere else.
- **Files inside the database or the events.** The log and every sync would grow with every photo.
