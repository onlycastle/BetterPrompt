classDiagram
    class SessionParser {
        +String logPath
        +parse(File) ParsedSession
        -redactPII(String) String
    }

    class DataAnalyst {
        +Model model
        +analyze(ParsedSession) StructuredAnalysisData
        -extractMetrics() SessionMetrics
        -detectPatterns() List~Pattern~
    }

    class PersonalityAnalyst {
        +MBTI_Framework mbti
        +Saju_Framework saju
        +profile(StructuredAnalysisData) PersonalityProfile
    }

    class KnowledgeLayer {
        +VectorDB vectorDB
        +retrieve(Query) List~Insight~
        +getGuruQuotes(Context) List~String~
    }

    class BaseAgent {
        <<abstract>>
        +KnowledgeLayer knowledge
        +process(StructuredAnalysisData) AgentInsight
    }

    class EconomicAgent {
        +calculateROI() float
        +findCostLeakage() List~Waste~
    }

    class PeerReviewAgent {
        +checkSecurity() List~Vulnerability~
        +evaluateLogic() List~Advice~
    }

    class ContextLibrarian {
        +HistoryDB history
        +findKnowledgeGaps() List~Gap~
        +linkPreviousSessions() List~Link~
    }

    class ContentWriter {
        +generateReport(AllInsights) VerboseEvaluation
        -synthesizeNarrative() String
    }

    class LectureNoteGenerator {
        +identifyRepeatedFailure() List~Topic~
        +createStudyGuide(Topic) LectureNote
    }

    %% Relationships
    SessionParser ..> DataAnalyst : provides sanitized data
    DataAnalyst --> SpecializedAgents : triggers
    BaseAgent <|-- EconomicAgent
    BaseAgent <|-- PeerReviewAgent
    BaseAgent <|-- ContextLibrarian
    BaseAgent o-- KnowledgeLayer : utilizes RAG
    
    ContentWriter o-- DataAnalyst
    ContentWriter o-- PersonalityAnalyst
    ContentWriter o-- BaseAgent : aggregates all
    ContentWriter *-- LectureNoteGenerator : uses