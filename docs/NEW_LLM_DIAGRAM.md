# Analysis Pipeline Class Diagram

> ⚠️ **DEPRECATED**: This document has been superseded by [LLM_FLOW.md](./LLM_FLOW.md).
>
> The original Module B (PersonalityAnalyst) has been removed.
> See LLM_FLOW.md for the current Orchestrator + Workers architecture.

## Current Architecture (2025-01)

```mermaid
classDiagram
    class AnalysisOrchestrator {
        +OrchestratorConfig config
        +BaseWorker[] phase1Workers
        +BaseWorker[] phase2Workers
        +ContentWriterStage contentWriter
        +analyze(sessions, metrics, tier) VerboseEvaluation
        +registerPhase1Worker(worker)
        +registerPhase2Worker(worker)
    }

    class BaseWorker {
        <<abstract>>
        +String name
        +Phase phase
        +execute(context) WorkerResult
        +canRun(context) boolean
    }

    class DataAnalystWorker {
        +phase: 1
        +execute(context) StructuredAnalysisData
    }

    class ProductivityAnalystWorker {
        +phase: 1
        +execute(context) ProductivityAnalysisData
    }

    class PatternDetectiveWorker {
        +phase: 2
        +execute(context) PatternDetectiveOutput
    }

    class AntiPatternSpotterWorker {
        +phase: 2
        +execute(context) AntiPatternSpotterOutput
    }

    class KnowledgeGapWorker {
        +phase: 2
        +execute(context) KnowledgeGapOutput
    }

    class ContextEfficiencyWorker {
        +phase: 2
        +execute(context) ContextEfficiencyOutput
    }

    class ContentWriterStage {
        +transform(data, sessions, productivity) VerboseLLMResponse
    }

    class ContentGateway {
        +filter(evaluation, tier) VerboseEvaluation
    }

    %% Relationships
    AnalysisOrchestrator o-- BaseWorker : registers workers
    BaseWorker <|-- DataAnalystWorker
    BaseWorker <|-- ProductivityAnalystWorker
    BaseWorker <|-- PatternDetectiveWorker
    BaseWorker <|-- AntiPatternSpotterWorker
    BaseWorker <|-- KnowledgeGapWorker
    BaseWorker <|-- ContextEfficiencyWorker

    AnalysisOrchestrator o-- ContentWriterStage
    AnalysisOrchestrator ..> ContentGateway : uses for filtering
```

## Phase Execution Flow

```
Phase 1 (Parallel)
├── DataAnalystWorker (Module A) ──→ StructuredAnalysisData
└── ProductivityAnalystWorker (Module C) ──→ ProductivityAnalysisData
         │
         ▼
Phase 2 (Parallel, Premium+ only)
├── PatternDetectiveWorker ──→ PatternDetectiveOutput
├── AntiPatternSpotterWorker ──→ AntiPatternSpotterOutput
├── KnowledgeGapWorker ──→ KnowledgeGapOutput
└── ContextEfficiencyWorker ──→ ContextEfficiencyOutput
         │
         ▼ (merged into AgentOutputs)

Phase 3
└── ContentWriterStage ──→ VerboseLLMResponse
         │
         ▼
ContentGateway.filter(tier) ──→ VerboseEvaluation (final)
```
