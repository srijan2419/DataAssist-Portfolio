# DataAssist — Engineering Deep Dive

This is an implementation-centered technical walkthrough of the **curated Electron/TypeScript portfolio edition**. No complete source tree, working customer database, distribution installer, or measured quality benchmarks are provided.

## 1. Why a desktop data layer?

The original project evolved beyond its earlier frontend prototype documentation to include **Electron IPC handlers and a local SQLite application database**.

The [schema module](src/desktop/electron/database/schema.ts) defines and evolves operational tables, while the [schema tests](src/desktop/electron/database/schema.test.ts) demonstrate migration/invariant intent. The [AI IPC handlers](src/desktop/electron/ipc/ai.ipc.ts) and [allocation IPC handlers](src/desktop/electron/ipc/allocations.ipc.ts) expose privileged data operations to the frontend through bounded messages.

This is a useful talking point about avoiding uncontrolled direct access to files/databases from a browser-renderer UI.

## 2. Natural-language analysis without unrestricted SQL execution

Start with [ai-query.service.ts](src/desktop/electron/services/ai-query.service.ts).

The service defines a limited database schema catalog, parses the model's proposed plan, validates SQL shape and permitted tables, applies policy to result limits, executes approved reads against SQLite, and constructs tabular/aggregate/chart responses. Row redaction and refusal/fallback paths are visible in the code.

The [LM Studio adapter](src/desktop/electron/services/ai.service.ts) checks whether a local service is available and sends model messages via HTTP; [tests](src/desktop/electron/services/ai.service.test.ts) exercise associated logic. The existence of validation reduces risk but **is not proof that arbitrary malicious SQL or prompt injection has been exhaustively ruled out**.

The wording **AI-assisted SQL** is deliberate: the system combines local model planning with deterministic database and fallback behavior. It should not be represented as inventing a new language model.

## 3. Allocation is explicit logic, not magic prediction

The [allocation engine](src/frontend/lib/allocationEngine.ts) takes course/capacity and per-organization metrics, scores candidates, evaluates constraints, and returns inspectable recommendations.

The [allocation service](src/desktop/electron/services/allocation.service.ts) gathers persisted inputs and saves allocation runs. The [allocation IPC route](src/desktop/electron/ipc/allocations.ipc.ts) applies a role gate before privileged allocation actions. The [unit tests](src/frontend/lib/allocationEngine.test.ts) use **anonymized illustrative organization labels**.

These are **constraint-driven decision-support calculations**, not demonstrated statistical forecasts or guarantees about the right person getting a course assignment.

## 4. Operational analytics and UI

The [dashboard aggregation service](src/desktop/electron/services/command-dashboard.service.ts) assembles metrics, alerts, comparisons and trends. The [executive metrics component](src/frontend/components/analytics/ExecutiveMetricGrid.tsx), [pipeline](src/frontend/components/analytics/TrainingPipelineFunnel.tsx), and [forecast-trend view](src/frontend/components/analytics/ForecastTrendChart.tsx) show how those structures reach operators.

The [allocations page](src/frontend/pages/PredictiveAllocations.tsx) illustrates how computed recommendations are reviewed and acted upon. The chart name *forecast* reflects the UI artifact; the source does not independently establish validated predictive accuracy.

## 5. Role-aware implementation

[Role definitions](src/desktop/electron/auth/roles.ts) and [shared role contracts](src/desktop/shared/roles.ts) make role boundaries explicit. In this curated code, IPC handlers check permissions before triggering sensitive workflows.

Role-aware modules demonstrate implemented checks, but do not by themselves establish a comprehensive security audit of the whole desktop application.

## 6. Scope and sanitization

The original repository is **read-only and unchanged**. We used a fresh portfolio history and selected only code needed to explain engineering. Tests containing organization names were anonymized; real user data, customer-specific organizational identities, seed databases, exports, installer/config credentials, and internal operating files are omitted.

This curated subset imports other files that are not included, so it **cannot be built or run independently**. No claims are made about deployment numbers, independent penetration testing, measured model accuracy, training duration, or demonstrated enterprise scale.

Return to [README.md](README.md) for the concise case study.
