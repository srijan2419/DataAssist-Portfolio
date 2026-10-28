# DataAssist — AI-Assisted Training Operations & Decision Support

**Desktop application • Local-first data workflows • Guarded AI-to-SQL • Constraint-based planning**

DataAssist is an operations-management and analytics application developed through SrijanAI Innovations for a specialized training environment. It combines trainee/course records, scheduling, performance reporting, allocation planning, and AI-assisted questions over structured data.

> **Real application code, not a generic chatbot.** This portfolio highlights a curated implementation from an **Electron + SQLite + React/TypeScript** system. User and institutional identifiers, deployment assets, real datasets, and customer configuration are intentionally excluded.

## 30-second overview

| | |
| --- | --- |
| **Problem** | Complex training organizations need to track people, course capacity, performance, and allocation constraints across many operational records. |
| **System** | Desktop data-management workflow with role-based screens, local database, operational analytics, allocation recommendations, and structured-data Q&A. |
| **Engineering focus** | Guarding LLM-generated queries, restricting SQL to approved reads, managing local data and role access, combining rule-based allocations with analytics. |
| **Technologies** | **Electron, TypeScript, React, Vite, SQLite (better-sqlite3), local LM Studio integration, IPC, Vitest, Recharts.** |
| **Portfolio scope** | Curated authentic source files, select tests, and architecture notes; **not a complete customer distribution or real dataset**. |

## Start with the actual engineering

| System | Code | What matters |
| --- | --- | --- |
| AI-assisted analytics | [AI query service](src/desktop/electron/services/ai-query.service.ts) | Structured query planning, SQL validation, query policy, safe execution, response formatting and fallbacks |
| Local inference adapter | [LM Studio integration](src/desktop/electron/services/ai.service.ts) · [tests](src/desktop/electron/services/ai.service.test.ts) | Local HTTP model availability, chat request handling, and language-based output checks |
| Data boundaries | [SQLite schema](src/desktop/electron/database/schema.ts) · [schema tests](src/desktop/electron/database/schema.test.ts) | Structured data and evolution of the local database |
| Desktop bridge | [AI IPC handlers](src/desktop/electron/ipc/ai.ipc.ts) · [Allocation IPC handlers](src/desktop/electron/ipc/allocations.ipc.ts) | Separating renderer requests from privileged desktop data operations |
| Planning algorithm | [Constraint allocation engine](src/frontend/lib/allocationEngine.ts) · [anonymized tests](src/frontend/lib/allocationEngine.test.ts) | Rule scoring, capacity constraints, explainable allocation decisions |
| Allocation persistence | [Allocation service](src/desktop/electron/services/allocation.service.ts) | Deriving training metrics, saving and reviewing allocation runs |
| Executive analytics | [Dashboard aggregation service](src/desktop/electron/services/command-dashboard.service.ts) | Operational KPIs, status/alerts, trends and derived reports |
| Operator-facing UI | [Predictive allocations](src/frontend/pages/PredictiveAllocations.tsx) · [Executive metrics](src/frontend/components/analytics/ExecutiveMetricGrid.tsx) | Interactive decisions and summaries |
| Visualization | [Forecast chart](src/frontend/components/analytics/ForecastTrendChart.tsx) · [Training pipeline](src/frontend/components/analytics/TrainingPipelineFunnel.tsx) | Reporting data and filtering |

[**Read the engineering deep dive →**](ENGINEERING_NOTES.md)

## Architecture

~~~mermaid
flowchart TD
    USER["Operations analyst / authorized user"] --> UI["React / TypeScript desktop UI"]
    UI --> IPC["Electron IPC handlers"]
    IPC --> AUTH["Role checks / desktop service boundaries"]
    AUTH --> DB[("Local SQLite database")]
    IPC --> QUERY["AI query policy + validation"]
    QUERY --> LLM["Local LM Studio model (when available)"]
    LLM --> QUERY
    QUERY --> DB
    IPC --> ALLOC["Constraint-based allocation engine"]
    ALLOC --> DB
    DB --> ANALYTICS["Dashboard aggregation services"]
    ANALYTICS --> UI
    ALLOC --> UI
    QUERY --> UI
~~~

This is a **conceptual view** of the system. Not every integration module is redistributed in this subset.

## Engineering talking points

1. **LLM-to-SQL guardrails:** Validate generated SQL before execution, restrict tables and query shapes, and return grounded database results rather than fabricated numbers.
2. **Local-first architecture:** Why desktop IPC and local SQLite are useful when central cloud infrastructure is not the primary design.
3. **Allocation as constrained optimization:** Keep allocation rules explicit and give decision-makers inspectable justifications.
4. **Trusted UI boundaries:** Implement role-aware access around desktop operations, rather than treating frontend visibility alone as authorization.
5. **Analytics engineering:** Derive operational KPIs, alerts and trends from recorded facts.

## What's intentionally *not* claimed

The older product documentation described a frontend mock/demo phase; the **reviewed repository now also contains Electron backend and SQLite services**. This showcase focuses on those actual implementations. Neither included charts nor rule-based scores prove independently validated predictive accuracy. An LM Studio adapter demonstrates local-LLM integration; its presence does not mean every response is generated by an LLM or that a proprietary model was trained.

No real trainee records, institutional identifiers, rank/identity data, sample databases, keys, distribution binaries, or customer screenshots have been copied. Source paths retain imports to omitted modules, so the portfolio is **not a standalone build**. Files are shared with a new Git history for review only.

**Implementation:** Srijan Choudhary / SrijanAI Innovations.  
**Source rights:** Application-specific code is shared for portfolio review, without granting redistribution rights; third-party dependencies retain their own licenses.
