#!/usr/bin/env node
/**
 * Guards hand-written surface manifests against SDK drift.
 *
 * Coverage's `surface.methods` lists are hand-verified snapshots of a
 * provider's SDK. When the SDK adds, renames, or removes methods, calls to
 * them silently drop out of coverage — undercounting that looks identical to
 * "unused" in the telemetry. This script derives the real method surface from
 * the SDK's published type declarations and diffs it against the manifest.
 *
 * Usage:
 *   node scripts/check-sdk-surface.mjs
 *   node scripts/check-sdk-surface.mjs --local s2=/path/to/sdk/packages/streamstore
 *
 * Without --local, every target is packed from npm at @latest. With it, the
 * named provider is read from a local package directory instead, and — when
 * that directory sits in a git clone and the manifest carries
 * `surface.verified` — the script also reports every SDK *source* commit
 * landed since the verified revision.
 *
 * That second signal is the point. A method-name diff only ever catches added,
 * renamed, or removed symbols; the majority of SDK changes are logic changes
 * behind an unchanged signature (a retry policy, a cancellation path), which
 * are invisible to type declarations but can still break integration code.
 * Reading those commits is a human job — the script surfaces them, it never
 * infers a rule or a compatibility entry from them.
 *
 * Exits 1 on method-surface drift. Source drift is reported, never fatal: a
 * patch bump with no client-visible change is normal and must not break CI.
 * Network-dependent by design — run it before releases or on a schedule
 * (alongside check:links), not inside the unit-test suite.
 */
import { execFileSync, execSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(import.meta.url), '..', '..');

/**
 * One entry per provider with a surface manifest.
 *   pkg        npm package whose types define the surface
 *   rootClass  client class whose readonly resource properties are walked
 *   dts        candidate type-declaration paths inside the package
 *   manifest   manifest file holding surface.methods
 */
/**
 * Node spec for the supabase composite deriver. One node per client-rooted
 * namespace; `classes` lists the class plus the explicit ancestors whose
 * members are surface (BaseApiClient is deliberately absent everywhere: its
 * public throwOnError()/setHeader() are builder-stage config helpers, not API
 * calls). `links` lists the resource-link props expected on the node — the
 * parser fails on any unlisted prop whose type name ends in Client or Api.
 */
const SUPABASE_NODES = [
  { prefix: '', pkg: '@supabase/supabase-js', file: 'dist/index.d.mts', classes: ['SupabaseClient'], indent: 2, links: ['auth', 'realtime', 'storage', 'functions'] },
  { prefix: 'auth', pkg: '@supabase/auth-js', file: 'dist/module/GoTrueClient.d.ts', classes: ['GoTrueClient'], indent: 4, links: ['admin', 'mfa', 'oauth', 'passkey'] },
  { prefix: 'auth.admin', pkg: '@supabase/auth-js', file: 'dist/module/GoTrueAdminApi.d.ts', classes: ['GoTrueAdminApi'], indent: 4, links: ['mfa', 'oauth', 'customProviders', 'passkey'] },
  { prefix: 'auth.mfa', pkg: '@supabase/auth-js', file: 'dist/module/lib/types.d.ts', classes: ['GoTrueMFAApi'], indent: 4, links: ['webauthn'] },
  { prefix: 'auth.mfa.webauthn', pkg: '@supabase/auth-js', file: 'dist/module/lib/webauthn.d.ts', classes: ['WebAuthnApi'], indent: 4, links: [] },
  { prefix: 'auth.oauth', pkg: '@supabase/auth-js', file: 'dist/module/lib/types.d.ts', classes: ['AuthOAuthServerApi'], indent: 4, links: [] },
  { prefix: 'auth.passkey', pkg: '@supabase/auth-js', file: 'dist/module/lib/types.d.ts', classes: ['AuthPasskeyApi'], indent: 4, links: [] },
  { prefix: 'auth.admin.mfa', pkg: '@supabase/auth-js', file: 'dist/module/lib/types.d.ts', classes: ['GoTrueAdminMFAApi'], indent: 4, links: [] },
  { prefix: 'auth.admin.oauth', pkg: '@supabase/auth-js', file: 'dist/module/lib/types.d.ts', classes: ['GoTrueAdminOAuthApi'], indent: 4, links: [] },
  { prefix: 'auth.admin.customProviders', pkg: '@supabase/auth-js', file: 'dist/module/lib/types.d.ts', classes: ['GoTrueAdminCustomProvidersApi'], indent: 4, links: [] },
  { prefix: 'auth.admin.passkey', pkg: '@supabase/auth-js', file: 'dist/module/lib/types.d.ts', classes: ['GoTrueAdminPasskeyApi'], indent: 4, links: [] },
  { prefix: 'functions', pkg: '@supabase/functions-js', file: 'dist/module/FunctionsClient.d.ts', classes: ['FunctionsClient'], indent: 4, links: [] },
  { prefix: 'realtime', pkg: '@supabase/realtime-js', file: 'dist/module/RealtimeClient.d.ts', classes: ['RealtimeClient'], indent: 4, links: [] },
  { prefix: 'storage', pkg: '@supabase/storage-js', file: 'dist/index.d.mts', classes: ['StorageClient', 'StorageBucketApi'], indent: 2, links: ['vectors', 'analytics'] },
  { prefix: 'storage.vectors', pkg: '@supabase/storage-js', file: 'dist/index.d.mts', classes: ['StorageVectorsClient', 'VectorBucketApi'], indent: 2, links: [] },
  { prefix: 'storage.analytics', pkg: '@supabase/storage-js', file: 'dist/index.d.mts', classes: ['StorageAnalyticsClient'], indent: 2, links: [] },
];

const TARGETS = [
  {
    // supabase-js is a fluent-builder SDK whose sub-client types live in four
    // lockstep-pinned dependency packages (auth-js, storage-js, functions-js,
    // realtime-js) — none of the single-package derivers can read it. The
    // composite deriver packs the sub-packages at the exact versions pinned in
    // supabase-js's package.json and walks an explicit node spec (one node per
    // client-rooted namespace). The surface is deliberately truncated at
    // builder boundaries: methods reached through an intermediate call
    // (from().select(), storage.from().upload(), channel().on()) are not
    // attributable by the coverage collector and are not derived. Each node
    // declares its resource-link props; an unlisted prop whose type ends in
    // Client/Api fails the run — that is the drift signal for a new namespace.
    provider: 'supabase',
    pkg: '@supabase/supabase-js',
    composite: SUPABASE_NODES,
    manifest: 'src/providers/supabase/manifest.ts',
  },
  {
    // The firebase umbrella package's type entries are pure re-exports of the
    // @firebase/<product> packages, so the deriver packs each in-scope product
    // at the exact version pinned by the firebase release and extracts the
    // instance methods of the configured service interfaces. Modular free
    // functions (collection(db, ...), signInWithEmailAndPassword(auth, ...))
    // have no client root and are structurally outside coverage — see the
    // scope note in the manifest.
    provider: 'firebase',
    pkg: 'firebase',
    firebaseProducts: [
      { dep: '@firebase/app', instances: [{ name: 'FirebaseApp', prefix: '' }] },
      { dep: '@firebase/auth', instances: [{ name: 'Auth', prefix: '' }, { name: 'User', prefix: 'currentUser' }] },
      { dep: '@firebase/database', instances: [{ name: 'Database', prefix: '' }] },
      { dep: '@firebase/firestore', instances: [{ name: 'Firestore', prefix: '' }] },
      { dep: '@firebase/functions', instances: [{ name: 'Functions', prefix: '' }] },
      { dep: '@firebase/storage', instances: [{ name: 'FirebaseStorage', prefix: '' }] },
    ],
    manifest: 'src/providers/firebase/manifest.ts',
  },
  {
    // twilio-node's OpenAPI-generator layout: one root `declare class Twilio`
    // (lib/rest/Twilio.d.ts) whose getters link domain classes (class-based,
    // `X extends XBase` with the version getters on the Base class) and
    // callable ListInstance interfaces (call signature `(sid): Context`).
    // Scope: the api.v2010 shortcut accessors on the root client plus the
    // taskrouter domain — see the scope note in the manifest.
    //   followBaseExtends: merge `class Taskrouter extends TaskrouterBase`
    //     members (the `v1` getter lives on the Base class);
    //   emitCallablePaths: a callable ListInstance link also emits its own
    //     path ('messages', 'taskrouter.v1.workspaces') because
    //     `client.messages('SM…')` is itself a client call the collector
    //     records — everything past the sid call is unattributable;
    //   dropMethods: toJSON is a serialization helper, not API surface.
    provider: 'twilio',
    pkg: 'twilio',
    rootClasses: [
      {
        name: 'Twilio',
        entry: 'lib/rest/Twilio.d.ts',
        followBaseExtends: true,
        emitCallablePaths: true,
        dropMethods: ['toJSON'],
        roots: [
          'addresses', 'applications', 'authorizedConnectApps',
          'availablePhoneNumbers', 'balance', 'calls', 'conferences',
          'connectApps', 'incomingPhoneNumbers', 'keys', 'messages',
          'newKeys', 'newSigningKeys', 'notifications', 'outgoingCallerIds',
          'queues', 'recordings', 'shortCodes', 'signingKeys', 'sip',
          'taskrouter', 'tokens', 'transcriptions', 'usage',
          'validationRequests',
        ],
      },
    ],
    manifest: 'src/providers/twilio/manifest.ts',
  },
  {
    provider: 'resend',
    pkg: 'resend',
    rootClass: 'Resend',
    dts: ['dist/index.d.mts', 'dist/index.d.ts', 'dist/index.d.cts'],
    manifest: 'src/providers/resend/manifest.ts',
  },
  {
    // Fern codegen: `export declare class` per resource file, resources
    // linked via `get x(): XClient` getters, resolved through relative
    // imports — handled by the linked deriver via `rootClasses`.
    provider: 'agentmail',
    pkg: 'agentmail',
    rootClasses: [
      // Fern base class with the resource getters; the exported wrapper in
      // dist/cjs/wrapper/Client.d.ts extends it without adding resources.
      // Root-level methods (the fetch() passthrough) are excluded transport.
      { name: 'AgentMailClient', entry: 'dist/cjs/Client.d.ts' },
    ],
    manifest: 'src/providers/agentmail/manifest.ts',
  },
  {
    // auth0@6 (node-auth0) is Fern-generated with three root clients.
    provider: 'auth0',
    pkg: 'auth0',
    rootClasses: [
      { name: 'ManagementClient', entry: 'dist/cjs/management/Client.d.ts' },
      { name: 'AuthenticationClient', entry: 'dist/cjs/auth/index.d.ts' },
      // getUserInfo lives directly on the root client and is real surface.
      { name: 'UserInfoClient', entry: 'dist/cjs/userinfo/index.d.ts', includeRootMethods: true },
    ],
    manifest: 'src/providers/auth0/manifest.ts',
  },
  {
    // Speakeasy layout: resources are `readonly basins: S2Basins` props —
    // linkReadonlyProps opts into following them (default policy skips
    // readonly links). includeRootMethods keeps `basin`, S2's only public
    // root accessor. Data-plane scoped clients (basin(...).stream(...)) are
    // not client-rooted and stay out of the surface — see the manifest.
    provider: 's2',
    pkg: '@s2-dev/streamstore',
    rootClasses: [{ name: 'S2', entry: 'dist/esm/s2.d.ts', includeRootMethods: true }],
    linkReadonlyProps: true,
    manifest: 'src/providers/s2/manifest.ts',
  },
  {
    // Stainless layout (same family as browserbase): root `OpenAI` class in
    // client.d.ts (index.d.ts only re-exports), resources wired via
    // `import * as API` namespace aliases and per-file re-exports.
    provider: 'openai',
    pkg: 'openai',
    rootClass: 'OpenAI',
    dts: ['client.d.ts'],
    multiFile: true,
    manifest: 'src/providers/openai/manifest.ts',
  },
  {
    // Stainless layout: resources/**/*.d.ts wired via `import * as` namespace
    // aliases and re-exports; class names collide across files (two different
    // `Downloads` classes) so resolution is per-file — handled by the
    // multi-file deriver.
    provider: 'browserbase',
    pkg: '@browserbasehq/sdk',
    rootClass: 'Browserbase',
    dts: ['index.d.ts'],
    multiFile: true,
    manifest: 'src/providers/browserbase/manifest.ts',
  },
  {
    // Fern codegen (extension-less relative imports). Derives from the Fern
    // base class at the package root so the wrapper's realtime/attach helpers
    // stay out of the derived set. `roots` limits the walk to the ElevenAPI
    // section — see the scope note in the manifest.
    provider: 'elevenlabs',
    pkg: '@elevenlabs/elevenlabs-js',
    rootClasses: [
      {
        name: 'ElevenLabsClient',
        entry: 'Client.d.ts',
        roots: [
          'audioIsolation', 'audioNative', 'dubbing', 'forcedAlignment', 'music',
          'pronunciationDictionaries', 'samples', 'speechEngine', 'speechToSpeech',
          'speechToText', 'textToDialogue', 'textToSoundEffects', 'textToSpeech',
          'textToVoice', 'voices',
        ],
      },
    ],
    manifest: 'src/providers/elevenlabs/manifest.ts',
  },
];

/**
 * Parses one `class`/`interface` declaration out of a .d.ts file and returns
 * its public callable members and resource-link props. Tolerant line parser:
 * tracks brace depth from the declaration line (multi-line generic heritage
 * clauses, e.g. SupabaseClient's, stay balanced), takes members only at the
 * class's own indent, and skips comment/protected/private/static/_-prefixed
 * lines. `name: typeof X.prototype._y` function-typed props (WebAuthnApi)
 * count as methods; getters and `name: Type` props count as link candidates.
 */
function parseCompositeClass(text, className, indent) {
  const declRe = new RegExp(`^(?:export )?(?:default )?(?:declare )?(?:abstract )?(?:class|interface) ${className}\\b`);
  const lines = text.split('\n');
  const start = lines.findIndex((l) => declRe.test(l));
  if (start === -1) throw new Error(`class ${className} not found`);
  const methods = new Set();
  const links = new Map(); // prop -> type name
  const pad = ' '.repeat(indent);
  let depth = 0;
  let opened = false;
  for (let i = start; i < lines.length; i++) {
    const raw = lines[i];
    const trimmed = raw.trim();
    if (trimmed.startsWith('*') || trimmed.startsWith('/*') || trimmed.startsWith('//')) continue;
    const before = depth;
    depth += (raw.match(/\{/g) ?? []).length - (raw.match(/\}/g) ?? []).length;
    if (depth > 0) opened = true;
    if (opened && depth <= 0) break; // class body closed
    if (i === start) continue;
    if (before !== 1) continue; // not at class-body level
    if (!raw.startsWith(pad) || raw[indent] === ' ') continue; // continuation line
    const body = raw.slice(indent);
    if (/^(protected |private |static |readonly \[|constructor\b|_|\[|\}|\))/.test(body)) continue;
    let m = body.match(/^get ([\w$]+)\(\): ([\w$]+)/);
    if (m) {
      links.set(m[1], m[2]);
      continue;
    }
    m = body.match(/^(?:readonly )?([\w$]+): typeof /); // function-typed alias prop
    if (m) {
      methods.add(m[1]);
      continue;
    }
    m = body.match(/^([\w$]+)\??\s*[<(]/); // method or overload signature
    if (m) {
      methods.add(m[1]);
      continue;
    }
    m = body.match(/^(?:readonly )?([\w$]+)\??: ([\w$]+)(?:<[^;]*>)?;\s*$/); // typed prop
    if (m) {
      links.set(m[1], m[2]);
    }
  }
  return { methods, links };
}

/**
 * Derives the supabase surface across the root package and its lockstep
 * sub-client packages. `pkgDir` is the extracted root package; sub-packages
 * are packed at the exact versions pinned in its package.json into `tmp`.
 */
function deriveCompositeSurface(pkgDir, tmp, nodes) {
  const deps = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8')).dependencies ?? {};
  const dirs = new Map([['@supabase/supabase-js', pkgDir]]);
  for (const pkg of new Set(nodes.map((n) => n.pkg))) {
    if (dirs.has(pkg)) continue;
    const version = deps[pkg];
    if (!version) throw new Error(`${pkg} is not a dependency of the root package`);
    const sub = join(tmp, pkg.replace(/[^\w.-]+/g, '_'));
    mkdirSync(sub, { recursive: true });
    execSync(`npm pack ${pkg}@${version} --pack-destination "${sub}"`, {
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 64 * 1024 * 1024,
    });
    const tarball = readdirSync(sub).find((f) => f.endsWith('.tgz'));
    if (!tarball) throw new Error(`npm pack produced no tarball for ${pkg}`);
    execSync(`tar xzf "${tarball}"`, { cwd: sub });
    dirs.set(pkg, join(sub, 'package'));
  }

  const out = new Set();
  for (const node of nodes) {
    const text = readFileSync(join(dirs.get(node.pkg), node.file), 'utf8');
    const links = new Map();
    for (const cls of node.classes) {
      const parsed = parseCompositeClass(text, cls, node.indent);
      for (const m of parsed.methods) out.add(node.prefix === '' ? m : `${node.prefix}.${m}`);
      for (const [prop, type] of parsed.links) links.set(prop, type);
    }
    // A resource-link prop we don't have a node for means the SDK grew a new
    // client-rooted namespace — fail so the spec and manifest get extended.
    for (const [prop, type] of links) {
      if (/(Client|Api)$/.test(type) && !node.links.includes(prop)) {
        throw new Error(`${node.prefix || '<root>'}: unexpected resource link ${prop}: ${type} — new namespace? extend SUPABASE_NODES and the manifest`);
      }
    }
    for (const prop of node.links) {
      if (!links.has(prop)) {
        throw new Error(`${node.prefix || '<root>'}: expected resource link ${prop} not found — SDK layout changed`);
      }
    }
  }
  return out;
}

/**
 * Extracts method names declared on one `export declare class|interface <name>`
 * block of an api-extractor rolled-up .d.ts. Brace depth is tracked so members
 * of nested object types never match; accessors (`get x(): T`) and plain
 * properties are skipped; single-identifier `extends` parents in the same file
 * are followed (e.g. `User extends UserInfo`).
 */
function instanceMethods(dtsText, name, seen = new Set()) {
  if (seen.has(name)) return new Set();
  seen.add(name);
  const decl = new RegExp(
    `^export declare (?:abstract )?(?:class|interface) ${name}\\b([^\\n{]*)\\{`,
    'm',
  ).exec(dtsText);
  if (!decl) throw new Error(`declaration ${name} not found`);
  const methods = new Set();
  const parent = decl[1].match(/\bextends\s+([\w$]+)/);
  if (parent) {
    for (const m of instanceMethods(dtsText, parent[1], seen)) methods.add(m);
  }
  let depth = 1;
  let i = decl.index + decl[0].length;
  let lineStart = i;
  let lineDepth = depth;
  while (i < dtsText.length && depth > 0) {
    const c = dtsText[i];
    if (c === '{') depth += 1;
    else if (c === '}') depth -= 1;
    else if (c === '\n') {
      if (lineDepth === 1) {
        const body = dtsText
          .slice(lineStart, i)
          .replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '')
          .trim();
        const m = body.match(/^(?:readonly )?([\w$]+)\??\s*[<(]/);
        if (m && m[1] !== 'constructor' && !body.startsWith('get ') && !body.startsWith('set ')) {
          methods.add(m[1]);
        }
      }
      lineStart = i + 1;
      lineDepth = depth;
    }
    i += 1;
  }
  return methods;
}

/**
 * Derives the firebase modular client surface: packs each in-scope
 * @firebase/<product> at the exact version pinned by the already-unpacked
 * `firebase` package and collects the instance methods of the configured
 * service interfaces, prefixed for non-root instances (User -> currentUser.*).
 */
function deriveFirebaseModularSurface(pkgDir, products) {
  const deps = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8')).dependencies;
  const out = new Set();
  for (const { dep, instances } of products) {
    const version = deps[dep];
    if (!version) throw new Error(`${dep} is not a dependency of the packed firebase release`);
    const tmp = mkdtempSync(join(tmpdir(), 'api-doctor-surface-fb-'));
    try {
      execSync(`npm pack ${dep}@${version} --pack-destination "${tmp}"`, {
        stdio: ['ignore', 'pipe', 'pipe'],
        maxBuffer: 64 * 1024 * 1024,
      });
      const tarball = readdirSync(tmp).find((f) => f.endsWith('.tgz'));
      if (!tarball) throw new Error(`npm pack produced no tarball for ${dep}`);
      execSync(`tar xzf "${tarball}"`, { cwd: tmp });
      const subDir = join(tmp, 'package');
      const subPkg = JSON.parse(readFileSync(join(subDir, 'package.json'), 'utf8'));
      const typesRel = subPkg.types ?? subPkg.typings;
      if (!typesRel) throw new Error(`${dep}@${version} declares no types entry`);
      const dtsText = readFileSync(join(subDir, typesRel), 'utf8');
      for (const { name, prefix } of instances) {
        for (const m of instanceMethods(dtsText, name)) {
          out.add(prefix === '' ? m : `${prefix}.${m}`);
        }
      }
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }
  return out;
}

/**
 * Multi-file deriver for SDKs whose declarations span many .d.ts files
 * (Fern codegen and similar): parses top-level `class`/`interface` blocks,
 * links resources via `get x(): XClient` getters and public class-typed
 * properties, and resolves type names through relative `import` statements
 * (with or without `.js` suffixes).
 *
 * Deliberate exclusions, mirroring the manifest policy:
 *   - root-level methods unless `includeRootMethods` (transport escape
 *     hatches like ManagementClient.fetch must stay unknown_sdk_calls);
 *   - `readonly` class-typed properties (auth0's only public one is OAuth's
 *     internal idTokenValidator helper, which is not documented surface);
 *   - `protected`/`private`/`static` members and `_`-prefixed backing fields.
 */
function parseLinkedDts(absPath, cache, opts) {
  if (cache.has(absPath)) return cache.get(absPath);
  const text = readFileSync(absPath, 'utf8');
  const decls = new Map(); // name -> { methods: Set, links: Map(prop -> typeName) }
  const imports = new Map(); // local type name -> absolute .d.ts path
  let current = null;
  let memberIndent = null;

  for (const line of text.split('\n')) {
    const imp = line.match(/^import (?:type )?\{([^}]+)\} from "([^"]+)";?/);
    if (imp) {
      // Fern emits both `./x.js` and extension-less `./x` sources.
      const source = imp[2].replace(/\.js$/, '');
      const target = join(dirname(absPath), `${source}.d.ts`);
      for (const piece of imp[1].split(',')) {
        const m = piece.trim().match(/^(?:type )?([\w$]+)(?:\s+as\s+([\w$]+))?$/);
        if (m) imports.set(m[2] ?? m[1], target);
      }
      continue;
    }
    // Default imports (`import Taskrouter from "./Taskrouter"`) — twilio-node
    // links its domain classes this way; the local name matches the class name.
    const impDefault = line.match(/^import (?:type )?([\w$]+) from "([^"]+)";?/);
    if (impDefault) {
      const source = impDefault[2].replace(/\.js$/, '');
      imports.set(impDefault[1], join(dirname(absPath), `${source}.d.ts`));
      continue;
    }
    const decl = line.match(
      /^(?:export )?(?:default )?(?:declare )?(?:abstract )?(?:class|interface) ([\w$]+)(?:<[^>]*>)?(?:\s+extends\s+([\w$]+))?/,
    );
    if (decl) {
      current = { methods: new Set(), links: new Map(), parent: decl[2] ?? null, callable: false };
      decls.set(decl[1], current);
      memberIndent = null;
      continue;
    }
    if (/^\}/.test(line)) {
      current = null;
      continue;
    }
    if (!current) continue;
    const indent = line.match(/^(\s*)/)[1].length;
    if (indent === 0 || line.trim() === '') continue;
    if (memberIndent === null) memberIndent = indent;
    if (indent !== memberIndent) continue; // continuation of a multi-line signature
    let body = line.slice(indent);
    if (/^(protected|private|static|constructor\b|readonly _|_)/.test(body)) continue;
    // Some SDKs (s2) expose resources as `readonly x: XClient` props — the
    // default policy skips readonly links (auth0's internal helpers); a
    // target opts in per-provider.
    if (opts?.linkReadonlyProps) body = body.replace(/^readonly /, '');
    // Interface call signature (`(sid: string): MessageContext;`) — marks a
    // callable resource context accessor (twilio ListInstances).
    if (/^\(/.test(body)) {
      current.callable = true;
      continue;
    }
    let m = body.match(/^get ([\w$]+)\(\): ([\w$]+)/);
    if (m) {
      current.links.set(m[1], m[2]);
      continue;
    }
    m = body.match(/^([\w$]+)\??: \(/); // function-typed property (interface style)
    if (m) {
      current.methods.add(m[1]);
      continue;
    }
    m = body.match(/^([\w$]+)\??: ([\w$]+)(<[^;]*>)?;$/); // class-typed property link
    if (m) {
      current.links.set(m[1], m[2]);
      continue;
    }
    m = body.match(/^([\w$]+)\s*[<(]/);
    if (m && m[1] !== 'constructor') current.methods.add(m[1]);
  }
  const parsed = { decls, imports };
  cache.set(absPath, parsed);
  return parsed;
}

function resolveLinkedDecl(name, file, cache, opts) {
  let parsed;
  try {
    parsed = parseLinkedDts(file, cache, opts);
  } catch {
    return null;
  }
  if (parsed.decls.has(name)) return { decl: parsed.decls.get(name), file };
  const target = parsed.imports.get(name);
  return target ? resolveLinkedDecl(name, target, cache, opts) : null;
}

function deriveLinkedSurface(pkgDir, rootClasses, opts) {
  const cache = new Map();
  const out = new Set();
  const visit = (name, file, prefix, depth, root, seen) => {
    if (depth > 5) return;
    const found = resolveLinkedDecl(name, file, cache, opts);
    if (!found) {
      if (prefix === '') throw new Error(`root class ${name} not found in ${file}`);
      return;
    }
    const key = `${found.file}#${name}#${prefix}`;
    if (seen.has(key)) return;
    seen.add(key);
    if (prefix !== '' || root.includeRootMethods) {
      for (const m of found.decl.methods) {
        if (root.dropMethods?.includes(m)) continue;
        out.add(prefix === '' ? m : `${prefix}.${m}`);
      }
      // A callable resource accessor (`client.messages('SM…')`) is itself a
      // client call — emit the accessor's own path as surface.
      if (prefix !== '' && root.emitCallablePaths && found.decl.callable) out.add(prefix);
    }
    for (const [prop, typeName] of found.decl.links) {
      if (prefix === '' && root.roots && !root.roots.includes(prop)) continue; // out-of-scope root resource
      if (!resolveLinkedDecl(typeName, found.file, cache, opts)) continue; // data field, not a resource
      visit(typeName, found.file, prefix === '' ? prop : `${prefix}.${prop}`, depth + 1, root, seen);
    }
    // twilio-node splits domain classes as `class X extends XBase` with the
    // version getters on the Base class — merge the parent's members at the
    // same prefix. Only `*Base` parents are followed: transport base classes
    // (Client, Domain, Version) must stay out of the surface.
    if (root.followBaseExtends && found.decl.parent && /Base$/.test(found.decl.parent)) {
      visit(found.decl.parent, found.file, prefix, depth, root, seen);
    }
  };
  for (const root of rootClasses) {
    visit(root.name, join(pkgDir, root.entry), '', 0, root, new Set());
  }
  return out;
}

/** Resolves `.`/`..` segments in a posix-style relative path. */
function normalizePath(p) {
  const parts = [];
  for (const seg of p.split('/')) {
    if (seg === '' || seg === '.') continue;
    if (seg === '..') parts.pop();
    else parts.push(seg);
  }
  return parts.join('/');
}

/**
 * Derives the surface from a multi-file declaration layout (Stainless SDKs):
 * classes are declared per resource file and wired together through
 * `import * as X from './y.js'` namespace aliases and named re-exports.
 * Class names are resolved per file through its own import map, so name
 * collisions across files (two `Downloads` classes) resolve correctly.
 * Root class methods (transport) are excluded — only resource props walk.
 */
function deriveSurfaceMultiFile(pkgDir, entryDts, rootName) {
  const cache = new Map();
  const load = (rel) => {
    if (cache.has(rel)) return cache.get(rel);
    const text = readFileSync(join(pkgDir, rel), 'utf8');
    const dir = rel.split('/').slice(0, -1).join('/');
    const toRel = (src) => normalizePath(`${dir}/${src.replace(/\.js$/, '.d.ts')}`);
    const parsed = {
      classes: new Map(), // name -> { methods:Set, props:[{prop, ns, cls}] }
      nsImports: new Map(), // alias -> file
      reexports: new Map(), // exported class name -> file
      starExports: [], // files
    };
    let current = null;
    for (const line of text.split('\n')) {
      let m;
      if ((m = line.match(/^import \* as ([\w$]+) from "(\.[^"]+)";?/))) {
        parsed.nsImports.set(m[1], toRel(m[2]));
        continue;
      }
      if ((m = line.match(/^export \{([^}]*)\} from "(\.[^"]+)";?/))) {
        const target = toRel(m[2]);
        for (const raw of m[1].split(',')) {
          const clean = raw.trim();
          if (!clean || clean.startsWith('type ')) continue;
          const name = clean.split(/\s+as\s+/)[0].trim();
          if (name) parsed.reexports.set(name, target);
        }
        continue;
      }
      if ((m = line.match(/^export \* from "(\.[^"]+)";?/))) {
        parsed.starExports.push(toRel(m[1]));
        continue;
      }
      if ((m = line.match(/^(?:export )?declare class ([\w$]+)/))) {
        current = { methods: new Set(), props: [] };
        parsed.classes.set(m[1], current);
        continue;
      }
      if (!current) continue;
      if (/^\}/.test(line)) {
        current = null;
        continue;
      }
      if ((m = line.match(/^\s+(?:readonly )?([\w$]+): (?:([\w$]+)\.)?([A-Z][\w$]*);\s*$/))) {
        current.props.push({ prop: m[1], ns: m[2] ?? null, cls: m[3] });
        continue;
      }
      if ((m = line.match(/^\s+([\w$]+)\s*[<(]/)) && m[1] !== 'constructor') {
        current.methods.add(m[1]);
      }
    }
    cache.set(rel, parsed);
    return parsed;
  };

  /** Finds class `clsName` starting from `fromRel`, following the ns alias and re-exports. */
  const resolveClass = (fromRel, ns, clsName, hops = 0) => {
    if (hops > 5) return null;
    const f = load(fromRel);
    if (ns !== null) {
      const target = f.nsImports.get(ns);
      return target ? resolveClass(target, null, clsName, hops + 1) : null;
    }
    if (f.classes.has(clsName)) return { rel: fromRel, cls: f.classes.get(clsName) };
    if (f.reexports.has(clsName)) return resolveClass(f.reexports.get(clsName), null, clsName, hops + 1);
    for (const star of f.starExports) {
      const hit = resolveClass(star, null, clsName, hops + 1);
      if (hit) return hit;
    }
    return null;
  };

  const out = new Set();
  const entry = load(entryDts);
  const root = entry.classes.get(rootName);
  if (!root) throw new Error(`root class ${rootName} not found in ${entryDts}`);
  const visit = (rel, cls, prefix, depth) => {
    if (depth > 5) return;
    for (const m of cls.methods) out.add(`${prefix}.${m}`);
    for (const { prop, ns, cls: clsName } of cls.props) {
      const hit = resolveClass(rel, ns, clsName);
      if (hit) visit(hit.rel, hit.cls, `${prefix}.${prop}`, depth + 1);
    }
  };
  for (const { prop, ns, cls: clsName } of root.props) {
    const hit = resolveClass(entryDts, ns, clsName);
    if (hit) visit(hit.rel, hit.cls, prop, 1);
  }
  return out;
}

/** Parses `declare class X { ... }` blocks: methods + readonly resource props. */
function parseClasses(dtsText) {
  const classes = new Map();
  let current = null;
  for (const line of dtsText.split('\n')) {
    const decl = line.match(/^declare class ([\w$]+)/);
    if (decl) {
      current = { methods: new Set(), props: new Map() };
      classes.set(decl[1], current);
      continue;
    }
    if (!current) continue;
    if (/^\}/.test(line)) {
      current = null;
      continue;
    }
    const prop = line.match(/^\s*readonly ([\w$]+): ([\w$]+);/);
    if (prop) {
      current.props.set(prop[1], prop[2]);
      continue;
    }
    const method = line.match(/^\s{2}([\w$]+)\s*[<(]/);
    if (method && method[1] !== 'constructor') current.methods.add(method[1]);
  }
  return classes;
}

/**
 * Walks resource properties from the root client class and returns the full
 * set of dotted method paths. The root class's own methods (low-level
 * post/get/fetchRequest transport) are excluded — only resources count.
 */
function deriveSurface(classes, rootName) {
  const out = new Set();
  const root = classes.get(rootName);
  if (!root) throw new Error(`root class ${rootName} not found in type declarations`);
  const visit = (cls, prefix, depth) => {
    if (depth > 5) return;
    for (const m of cls.methods) out.add(`${prefix}.${m}`);
    for (const [prop, clsName] of cls.props) {
      const child = classes.get(clsName);
      if (child) visit(child, `${prefix}.${prop}`, depth + 1);
    }
  };
  for (const [prop, clsName] of root.props) {
    const child = classes.get(clsName);
    if (child) visit(child, prop, 1);
  }
  return out;
}

/** Extracts surface.methods entries from a manifest file's source text. */
function manifestMethods(manifestPath) {
  const text = readFileSync(manifestPath, 'utf8');
  const block = text.match(/surface:\s*\{[\s\S]*?methods:\s*\[([\s\S]*?)\]/);
  if (!block) throw new Error(`no surface.methods block found in ${manifestPath}`);
  return new Set([...block[1].matchAll(/'([^']+)'/g)].map((m) => m[1]));
}

/**
 * Extracts the `surface.verified` block from a manifest's source text, or null
 * when the provider has not been source-verified yet. Read from source rather
 * than by importing the module, matching manifestMethods — this script must
 * stay runnable against an unbuilt tree.
 */
function manifestVerified(manifestPath) {
  const text = readFileSync(manifestPath, 'utf8');
  const block = text.match(/surface:\s*\{[\s\S]*?verified:\s*\{([\s\S]*?)\}/);
  if (!block) return null;
  const field = (name) => block[1].match(new RegExp(`${name}:\\s*'([^']*)'`))?.[1] ?? null;
  const verified = {
    version: field('version'),
    commit: field('commit'),
    at: field('at'),
    sourceDir: field('sourceDir'),
  };
  return verified.version && verified.commit ? verified : null;
}

/** Parses `--local <provider>=<path>` / `--local=<provider>=<path>` off argv. */
function parseLocalOverrides(argv) {
  const overrides = new Map();
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    let pair = null;
    if (arg === '--local') pair = argv[++i];
    else if (arg.startsWith('--local=')) pair = arg.slice('--local='.length);
    else continue;
    if (!pair) throw new Error('--local expects <provider>=<path>');
    const eq = pair.indexOf('=');
    if (eq === -1) throw new Error(`--local expects <provider>=<path>, got "${pair}"`);
    const provider = pair.slice(0, eq);
    const path = pair.slice(eq + 1);
    if (!provider || !path) throw new Error(`--local expects <provider>=<path>, got "${pair}"`);
    overrides.set(provider, isAbsolute(path) ? path : resolve(process.cwd(), path));
  }
  return overrides;
}

/** Runs git in `cwd` and returns trimmed stdout; returns null on any failure. */
function git(cwd, args) {
  try {
    return execFileSync('git', args, {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 64 * 1024 * 1024,
    }).trim();
  } catch {
    return null;
  }
}

/**
 * Fast-forwards the SDK checkout so everything downstream — the version read
 * from package.json, the derived method surface, the source diff — describes
 * one consistent revision. Must run before any of them.
 *
 * Never pulls a dirty tree: a local experiment in the SDK clone is not ours to
 * touch, and the comparison against current HEAD is still worth doing.
 */
function pullLocalCheckout(provider, localPath) {
  const gitRoot = git(localPath, ['rev-parse', '--show-toplevel']);
  if (!gitRoot) return;

  const dirty = git(gitRoot, ['status', '--porcelain']);
  if (dirty === null) {
    console.log(`  ${provider}: could not read git status — skipping pull`);
  } else if (dirty !== '') {
    console.log(`  ${provider}: SDK checkout has uncommitted changes — skipping pull, using current HEAD`);
  } else if (git(gitRoot, ['pull', '--ff-only']) === null) {
    console.log(`  ${provider}: git pull failed (offline or diverged) — using current HEAD`);
  }
}

/**
 * Reports SDK source commits landed since the manifest's verified revision.
 * Informational only; the caller does not fail the run on what this prints.
 */
function reportSourceDrift(provider, localPath, verified) {
  const gitRoot = git(localPath, ['rev-parse', '--show-toplevel']);
  if (!gitRoot) {
    console.log(`  ${provider}: ${localPath} is not a git checkout — skipping source diff`);
    return;
  }

  if (git(gitRoot, ['cat-file', '-e', `${verified.commit}^{commit}`]) === null) {
    console.error(`  ${provider}: verified commit ${verified.commit.slice(0, 9)} not found in the checkout — is surface.verified.commit correct?`);
    return;
  }

  const head = git(gitRoot, ['rev-parse', 'HEAD']);
  if (head === verified.commit) {
    console.log(`  ${provider}: SDK source unchanged since verified commit ${verified.commit.slice(0, 9)}`);
    return;
  }

  // Scope the diff to the client source the manifest points at; without a
  // sourceDir the whole repo is in scope, which is noisier but never wrong.
  const scope = verified.sourceDir ? ['--', verified.sourceDir] : [];
  const range = `${verified.commit}..HEAD`;
  const commits = git(gitRoot, ['log', '--oneline', range, ...scope]);
  if (commits === null) {
    console.error(`  ${provider}: could not diff ${range}`);
    return;
  }
  if (commits === '') {
    console.log(`  ${provider}: no commits touching ${verified.sourceDir ?? 'the SDK'} since ${verified.commit.slice(0, 9)}`);
    return;
  }

  const lines = commits.split('\n');
  console.log(`  ${provider}: ${lines.length} SDK source commit(s) since verified ${verified.version} (${verified.commit.slice(0, 9)}):`);
  for (const line of lines) console.log(`    ${line}`);

  const stat = git(gitRoot, ['diff', '--stat', range, ...scope]);
  if (stat) for (const line of stat.split('\n')) console.log(`    ${line}`);

  const full = git(gitRoot, ['diff', range, ...scope]);
  if (full) {
    const out = join(tmpdir(), `api-doctor-${provider}-sdk-diff.patch`);
    writeFileSync(out, `${full}\n`);
    console.log(`    full diff: ${out}`);
  }
  console.log(`    review these, then bump surface.verified in ${provider}'s manifest`);
}

let failed = false;

let localOverrides;
try {
  localOverrides = parseLocalOverrides(process.argv.slice(2));
} catch (err) {
  console.error(`check-sdk-surface: ${err.message}`);
  process.exit(2);
}

for (const provider of localOverrides.keys()) {
  if (!TARGETS.some((t) => t.provider === provider)) {
    console.error(`check-sdk-surface: --local names unknown provider "${provider}"`);
    console.error(`  known: ${TARGETS.map((t) => t.provider).join(', ')}`);
    process.exit(2);
  }
}

/** Type-declaration entry points a target's deriver needs inside the package. */
function expectedEntries(target) {
  if (target.rootClasses) return target.rootClasses.map((r) => r.entry);
  if (target.dts) return target.dts;
  return [];
}

/**
 * Runs the target's shape-specific deriver. Returns the derived method-path
 * set, or null when the declarations it needs are absent (already reported).
 */
function deriveForTarget(target, pkgDir, tmp, version) {
  if (target.composite) return deriveCompositeSurface(pkgDir, tmp, target.composite);
  if (target.firebaseProducts) return deriveFirebaseModularSurface(pkgDir, target.firebaseProducts);
  if (target.rootClasses) {
    return deriveLinkedSurface(pkgDir, target.rootClasses, {
      linkReadonlyProps: target.linkReadonlyProps,
    });
  }
  let dtsText = null;
  let dtsPath = null;
  for (const candidate of target.dts) {
    try {
      dtsText = readFileSync(join(pkgDir, candidate), 'utf8');
      dtsPath = candidate;
      break;
    } catch {
      // try next candidate
    }
  }
  if (dtsText === null) {
    console.error(`FAIL ${target.provider}: none of ${target.dts.join(', ')} found in ${target.pkg}@${version}`);
    return null;
  }
  return target.multiFile
    ? deriveSurfaceMultiFile(pkgDir, dtsPath, target.rootClass)
    : deriveSurface(parseClasses(dtsText), target.rootClass);
}

for (const target of TARGETS) {
  const localPath = localOverrides.get(target.provider);
  const tmp = mkdtempSync(join(tmpdir(), 'api-doctor-surface-'));
  try {
    let pkgDir;
    // These derivers all read compiled .d.ts, so an unbuilt source checkout
    // has nothing for them to parse. That only disables the method diff — the
    // source diff below reads git, not dist, and is the signal local mode
    // exists for, so it must stay reachable on an unbuilt SDK.
    let canDeriveMethods = true;
    if (localPath) {
      pkgDir = localPath;
      if (!existsSync(join(pkgDir, 'package.json'))) {
        console.error(`FAIL ${target.provider}: no package.json at ${pkgDir}`);
        console.error('  point --local at the package directory itself, not the monorepo root');
        failed = true;
        continue;
      }
      // Before the version and the surface are read off disk, so all three
      // signals describe the same revision.
      pullLocalCheckout(target.provider, pkgDir);
      const entries = expectedEntries(target);
      if (entries.length > 0 && !entries.some((e) => existsSync(join(pkgDir, e)))) {
        console.log(`${target.provider}: no built type declarations (${entries.join(' or ')}) — skipping method diff`);
        console.log('  build the SDK in that package (e.g. `bun run build`) to include it');
        canDeriveMethods = false;
      }
    } else {
      execSync(`npm pack ${target.pkg}@latest --pack-destination "${tmp}"`, {
        stdio: ['ignore', 'pipe', 'pipe'],
        // npm's notice output can exceed execSync's 1 MB default (ENOBUFS).
        maxBuffer: 64 * 1024 * 1024,
      });
      const tarball = readdirSync(tmp).find((f) => f.endsWith('.tgz'));
      if (!tarball) throw new Error(`npm pack produced no tarball for ${target.pkg}`);
      execSync(`tar xzf "${tarball}"`, { cwd: tmp });
      pkgDir = join(tmp, 'package');
    }
    const version = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8')).version;
    const manifestPath = join(ROOT, target.manifest);
    const verified = manifestVerified(manifestPath);

    if (canDeriveMethods) {
      const derived = deriveForTarget(target, pkgDir, tmp, version);
      if (derived === null) {
        failed = true;
      } else {
        const listed = manifestMethods(manifestPath);
        const missing = [...derived].filter((m) => !listed.has(m)).sort();
        const stale = [...listed].filter((m) => !derived.has(m)).sort();
        const source = localPath ? `${pkgDir} (local)` : `${target.pkg}@${version}`;
        if (missing.length === 0 && stale.length === 0) {
          console.log(`${target.provider}: surface matches ${source} (${listed.size} methods)`);
        } else {
          failed = true;
          console.error(`FAIL ${target.provider}: surface drift against ${source}`);
          for (const m of missing) console.error(`  missing from manifest: ${m}`);
          for (const m of stale) console.error(`  stale in manifest (not in SDK): ${m}`);
          console.error(`  update ${target.manifest} and re-verify against the SDK docs`);
        }
      }
    }

    // Version and source drift are advisory: a bump with no client-visible
    // change is routine, and failing on it would make the guard cry wolf.
    if (verified && verified.version !== version) {
      console.log(`  ${target.provider}: SDK is at ${version}, manifest verified at ${verified.version} (${verified.at}) — re-verify`);
    }
    if (localPath && verified) {
      reportSourceDrift(target.provider, pkgDir, verified);
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

process.exit(failed ? 1 : 0);
