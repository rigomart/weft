import { makeId } from "@weft/contracts";

export type NewId = <Kind extends "event" | "entry" | "thread">(
  kind: Kind,
) => ReturnType<typeof makeId<Kind>>;

export const newId: NewId = () =>
  makeId(Date.now(), (length) =>
    crypto.getRandomValues(new Uint8Array(length)),
  );
