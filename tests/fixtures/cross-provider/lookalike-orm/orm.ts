// A look-alike query builder: same `.from(...).insert(...)` shape as
// supabase-js, zero relationship to it. Exports no provider client, so the
// CLI lists `orm` as a non-client binding wherever it is imported.
class QueryTable {
  insert(_row: Record<string, unknown>) {
    return Promise.resolve({ rowCount: 1 });
  }
}

class Orm {
  from(_table: string) {
    return new QueryTable();
  }
}

export const orm = new Orm();
