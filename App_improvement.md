# Smart Expense Tracker — Pet System, LLM Pipeline & Stabilization Plan
*Generated from a direct audit of the `saurabhydav/smartExpenseTracker` repo (commit `c473a78`) — every root cause below was confirmed by reading the actual code, not assumed.*

---

## Root Cause Findings (read this first)

1. **The pet's gamification is completely disconnected from real transactions.** `TamagotchiService.ts`'s `processTransactionGamification()` / `applyGamificationUpdate()` are fully written but have **zero call sites** anywhere else in the codebase (confirmed via full-repo grep). The pet currently only evolves via manual tap buttons in `FinancialTamagotchi.tsx`, which runs its own separate, duplicate EXP system. The core premise — "the pet reacts to your spending" — isn't wired up at all yet.
2. **No RAM check before loading an LLM.** Every model's metadata defines `minRamGB`, but it is never read anywhere, and there's no `react-native-device-info` (or equivalent) installed to even know the device's real RAM. A user can select the 3B model (needs ~6GB+ RAM) on a 2–3GB budget phone — very likely your actual crash source.
3. **Stale dead code landmine**: `LlmEngine.ts`'s `DEFAULT_MODEL_PATH` points at `Bonsai-1.7B-Q1_0.gguf`, a file that matches none of the 3 real models. Harmless today only because every live call site passes an explicit path.
4. **No checksum verification** on downloaded GGUF files — only a file-size tolerance check. A corrupted-but-right-sized file passes verification and can fail (or crash) at load time.
5. **No Wi-Fi-only guard, and no real Android foreground-service download.** `FOREGROUND_SERVICE` is declared in the manifest but nothing in the JS download flow actually implements one. Android's Doze/App Standby will very likely kill a 271MB–2GB plain background download before it finishes on real devices.
6. **The "non-advisory" safety guard is half-built.** The LLM chat path (`BonsaiLlmService.ts`) has a real system-prompt-level guard telling the model not to call itself an advisor — good. But `AIAdvisorService.ts`'s deterministic, rule-based "Actionable Advice" text (which needs no download and is likely used far more) has **no disclaimer at all**.
7. **Direct Pokémon/Digimon IP references are in shipped code** — `pokemonClass: 'Fire Dragon (Charizard Line)'`, evolution titles like `"MEGA CHARIZARD CAT"`, `"MEGA BLASTOISE DOG"`, `"MEGA RAICHU BUNNY"`, `"MEGA RAYQUAZA PANDA"`, `"MEGA NINETALES FOX"`, `"MEGA MEWTWO KOALA"`, and a `"WARGREYMON"` reference. **This must be renamed before any public release** — Nintendo/Game Freak and Bandai actively enforce these trademarks. This plan treats it as a hard prerequisite, not a style note.
8. **Likely native-linking conflict**: adding `llama.rn` + `react-native-webview` in one commit, with no `packagingOptions { pickFirst ... }` in `android/app/build.gradle`, is a textbook setup for a duplicate `.so` file crash on build/launch.
9. Two ~788KB near-duplicate copies of Three.js (`threeMinJs.ts` and `threeMinJsBase64.ts`) exist — not a crash cause by itself, but dead weight worth cleaning up.

**Important scope note on "make it like Pokémon GO":** I'm treating this as a request for Pokémon GO's *mechanics and production quality* (real 3D models, satisfying evolution moments, collection-screen polish, haptics/sound, AR-style camera feel) — all genuinely achievable and already partly underway in your real `Pet3DCanvas.tsx` WebGL engine. I'm not going to help extend the actual Charizard/Blastoise/etc. references further; Phase 3 below renames away from them as a required step, not optional.

---

## How to use this document

Each phase is a checklist. Work top to bottom — later phases assume earlier ones are done. Phases 0–2 are the non-negotiable near-term work; everything from Phase 3 onward is real but can be resequenced once the app is stable and the core loop is honest. Check items off as you go; this is meant to be lived in over the coming weeks, not read once.

---

## Phase 0 — Emergency Triage: Get the App Launching Again (Steps 1–20)

- [ ] **1.** Connect a real device via `adb devices`, reproduce the crash with `adb logcat *:E | grep -i "smartexpense\|AndroidRuntime\|FATAL"` running — get the actual stack trace before fixing anything blind.
- [ ] **2.** Confirm whether the crash happens on every cold launch, or only after opening the "AI Chat" tab / Bonsai Model Manager screen — this one test tells you if the new AI/pet work is the cause.
- [ ] **3.** Full clean rebuild: delete `android/app/build`, `android/.gradle`, `node_modules`; run `watchman watch-del-all`; clear Metro cache (`npx react-native start --reset-cache`); reinstall. Rules out stale build artifacts from adding two native modules at once.
- [ ] **4.** Add `packagingOptions { pickFirst 'lib/*/libc++_shared.so' pickFirst 'lib/*/libjsc.so' }` to `android/app/build.gradle` — combining `llama.rn` with other native modules is a classic duplicate-`.so` crash cause.
- [ ] **5.** Run `cd android && ./gradlew :llama.rn:assembleDebug` in isolation to confirm the native module itself compiles.
- [ ] **6.** Confirm NDK `27.1.12297006` (per your `build.gradle`) is actually installed via Android Studio's SDK Manager.
- [ ] **7.** Test app launch fully offline (airplane mode) — confirm no unhandled promise rejection blocks the JS thread before `dbReady` resolves.
- [ ] **8.** Temporarily remove the `AiAdvisor` tab and `BonsaiModelManager` screen from `App.tsx`, rebuild, confirm the rest of the app launches clean — isolates whether the new AI/pet feature set is the fault line.
- [ ] **9.** If step 8 fixes it, bisect further: re-add just the `Pet3DCanvas` WebView without `llama.rn` calls, then just `llama.rn` without the WebView, to isolate which specific addition is unstable.
- [ ] **10.** Check `adb logcat` around the crash timestamp specifically for `OutOfMemoryError` or `lmkd`/"Low memory killer" entries.
- [ ] **11.** If OOM is confirmed, reproduce with only the smallest (360M) model downloaded — confirms whether it's "the LLM feature at all" or "a specific oversized model on this device."
- [ ] **12.** Check whether `AiAdvisorScreen`/`BonsaiModelManagerScreen` auto-loads the model in a `useEffect` on mount vs. only after an explicit user tap — auto-loading on tab-open is a likely unintentional trigger.
- [ ] **13.** Add a top-level React error boundary around `<AppStack />`/`<AuthStack />` in `App.tsx` — there is currently none, so any uncaught render error kills the whole app.
- [ ] **14.** Split the single try/catch in `App.tsx`'s startup `initialize()` into per-step try/catch blocks, so one failing step doesn't silently abort the rest and leave the app stuck on the loading spinner.
- [ ] **15.** Confirm `initDatabase()` migrations are additive for users upgrading from a pre-pet-system install — no destructive schema changes on existing data.
- [ ] **16.** Check Play Console / Crashlytics (once wired in Phase 1) for the real exception class and affected device models rather than debugging blind from vague user reports.
- [ ] **17.** Run `npm ls react react-native` to confirm no duplicate resolved versions got installed alongside the new packages.
- [ ] **18.** Add `android:largeHeap="true"` to the `<application>` tag in `AndroidManifest.xml` — low-risk, occasionally helpful.
- [ ] **19.** Confirm only one of `threeMinJs.ts` / `threeMinJsBase64.ts` is actually imported by `Pet3DCanvas.tsx`; delete the unused duplicate.
- [ ] **20.** Once stable on your primary device, repeat the launch test on the lowest-spec Android device you can access (2GB RAM, older Android version) — the actual profile your MSME users likely run.

## Phase 1 — Stabilize & Instrument (Steps 21–32)

- [ ] **21.** Add Crashlytics (`@react-native-firebase/crashlytics`) or Sentry so the next crash comes with a real stack trace.
- [ ] **22.** Add breadcrumb logging at each startup step (`initDatabase`, `loadCategories`, `checkAuth`, model auto-load).
- [ ] **23.** Add an opt-in "Send diagnostic log" button in `SettingsScreen.tsx` for beta testers.
- [ ] **24.** Tag Crashlytics events in `LlmEngine.ts`/`BonsaiModelDownloader.ts` with model id, model size, and device RAM, so LLM-related crashes are distinguishable.
- [ ] **25.** Set up a Play Console internal testing track and require every future build to pass through it first.
- [ ] **26.** Add a simple feature-level kill switch for the entire AI/LLM feature set so a bad release can be disabled without an emergency submission.
- [ ] **27.** Log a local-only rolling launch-success counter to self-diagnose crash-rate trends without shipping personal data anywhere.
- [ ] **28.** Add a "Safe Mode": after 2 consecutive crashed launches, boot into a minimal mode skipping the AI/pet tab entirely.
- [ ] **29.** Document exact repro steps for whatever crash Phase 0 found in a `KNOWN_ISSUES.md`.
- [ ] **30.** Freeze new feature branches until the current crash is confirmed fixed on a low-spec device.
- [ ] **31.** Tag the last known-good commit (`git tag pre-pet-llm-stable <commit>`) as a fast rollback point.
- [ ] **32.** Let the app sit in internal testing for a few real days post-fix before moving to Phase 2 — confirm the fix actually held.

## Phase 2 — Fix the Core Gamification Wiring (Steps 33–50)

- [ ] **33.** Decide the one source of truth for pet progression: fully expense-driven, or hybrid (automatic + optional tap bonus) — right now both an unused expense-driven path and a separate manual-tap path exist and will conflict.
- [ ] **34.** Wire `processTransactionGamification()`/`applyGamificationUpdate()` into the real transaction pipeline (from `SmartSmsProcessor.ts`/`AddTransactionScreen.tsx`), passing real type/amount/category/`isOverBudget`.
- [ ] **35.** Fix the data-shape mismatch: make `applyGamificationUpdate()` write into `petsData[currentPetId]`, not the unused top-level `tamagotchi.level/exp/coins`, so real transactions actually move the pet shown on screen.
- [ ] **36.** Decide the fate of `FinancialTamagotchi.tsx`'s separate `processExpGain()`/`handleFeed()` logic — retire it, or keep it as an explicitly small supplementary bonus once real transactions drive the majority of progress.
- [ ] **37.** Reconsider the punitive "ghost state" (EXP < -50) deliberately — soften the framing (e.g., "resting," not "ghost") consistent with the non-punitive mood design discussed earlier for this project.
- [ ] **38.** Add a unit test suite for `TamagotchiService.ts` — EXP curve, level-up rollover, and the low-EXP boundary condition.
- [ ] **39.** Resolve the two competing EXP-curve formulas (`getRequiredExp`'s `100 * 1.15^(level-1)` vs. `FinancialTamagotchi.tsx`'s flat `level * 100`) down to one.
- [ ] **40.** Add a `lastTransactionProcessedId`/timestamp guard so re-processing (e.g., after a resync) can't double-award EXP/coins.
- [ ] **41.** Add a daily/session EXP cap from transaction-logging alone, so importing a large historical backlog in one sitting doesn't instantly max the pet.
- [ ] **42.** Confirm `isOverBudget` reads the current month's live budget/spend from `AnalyticsService`, not a stale/default value.
- [ ] **43.** Document the final EXP/coin rule set in one place (code comment block) before the Phase 4 visual redesign builds on top of it.
- [ ] **44.** Add an in-app "why did my pet's mood change" explainer — visible logic builds trust, consistent with the confirm-loop principle discussed earlier for subscriptions.
- [ ] **45.** Spot-check that `updateActivePetState()`'s merge doesn't clobber OTHER species' saved progress when only the active one should change.
- [ ] **46.** Add a migration for existing beta users' currently-saved (manual-tap-driven) progress so the step 34–36 fix doesn't reset everyone to Stage 1 overnight.
- [ ] **47.** Add local, aggregate-only analytics on how often the pet screen is opened vs. how often real transactions actually move it.
- [ ] **48.** Decide an actual purpose for the accumulating `coins` balance (currently no spend/use case exists anywhere) — tie it to the Phase 4 species-unlock system.
- [ ] **49.** Add a "reset my pet" option in Settings with a clear confirmation dialog.
- [ ] **50.** Manually test the full reconnected loop for a real week of actual transactions before touching the visual layer in Phase 4.

## Phase 3 — Rename & Re-theme Away From Protected IP (Steps 51–60)
*Non-negotiable prerequisite — not a style choice.*

- [ ] **51.** Treat this as a hard blocker: current species definitions directly reference Charizard, Blastoise, Raichu, Rayquaza, Ninetales, Mewtwo, and Digimon's WarGreymon. These are actively enforced trademarks.
- [ ] **52.** Remove the `pokemonClass` field from `PetSpeciesDef` entirely (or keep as an internal-only, never-rendered dev note).
- [ ] **53.** Rename every Stage-10 "MEGA [X] [ANIMAL]" title and the "WARGREYMON" badge to original names — happy to draft a full replacement naming set for all 6 species × 10 stages when you're ready.
- [ ] **54.** Audit `DIALOG_QUOTES` and all other in-app copy for incidental references (e.g., the current "Pokémon Power!" line) and remove them.
- [ ] **55.** Keep the underlying mechanic (collect, evolve, elemental typing, stage-based growth) — mechanics aren't protected, only the specific characters/names are.
- [ ] **56.** Rework each species' elemental flavor to be original rather than a reskinned Pokémon-type system, expanding on the original ability names you already have (e.g., "Flamethrower Pounce") while dropping the parenthetical Pokémon-line references.
- [ ] **57.** Visually gut-check the `assets/pets/*.jpg` illustrations for accidental close resemblance to a specific existing character; regenerate any that read as unmistakably "that IP, redrawn."
- [ ] **58.** Re-grep the whole repo (case-insensitive) for "pokemon," "digimon," "charizard," "blastoise," "raichu," "rayquaza," "ninetales," "mewtwo," "greymon" after the renaming pass.
- [ ] **59.** Document the renamed species system in `CODE_EXPLANATION.md`/`CODE_WALKTHROUGH.md` so references don't creep back in out of habit when species #7 is added later.
- [ ] **60.** From here on, treat "Pokémon GO" as shorthand for a quality/mechanics bar (real models, satisfying evolutions, collection polish, tactile feedback) — not a design source to copy from directly.

## Phase 4 — Pokémon-GO-Caliber Pet Experience (Steps 61–95)

- [ ] **61.** Audit `Pet3DCanvas.tsx`'s `buildPetMesh()` stage-by-stage; identify the most primitive-looking stages and prioritize visual investment there first.
- [ ] **62.** Consider commissioning real low-poly 3D models per species from a freelance 3D artist — the single highest-impact upgrade over pure procedural geometry.
- [ ] **63.** If not commissioning models yet, upgrade procedural geometry smoothness (higher segment counts, smoother stage-to-stage attachment transitions) as a cheaper interim step.
- [ ] **64.** Add proper UV-mapped textures instead of flat `MeshToonMaterial` single colors.
- [ ] **65.** Verify the existing rim light reads correctly per species color, especially on lighter palettes (e.g., the bunny).
- [ ] **66.** Implement smooth cross-fade transitions between evolution stages (scale + opacity blend, ~1.5s) instead of an instant mesh swap.
- [ ] **67.** Build a dedicated full-screen "Evolution Ceremony" inside `Pet3DCanvas`'s own WebGL scene (camera pull-in, light burst, name reveal) now that a real 3D engine exists.
- [ ] **68.** Add haptic feedback on taps and evolution moments.
- [ ] **69.** Add sound design: idle ambient loop, happy sound, evolution fanfare — mutable in Settings.
- [ ] **70.** Build a real "Collection" screen: all 6 species as cards, locked/silhouetted until unlocked, with per-species stage progress.
- [ ] **71.** Implement an actual unlock mechanic for the other 5 species (reach a stage with your starter, or spend coins) — gives the `coins` balance from step 48 a real purpose.
- [ ] **72.** Add a "nickname your pet" text input, stored per species.
- [ ] **73.** Add per-species idle personality variety (not just shared breathing/bounce).
- [ ] **74.** Verify touch-drag 360° rotation performs smoothly on a real low/mid-range Android device, not just the dev inspector.
- [ ] **75.** Add an automatic low-frame-rate fallback that drops shading/particle complexity on weaker devices.
- [ ] **76.** Cap particle count and other GPU-cost knobs behind a device-tier setting, mirroring the LLM model-tiering philosophy.
- [ ] **77.** Add a "photo mode" — snapshot the current 3D pose to the device gallery.
- [ ] **78.** Confirm WebGL geometries/materials are explicitly `.dispose()`-d on rebuild, not just removed from the scene graph — prevents a slow memory leak across many evolutions/species switches in one session.
- [ ] **79.** Add a WebView error-recovery path (auto-remount on internal JS error) rather than leaving a permanently broken 3D canvas.
- [ ] **80.** Weigh replacing the `eval(atob(...))` Three.js load with a bundled local asset load for easier debugging, against the current single-file/no-CDN constraint.
- [ ] **81.** Add a loading skeleton inside the `Pet3DCanvas` container during scene init.
- [ ] **82.** Test behavior under Android's WebView-process recycling (long background, then foreground) — confirm clean reinit, not a frozen last frame.
- [ ] **83.** Add subtle environmental backdrop (gradient/particle dust) behind the pet instead of a flat card background.
- [ ] **84.** Add a distinct real-time "perk up" reaction the moment a healthy transaction is auto-detected, reinforcing the reconnected loop from Phase 2.
- [ ] **85.** Add a subtle, non-punitive negative reaction for an overspending transaction (droop, not "ghost" imagery), consistent with step 37.
- [ ] **86.** Build a "Pet Stats" panel (total logged transactions, streak, days since starter, favorite category) surfacing data already tracked in `AnalyticsService`.
- [ ] **87.** Add a manual "sync" affordance on the pet screen for users who want to force a recompute.
- [ ] **88.** Route all pet copy (dialogue, stage names, ability names) through one constants file, ready for localization given your Indian, likely multilingual, user base.
- [ ] **89.** Full accessibility pass: screen-reader labels for icon-only buttons, sufficient contrast on stat pills.
- [ ] **90.** Add a "reduce motion" setting dampening the now-heavier animation load.
- [ ] **91.** Confirm graceful degradation ("3D view unavailable") on WebViews too restricted/old to run WebGL.
- [ ] **92.** Add local/aggregate telemetry on which species/stage combos get the most viewing time, to prioritize future art investment.
- [ ] **93.** Playtest the full Stage 1→10 arc yourself, timed, and consider an intermediate "prestige"/cosmetic reward if reaching max evolution takes too long to sustain engagement.
- [ ] **94.** Get 3–5 real beta users to specifically judge "does this feel like a mobile game, or a mascot bolted onto a corporate app."
- [ ] **95.** Decide the remaining role of the static `assets/pets/*.jpg` illustrations (e.g., Collection-screen thumbnails) now that live 3D is the primary experience.

## Phase 5 — LLM Download Pipeline Hardening (Steps 96–125)

- [ ] **96.** Add `react-native-device-info`'s `getTotalMemory()` and actually compare it against each model's `minRamGB` before allowing selection — currently defined but never read; likely your highest-value crash fix.
- [ ] **97.** Block (with a clear inline reason) selection of any model whose `minRamGB` exceeds detected device RAM.
- [ ] **98.** Add a SHA-256 checksum field per model and verify it after download, before marking `READY`.
- [ ] **99.** Source correct published checksums from each model's Hugging Face repo directly.
- [ ] **100.** Replace plain `RNFS.downloadFile` background download with a library implementing real Android foreground-service downloads (e.g., `react-native-background-downloader`) — your manifest already declares the permission but nothing currently backs it.
- [ ] **101.** Add a persistent Android notification during active downloads (progress %, pause/cancel).
- [ ] **102.** Add a Wi-Fi-only toggle (default ON) before starting any 271MB–2GB download.
- [ ] **103.** Show a clear inline explanation with a one-tap override when Wi-Fi-only blocks a mobile-data download.
- [ ] **104.** Add a pre-download confirmation stating exact size/data usage in plain language.
- [ ] **105.** Recheck free storage periodically during a long download, not just once at start.
- [ ] **106.** Differentiate error messages by real cause (no internet, storage ran out mid-download, checksum mismatch, server error, timeout) instead of one generic failure message.
- [ ] **107.** Detect true offline state via NetInfo and pause retries entirely until connectivity returns, rather than burning 15 retries while offline.
- [ ] **108.** Fix or remove the stale `DEFAULT_MODEL_PATH` fallback in `LlmEngine.ts` so it's never a landmine for a future parameterless call.
- [ ] **109.** Add a startup consistency check: verify the recorded "active model" still exists on disk and passes the checksum before trusting cached status.
- [ ] **110.** Confirm `BonsaiModelManagerScreen.tsx` clearly surfaces per-model delete/switch actions (the backend logic already supports multi-model).
- [ ] **111.** Warn or block downloading a second large model while one is already active; show total storage used across all downloaded models.
- [ ] **112.** Add a plain-language "why do I need this / what to expect" explainer before first download.
- [ ] **113.** Test backgrounding the app partway through a download — confirm progress UI resumes reflecting real state.
- [ ] **114.** Test fully killing the app mid-download — confirm the `.part`-file-based `PAUSED` detection correctly offers "Resume," not a silent restart-from-zero.
- [ ] **115.** Consider mirroring the 3 GGUF files to your own object storage (S3/R2) for more predictable delivery than direct-from-Hugging-Face mobile downloads at scale.
- [ ] **116.** If mirroring, keep the original HF URL documented as fallback and re-verify checksums whenever the upstream model version changes.
- [ ] **117.** Confirm `llama.rn@0.9.7`'s documented minimum OS/API requirements against your `minSdkVersion 24`, rather than assuming full compatibility.
- [ ] **118.** Explicitly test on at least one 32-bit-only (`armeabi-v7a`) budget device, common in your target market.
- [ ] **119.** Add a one-time on-device speed benchmark after first load, and show the user a realistic tokens/sec expectation.
- [ ] **120.** Document the full download-to-inference state machine as an explicit diagram in `CODE_EXPLANATION.md`.
- [ ] **121.** Add automated tests (mocked `RNFS`) for: fresh download, resume-from-partial, corrupted-redownload, storage-insufficient, and the new RAM-insufficient rejection.
- [ ] **122.** Add a full "reset LLM feature" option in Settings (delete all models, clear related state).
- [ ] **123.** Confirm graceful (not crashing) behavior under Android work-profile/multi-user-profile restrictions.
- [ ] **124.** Load-test the download flow against a deliberately throttled/flaky network.
- [ ] **125.** Have 5–10 real beta users on a genuine device-tier mix go through download → load → first chat end-to-end before wider rollout.

## Phase 6 — LLM Inference Runtime Hardening (Steps 126–145)

- [ ] **126.** Unload the model to free RAM when the AI Chat tab loses focus for an extended period.
- [ ] **127.** Add an `onTrimMemory`-style RAM-pressure listener that proactively unloads the model under OS memory pressure.
- [ ] **128.** Avoid having the LLM model and the 3D pet WebView both resident/active simultaneously where possible — your two heaviest RAM/GPU consumers.
- [ ] **129.** Distinguish "model loading into RAM" from "model generating" in the chat UI — conflating them reads as a frozen app to users unfamiliar with on-device inference.
- [ ] **130.** Confirm `AiAdvisorScreen.tsx` actually renders the existing `onToken` stream incrementally, not just the final result.
- [ ] **131.** Confirm the existing `cancelBonsaiGeneration()` is reachable via a visible button at all times during generation.
- [ ] **132.** Make the 45-second timeout dynamic (proportional to model size / the step-119 benchmark) instead of one fixed ceiling for every device.
- [ ] **133.** Confirm a native-level crash during `context.completion()` can't take down the whole app, not just fail one JS promise.
- [ ] **134.** Handle long conversations approaching/exceeding the fixed 2048-token context window explicitly.
- [ ] **135.** Add graceful history truncation/summarization instead of relying solely on a fixed "last 6 messages" slice.
- [ ] **136.** Confirm `buildFinancialSystemPrompt()` can't itself balloon unbounded for a long-history power user, eating most of the context budget before the conversation starts.
- [ ] **137.** Replace the generic "Model Memory Load Error" message with a concrete next action (try a smaller model, free storage, restart).
- [ ] **138.** Add a deterministic keyword-based post-check on generated output as a second guardrail layer beyond the system prompt alone — small on-device models follow instructions less reliably than large cloud ones.
- [ ] **139.** Apply the same "not financial advice" disclaimer discipline to `AIAdvisorService.ts`'s rule-based "Actionable Advice" text — currently the LLM path has this guard and the (likely more-used) rule-based path doesn't.
- [ ] **140.** Add a persistent, low-key disclaimer footer anywhere AI- or rule-based "advice"-framed text is shown to the user, not just inside the invisible system prompt.
- [ ] **141.** Log locally, in aggregate, how often the step-138 keyword-check actually fires, as real evidence of whether the small model drifts advisory over time.
- [ ] **142.** Test conversation quality specifically in Hindi/Hinglish or common code-mixed input from your actual user base before treating this as launch-ready.
- [ ] **143.** Add a thumbs up/down feedback affordance on individual AI responses.
- [ ] **144.** Communicate battery impact somewhere reasonable — sustained CPU-only inference is genuinely battery-intensive.
- [ ] **145.** Re-run the low-spec-device test through a full sustained chat conversation, not just app launch.

## Phase 7 — Systematic Edge Case Coverage (Steps 146–175)

- [ ] **146.** Airplane mode at every stage: launch, mid-SMS-parse, mid-download, mid-inference.
- [ ] **147.** Storage-full mid-download — confirm graceful halt, no corrupted partial file.
- [ ] **148.** Storage-full during normal SQLite writes — confirm a clear message, not silent data loss.
- [ ] **149.** Force-kill the process mid-transaction-save — confirm DB integrity on next launch.
- [ ] **150.** Rapid repeated taps on pet interaction buttons — confirm no double-processing race condition.
- [ ] **151.** Switch species mid-animation — confirm no orphaned animation loops or WebView desync.
- [ ] **152.** Background the app during the Evolution Ceremony — confirm no stuck/frozen celebration on return.
- [ ] **153.** Re-verify dual-SIM SMS capture hasn't regressed from the new native module additions.
- [ ] **154.** Non-English, non-Hindi device locale — confirm currency/number formatting doesn't break.
- [ ] **155.** Very large transaction history (2+ years) — confirm LLM context-building and analytics don't degrade badly.
- [ ] **156.** Zero transaction history — confirm sensible empty states everywhere, not errors.
- [ ] **157.** Zero/negative monthly budget — confirm no divide-by-zero in pacing/mood logic.
- [ ] **158.** Timezone changes mid-session (travel) — confirm day-boundary streak logic doesn't double-count or skip.
- [ ] **159.** Manual clock rollback — confirm streak logic can't be gamed or silently broken.
- [ ] **160.** Biometric-lock backgrounding during model loading — confirm no stuck "loading" state on return.
- [ ] **161.** SMS permission denied entirely — confirm full app (including pet/AI) still works via manual entry.
- [ ] **162.** Notification permission denied (Android 13+) if required by the Phase 5 foreground-service download — confirm clear fallback.
- [ ] **163.** Google Sign-In token expiry mid-long-chat or mid-long-download — confirm no lost in-progress state.
- [ ] **164.** Confirm whether `BackupService.ts` includes `tamagotchi`/`petsData`, or explicitly document that pet progress is device-local-only.
- [ ] **165.** Reinstall — confirm no stale "model READY" state survives when the actual file (in `DocumentDirectoryPath`) is gone.
- [ ] **166.** Test on at least one MIUI/ColorOS device specifically — aggressive OEM battery managers may kill downloads/foreground services beyond stock Android behavior.
- [ ] **167.** Same account logged in on two devices — confirm no corruption in shared backend state.
- [ ] **168.** Extremely long user chat input — confirm graceful truncation, not a crash or garbled reply.
- [ ] **169.** A few basic prompt-injection attempts against the "not a financial advisor" instruction — confirm the step-138 keyword check catches obvious drift.
- [ ] **170.** Screen rotation mid-3D-interaction or mid-generation — confirm state survives without restarting from scratch.
- [ ] **171.** Battery-saver mode's CPU throttling — confirm inference doesn't routinely blow the timeout in this state without a proactive warning.
- [ ] **172.** Full TalkBack navigation across the entire pet + AI chat journey, not just isolated screens.
- [ ] **173.** Extreme OS font-size settings — confirm text-heavy screens reflow without clipping.
- [ ] **174.** Measure actual cold-start time-to-interactive on a low-spec device versus your pre-pet-system baseline.
- [ ] **175.** Write every edge case above into an actual `TEST_PLAN.md` or test suite — a list that only lives in chat gets forgotten.

## Phase 8 — Testing Strategy (Steps 176–190)

- [ ] **176.** Expand Jest coverage to `TamagotchiService.ts` and `BonsaiModelDownloader.ts`'s state machine (mocked `RNFS`).
- [ ] **177.** Add an integration test for the full "transaction logged → gamification update → pet state changed" pipeline now that Phase 2 reconnects it.
- [ ] **178.** Set up Maestro (lower config overhead than Detox for a solo dev) for core end-to-end flows.
- [ ] **179.** Add a Maestro flow for the full LLM download → load → chat journey specifically — your longest, most stateful, most failure-prone flow.
- [ ] **180.** Build a real 3–4 device "lab" spanning low/mid/high RAM tiers and at least one older OS version; run Phase 7's checklist against each before every release.
- [ ] **181.** Write a `RELEASE_CHECKLIST.md` (clean rebuild test, low-spec smoke test, LLM smoke test, `KNOWN_ISSUES.md` skim).
- [ ] **182.** Add GitHub Actions CI running the Jest suite on every PR.
- [ ] **183.** Add a slower, manually-triggerable CI job doing a full Android debug build to catch native-linking failures automatically.
- [ ] **184.** Write explicit regression tests for the two confirmed bugs in this audit (disconnected gamification, stale `DEFAULT_MODEL_PATH`).
- [ ] **185.** Add a test asserting no Pokémon/Digimon strings exist anywhere in species definitions or dialogue — turns Phase 3 into a permanent guarantee.
- [ ] **186.** Turn the flaky-network download test into a repeatable, automated scenario.
- [ ] **187.** Add snapshot tests for the Three.js scene structure per species/stage combination.
- [ ] **188.** Recruit real beta testers on budget 2–3GB RAM devices specifically, not just friends/family on flagship phones.
- [ ] **189.** Set a concrete numeric release bar (e.g., zero crashes over a week across your device matrix, a target LLM download-success rate, all Phase 7 cases verified once).
- [ ] **190.** Keep `KNOWN_ISSUES.md`/`TEST_PLAN.md` alive as living documents, not one-time artifacts from this incident.

## Phase 9 — Rollout & Monitoring (Steps 191–202)

- [ ] **191.** Ship to the internal testing track first, regardless of how confident local testing feels.
- [ ] **192.** Use Play Console's staged rollout percentages (10% → 50% → 100%), given this release touches native modules and a previously crash-prone area.
- [ ] **193.** Watch Crashlytics closely for 48–72 hours at each stage before advancing; halt immediately if crash rate rises.
- [ ] **194.** Keep the Phase 1 kill switch ready to disable just the AI/LLM feature if it's the specific source of any spike.
- [ ] **195.** Prepare rollback instructions (exact previous APK/AAB to re-promote) before you need them.
- [ ] **196.** Write release notes setting realistic device expectations for the AI chat feature rather than overselling it.
- [ ] **197.** Add a "What's New" surface explaining the redesigned pet system, since existing users' pets will look/behave differently.
- [ ] **198.** Monitor real download-success telemetry for a couple of weeks post-launch to confirm Phase 5's hardening actually improved real-world completion rates.
- [ ] **199.** Revisit the Phase 8 "done" bar a few weeks post-release with real production data; treat any gap as the start of the next iteration.
- [ ] **200.** Circle back to deferred polish (real 3D models, photo mode, localization, unlock-system depth) as the next roadmap pass, now that the foundation is verified solid.
- [ ] **201.** Given BillEase is your primary focus, honestly timebox this plan: Phases 0–2 are non-negotiable near-term work; Phases 3–4 matter but can slip slightly; Phases 5–6 matter most only if the on-device AI chat is genuinely core to your positioning — decide deliberately given the ongoing support burden a multi-GB local LLM feature carries for a one-person team.
- [ ] **202.** Re-read this whole plan after Phase 2 is actually done and re-prioritize what's left against real crash/usage data — treat this as a strong first draft to execute against and revise, not a fixed contract.
