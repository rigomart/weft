export type WeftErrorCode =
  /** The message does not have the shape the contract gives it. */
  | "invalid"
  /** The command names an Entry or a Thread that does not exist. */
  | "not found"
  /** The command would make an Entry or a Thread whose ID is already taken. */
  | "already exists";

export const weftErrorCodes: readonly WeftErrorCode[] = [
  "invalid",
  "not found",
  "already exists",
];

/** Why Weft refused a command or a read. Every implementation refuses with the same code and message. */
export class WeftError extends Error {
  constructor(
    readonly code: WeftErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "WeftError";
  }
}

/** A `WeftError` as plain data, to cross a process boundary. */
export interface WeftErrorMessage {
  readonly code: WeftErrorCode;
  readonly message: string;
}

export function toWeftErrorMessage(error: WeftError): WeftErrorMessage {
  return { code: error.code, message: error.message };
}
