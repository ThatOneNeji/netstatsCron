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
- [ ] `protocols.json` is unused — delete it or wire it up.
- [ ] `.gitignore` has duplicate `/_backup`, stale `lib/...` entries (no `lib/` dir), and
      ignores `/package-lock.json` — consider committing the lockfile for reproducible installs.
- [ ] `tmp/____lib` lying around (ignored, but can be removed).

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
