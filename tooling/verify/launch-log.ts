/** What one run of the desktop host printed, read from its lines in `app.log` (AGENTS.md lists them). */
export type LaunchLog = {
  opened?: string;
  showed?: string;
  /** Another Weft already held the data folder, so this one exited. */
  alreadyOpen: boolean;
  /** "Weft could not start: …" and the like. */
  failure?: string;
  /** "Weft's window error: …" and warnings, in order. */
  windowMessages: string[];
};

export function readLaunchLog(text: string): LaunchLog {
  const log: LaunchLog = { alreadyOpen: false, windowMessages: [] };
  for (const line of text.split("\n")) {
    const opened = /^Weft opened (.+) \(SQLite [^)]+\)$/.exec(line);
    if (opened) log.opened = opened[1];
    const showed = /^Weft showed (.+)$/.exec(line);
    if (showed) log.showed = showed[1];
    if (/^Weft is already open on .+; showing its window\.$/.test(line)) {
      log.alreadyOpen = true;
    }
    if (/^Weft could not .+: /.test(line)) log.failure ??= line;
    if (/^Weft's window (warning|error|stopped)/.test(line)) {
      log.windowMessages.push(line);
    }
  }
  return log;
}
