/**
 * railway-no-raw-error-logging-near-db-connection (security)
 *
 * `console.error(err)` logs a raw error object in a file that
 * handles the Postgres connection. pg connection-failure errors can include
 * connection details (host, user, and in some driver versions the DSN string)
 * in their message/stack. Since `DATABASE_URL` carries the Postgres password,
 * an unfiltered `console.error(err)` risks writing the password into Railway's
 * logs (which may be exported to a third-party drain).
 *
 * Detection (AST):
 *   - file is a DB-connection context: references `process.env.DATABASE_URL`,
 *     uses `pg`, or creates a `new Pool(...)`, AND
 *   - calls `console.<method>(...)` with a bare error identifier (err/error/e)
 *     as an argument (the whole object), rather than `err.message`.
 *
 * Logging the raw error in a non-DB file is out of scope and not flagged.
 */
import {
  importSourceOf,
  isBareErrorIdentifier,
  isConsoleCall,
  isNewPoolExpression,
  isPgModule,
  requireSourceOf,
} from '../utils.js';

const rule = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Do not log raw error objects in a Railway Postgres connection context — the DSN/password can leak into logs',
      category: 'security',
      cwe: 'CWE-532',
      owasp: 'API8:2023 Security Misconfiguration',
      docsUrl: 'https://docs.railway.com/guides/logs',
      rationale:
        'pg connection-failure errors can carry connection details — and in some driver versions the full DSN — in their message and stack. DATABASE_URL contains the Postgres password, so console.error(err) on a pool failure can write that password into Railway deploy/build logs, which may be exported to a third-party log drain or read by anyone with project access. Log err.message (a redacted, intentional field) instead of the whole error.',
      recommended: true,
    },
    messages: {
      rawErrorLogged:
        'Logging a raw error object in a database-connection context can leak DATABASE_URL (with the Postgres password) into Railway logs. Log err.message instead.',
    },
    schema: [],
  },
  create(context: any) {
    let isDbContext = false;
    const rawLogCalls: any[] = [];

    return {
      ImportDeclaration(node: any) {
        if (isPgModule(importSourceOf(node))) isDbContext = true;
      },
      NewExpression(node: any) {
        if (isNewPoolExpression(node)) isDbContext = true;
      },
      MemberExpression(node: any) {
        // process.env.DATABASE_URL
        if (
          node.property?.type === 'Identifier' &&
          node.property.name === 'DATABASE_URL' &&
          node.object?.type === 'MemberExpression' &&
          node.object.property?.type === 'Identifier' &&
          node.object.property.name === 'env'
        ) {
          isDbContext = true;
        }
      },
      CallExpression(node: any) {
        if (isPgModule(requireSourceOf(node))) isDbContext = true;
        if (isConsoleCall(node)) {
          const hasBareError = (node.arguments ?? []).some((a: any) => isBareErrorIdentifier(a));
          if (hasBareError) rawLogCalls.push(node);
        }
      },
      'Program:exit'() {
        if (!isDbContext) return;
        for (const call of rawLogCalls) {
          context.report({ node: call, messageId: 'rawErrorLogged' });
        }
      },
    };
  },
};

export const railwayNoRawErrorLoggingNearDbConnectionRule = rule;
export default rule;
