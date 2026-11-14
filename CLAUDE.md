# CLAUDE.md

## Project overview

`netstatsCron` is the scheduler in the "netstats" suite. On fixed cron ticks it builds
command messages (host × protocol × subscription) and publishes them to RabbitMQ, where the
`netstats<Protocol>Poller` apps pick them up.

- Entry point: `server.js` (single file, CommonJS, runs top-level on `node server.js`)
- Internal lib: `commonfunctions` (GitHub dep `ThatOneNeji/CommonFunctions`) provides
  `Logger` (log4js), `NejiUtils` (address/CIDR validation) and `MessageBroker` (amqp).
- Data files: `nodes.json` (target groups, addresses/CIDRs, subscriptions + trigger interval),
  `services.json` (protocol inventory, e.g. SNMP OIDs), `protocols.json` (currently unused).
- Config: `configuration/logging.json` and `configuration/messagebrokers.json`
  (git-ignored; copy from the `*.sample` files).
- `cron_cmd.sql`: MySQL table for cron command records (used by downstream loaders, not here).

### Flow

1. Load config → init logger → init message broker.
2. `servicesLoad` / `servicesFlatten` → `RunTime.activeServices`, `RunTime.QueueAreas`.
3. `nodesLoad` / `nodesFlatten` → expand CIDRs → `RunTime.activeNodes`.
4. `buildNodeServiceRuntimeList` → `RunTime.activeList[trigger][interval] = [msg…]`.
5. `createQueues` → one publish queue per area: `<publishBaseName>/<area>`.
6. Cron jobs at 15s / 30s / 1m / 5m call `runService({type:'interval', cron:<minutes>})`,
   which stamps `stime/etime/rdate/lifespan/caid` and `batchPublish`es.

### Commands

- `npm run lint` — ESLint (flat config, `eslint.config.js`) on root `*.js`. Currently passes.
- `npm run documentation` — JSDoc into `./documentation/`.
- `npm test` — placeholder, no tests exist.

### Conventions

- 4-space indent for JS/JSON, 2 for `package.json` (`.editorconfig`).
- `function ()` with a space for anonymous functions, none for named (ESLint rule).
- JSDoc typedefs on everything.

---

## Review findings / TODOs (2026-11-14)

### Bugs

- [ ] **Intervals with no matching cron are silently never sent.** `nodes.json` uses trigger
      value `60` (e.g. `mikrotik_queue_tree`), but only 0.25/0.5/1/5 crons exist. Either add
      the missing crons or (better) generate CronJobs dynamically from the keys of
      `RunTime.activeList.interval`, and warn on unsupported values.
- [ ] **15s cron uses a string key** (`cron: '0.25'`) while others use numbers. Works only
      because object keys are coerced; `options.cron * 60` also relies on coercion. Make
      consistent (numbers) — and note `0.50` vs `0.5` only works because of number→string.
- [ ] **`runService` crashes if no `interval` trigger exists**:
      `RunTime.activeList[options.type][options.cron]` throws when `activeList.interval` is
      undefined (e.g. all node groups disabled). Use optional chaining.
- [ ] **Shared mutable message objects.** `runService` mutates the `cronMsg` objects stored in
      `RunTime.activeList` (adds `stime`, `etime`, `caid`, …). On the next tick `buildHash`
      therefore hashes the *previous* run's `caid`/times too, and the published object is the
      same reference each time (risky if `batchPublish` is async/buffered). Clone per run:
      `const msg = {...cronMsg, …}`.
- [ ] **`buildHash` throws on `null`/`undefined` values** (`msg[k].constructor`); also arrays
      get string-joined rather than JSON-serialised. Simpler: hash `JSON.stringify(msg)`.
- [ ] **`targets.json` branch is dead code** — it's not in `cfgFiles`, so `appConfig.cron` is
      always undefined and every CronJob gets `timezone: undefined` (falls back to system TZ).
      Either add a config file for `cron`/timezone or drop the `targets`/`cron` code and typedefs
      (the `Target`/`Cron` typedefs look copied from a file-scanner app).
- [ ] **`Logging.messageclient` doesn't exist** (logging areas are `cron`, `messagebroker`,
      `fs`). `receiveHandler` would throw if ever called. It also doesn't return `true`, which
      `MessageBroker` checks to ack. No `receiveQueue` is configured, so it's currently
      unreachable — remove it or fix it.
- [ ] **`uncaughtException` handler**: `exitHandler.bind(null, msg)` creates a function and
      never calls it (no-op), and the error is logged at `debug` level. Log at `error`/`fatal`.
- [ ] **`exit` handler / SIGTERM**: no `SIGTERM` handler (systemd/docker stop), and crons and
      the broker connection aren't stopped/closed on shutdown. `process.exit()` in the signal
      handler may drop in-flight publishes.
- [ ] **Load failures are swallowed**: `servicesLoad`/`nodesLoad` log the error and continue,
      then `servicesFlatten`/`nodesFlatten` crash on `undefined.services`. Bail cleanly instead.
- [ ] `validateTargetAddress` calls `Common.validateTargetAddress(host)` twice (first result
      discarded) — CIDR expansion is done twice.
- [ ] `counter[...][...] = ''` then `++` → works via coercion (`'' + 1`), but initialise to `0`.
- [ ] `nodes.json` references subscription `snmp/mikrotik_cdp`, which doesn't exist in
      `services.json` (silently produces nothing). Add a startup warning for unmatched
      subscriptions.

### Cleanup / code quality

- [ ] `require('fs')` re-required inside `servicesLoad`/`nodesLoad`; `fs` is already imported.
- [ ] `loadConfigurationFiles` relies on `cfgPath` existing but reads `cfgFiles` with their own
      hard-coded paths; paths are relative to CWD, so starting from another directory fails.
      Use `path.join(__dirname, …)`.
- [ ] `RunTime.loadedNodes` initialised as `''` instead of `{}`.
- [ ] Duplicate `loggingOptions` typedef (top of file and near line 195).
- [ ] `buildNodeServiceRuntimeList` is O(nodes × services); fine at current size, but a map
      keyed by `protocol/subscription` would be cleaner.
- [ ] `moment` is in maintenance mode; only used for `valueOf`/`add`/`format` — replace with
      `Date` (drop a dependency).
- [ ] Typos: "Flatting" → "Flattening", "sunscription", "Pasword", "thisget".
- [ ] `server.js` is ~600 lines of top-level side effects; split into modules (config,
      loaders, scheduler) with a `main()` so it can be unit-tested.
- [ ] `protocols.json` is currently unused by `server.js` — keep it (see "Planned: DB-generated
      data files" below); decide whether cron should consume it or whether it's only for other apps.
- [ ] `.gitignore` has duplicate `/_backup`, stale `lib/...` entries (no `lib/` dir), and
      ignores `/package-lock.json` — consider committing the lockfile for reproducible installs.
- [ ] `tmp/____lib` lying around (ignored, but can be removed).

### Planned: DB-generated data files

`nodes.json`, `services.json` and `protocols.json` are static today, but the intent is to keep
this data in a database and periodically regenerate the files from it (this app keeps reading
files; the generator is a separate step). Implications:

- [ ] **Reload without restart.** Data is only read once at startup. Refactor the
      load → flatten → build pipeline into a `reloadData()` that builds a *fresh* `RunTime`
      and swaps it in atomically (currently `activeNodes`/`activeServices`/`activeList` are
      appended to, so re-running would duplicate entries). Trigger via `fs.watch` (debounced)
      and/or `SIGHUP`. Also call `createQueues()` for any new areas.
- [ ] **Validate before swapping.** If a regenerated file is malformed or partial, log an error
      and keep the previous good data instead of crashing (ties in with the "load failures are
      swallowed" bug above). Consider a JSON Schema per file.
- [ ] **Atomic writes by the generator.** Write to a temp file and `rename()` so the cron never
      reads a half-written file.
- [ ] **Make paths configurable** (e.g. a `datafiles` dir in config) so generated files can live
      outside the repo; then stop tracking them in git (or keep only samples).
- [ ] **Dynamic crons** (see interval bug above) matter more here: new interval values coming
      from the DB should just work, not need code changes.
- [ ] Startup warning for unmatched subscriptions becomes important once data is edited outside
      the repo.

### Related: netstatsNetworkServiceWorker (NSW)

`/home/neji/repos/_mine/netstatsNetworkServiceWorker` (last commit 2024-08) is the consumer
for the non-SNMP protocols in `services.json` (`ping`, `traceroute`, `http`, `nslookup`, `dig`,
`mtr`). It consumes cron messages, checks `stime <= now <= etime`, runs the probe, and publishes
SQL `INSERT` strings for the MySQL loader. It shares the `cronDataMessage` typedef with this repo.
Compatibility gaps found (2026-11-14):

- [ ] **Queue routing mismatch.** Cron publishes to `<publishBaseName>/<area>` (all NSW
      protocols are area `monitoring` → one queue), but NSW consumes
      `<consumeBaseName>/<handlerName>` (`…/ping`, `…/traceroute`). They never meet. Pick one
      scheme — per-protocol queues (`<base>/<area>/<protocol>`) is probably cleanest.
- [ ] **NSW won't start on current `commonfunctions`:** it imports `Nejiutils`, but the lib
      exports `NejiUtils`. NSW also puts `user`/`password`/`vhost` inside each broker entry,
      while this repo uses a separate `credentials` block — check against the current
      `MessageBroker.init`. NSW's `commonfunctions` dep is unpinned.
- [ ] **`cron` table schema drift.** NSW's `buildSQLCron` inserts
      `host, groupname, content, hostname`, but `cron_cmd.sql` here has
      `name, mgroup, target, address` (no `content`/`hostname`). Pick one source of truth
      for the schema.
- [ ] **Security:** NSW tracks `config.json` in git with real broker credentials. Rotate them,
      untrack the file and add a `.sample`. NSW also builds SQL by string concatenation from
      message data (injection risk). Consider sending structured results and letting the loader
      use parameterised queries.
- [ ] NSW `handlers/ping.js`: `lost = sent - sent` and `percentage = sent / sent` (always 0 / 100%);
      the SQL value quoting is malformed (extra `'` after `vaildateSQLValue`).
- [ ] Only `ping` and `traceroute` are wired up through handlers; `http`/`nslookup` sit half-done
      in `server.js`, and `dig`/`mtr` are stubs.
- [ ] `etime` window is `interval*60/2` seconds (8 s for the 15 s cron) and NSW checks it on
      receive, so a queue backlog longer than that marks everything `requestexpired`. Fine
      for 5-min jobs, tight for 15/30 s ones.

### Tooling / docs

- [ ] No tests. Add `node:test` tests for `servicesFlatten`, `nodesFlatten`,
      `buildNodeServiceRuntimeList`, `buildHash`, `runService` (requires refactor above).
- [ ] No `engines` field in `package.json` (running on Node 24 locally).
- [ ] README is outdated: references `settings.json` / `amqp` block (config is now
      `configuration/messagebrokers.json`), a dead Travis CI badge, and doesn't mention the
      sample config files or how to start the app. Add a `start` script.
- [ ] `messagebrokers.json.sample` contains real-looking internal hostnames
      (`*.bwcsystem.local`) and credentials — replace with placeholders.
- [ ] Consider a CI workflow (GitHub Actions) running `npm run lint` (+ tests).
