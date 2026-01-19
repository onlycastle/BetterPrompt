graph TD
    Start((App Launch)) --> Scan[Local Scan]
    Scan --> Redact[Privacy Redaction]
    Redact --> Approve[User Approves]
    
    Approve --> Analysis[<b>The Agentic Theater</b>]
    
    subgraph "3-Stage Parallel Pipeline"
        Analysis --> MA[Module A: Data Analyst]
        
        %% Parallel Section
        MA --> P_Start{Parallel Processing}
        
        P_Start --> AG[<b>Specialized Agents</b><br/>Eco / Peer / Lib]
        P_Start --> MB[<b>Module B</b><br/>Personality Analyst]
        
        AG --> P_End{Join}
        MB --> P_End
        %% End Parallel
        
        P_End --> S2[Stage 2: Content Writer]
    end
    
    S2 --> Dash[Dashboard]