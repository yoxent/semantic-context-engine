export function buildPathFilterClause(
  pathFilter: string | undefined,
  columnExpr: string
): { sql: string; params: unknown[] } | undefined {
  if (!pathFilter) return undefined;
  if (/[*?]/.test(pathFilter)) {
    return { sql: `${columnExpr} GLOB ?`, params: [pathFilter] };
  }
  return {
    sql: `(${columnExpr} = ? OR ${columnExpr} LIKE ? ESCAPE '\\')`,
    params: [pathFilter, `${escapeLike(pathFilter)}/%`]
  };
}

export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}
