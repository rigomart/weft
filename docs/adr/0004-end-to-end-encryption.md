# End-to-end encryption

**Status:** Accepted
**Date:** 2026-11-08

Entries hold health notes about the person and their family. Encryption is close to impossible to add once data sits unencrypted on a server, and the sync server never needs to read events (ADR 0003).

## Decision

**Synced data is encrypted on the device; our servers cannot read it.** Each person has one key. Each event's content is sealed with it before it leaves the device. The server stores the sealed content plus what it needs to pass events along: ID, sequence number and device.

- Cryptography uses the platform's WebCrypto API, behind a small seam (ADR 0005), because React Native does not provide WebCrypto.
- **The recovery code** is shown once when sync is turned on. A new device needs it to read the cloud copy. Losing it loses only the cloud copy; data on the person's devices is unaffected.
- Signing in and the encryption key are separate: an account reaches the sealed log, and the key reads it.
- A later feature that needs content, such as AI suggestions, runs on the device and sends content out only with the person's consent for that feature.

## Considered Options

- **The server can read the data** (Cloudflare's default encryption on disk). Simplest, and server-side features just work, but anyone with access to the infrastructure, or a breach, reads health notes.
- **`libsodium-wrappers`** instead of WebCrypto: 2 packages, 1.8 MB, for primitives the platform already has.

## Consequences

- Nothing smart can run on the server.
- The recovery code screens need care: they are the part a person can get wrong.
