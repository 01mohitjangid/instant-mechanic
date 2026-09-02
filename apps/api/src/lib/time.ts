/**
 * Timezone-aware day boundaries.
 *
 * The backend runs on AWS in UTC while the operations team works in India, so
 * "today" must mean today in the team's timezone. Doing this with the server's
 * local clock silently breaks the moment the code leaves a developer's laptop.
 */

/** Milliseconds to add to a UTC instant to get the wall-clock time in `timeZone`. */
function zoneOffsetMs(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(instant);

  const read = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find((part) => part.type === type)?.value ?? '0');

  const asUtc = Date.UTC(
    read('year'),
    read('month') - 1,
    read('day'),
    // Some ICU versions report midnight as hour 24 under hour12: false.
    read('hour') % 24,
    read('minute'),
    read('second')
  );

  return asUtc - instant.getTime();
}

/** Midnight of `instant`'s day, as seen in `timeZone`, returned as a real instant. */
export function startOfDayInZone(instant: Date, timeZone: string): Date {
  const offset = zoneOffsetMs(instant, timeZone);
  const wallClock = new Date(instant.getTime() + offset);
  wallClock.setUTCHours(0, 0, 0, 0);

  // Re-read the offset at the candidate midnight: a DST change can sit between
  // "now" and the start of the day. India has no DST, but other zones do.
  const candidate = new Date(wallClock.getTime() - offset);
  return new Date(wallClock.getTime() - zoneOffsetMs(candidate, timeZone));
}
