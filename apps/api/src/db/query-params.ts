/**
 * Collects bind values while a query is assembled.
 *
 * Every user-supplied value goes through `add()`, which returns the `$n`
 * placeholder to drop into the SQL. Nothing is ever interpolated into a query
 * string, so a filter value cannot become SQL. Column names and sort directions
 * never come from here at all — those are matched against a fixed allow-list.
 */
export class QueryParams {
  private readonly values: unknown[] = [];

  add(value: unknown): string {
    this.values.push(value);
    return `$${this.values.length}`;
  }

  get list(): unknown[] {
    return this.values;
  }
}
