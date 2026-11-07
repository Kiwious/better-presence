// Time per project folder while its chat is the open one; pauses on another tab and goes on on return.
// shortcut: kept in memory, a companion restart starts every project at zero; save it to a file if that bothers anyone
export class ProjectClock {
  private totals = new Map<string, number>();
  private current: string | undefined;
  private since = 0;

  // Moment the open project's timer would have started without pauses, for Discord's elapsed time
  start(project: string | undefined, now: number) {
    if (project !== this.current) {
      if (this.current !== undefined) {
        this.totals.set(this.current, (this.totals.get(this.current) ?? 0) + now - this.since);
      }
      this.current = project;
      this.since = now;
    }
    return project === undefined ? undefined : this.since - (this.totals.get(project) ?? 0);
  }
}
