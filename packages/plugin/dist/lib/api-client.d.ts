/**
 * API Client
 *
 * HTTP client for communicating with the BetterPrompt server.
 * Authentication is no longer required — all endpoints work without tokens.
 */
export interface UserSummary {
    resultId: string;
    analyzedAt: string;
    profile: {
        primaryType: string;
        controlLevel: string;
        matrixName: string;
        personalitySummary: string;
        domainScores: Record<string, number>;
    };
    growthAreas: Array<{
        title: string;
        domain: string;
        severity: string;
        recommendation: string;
    }>;
    strengths: Array<{
        domain: string;
        domainLabel: string;
        topStrength: string;
        domainScore: number;
    }>;
    antiPatterns: Array<{
        pattern: string;
        frequency: number;
        impact: string;
    }>;
    kpt: {
        keep: string[];
        problem: string[];
        tryNext: string[];
    };
}
export interface ApiError {
    error: string;
    message: string;
}
/**
 * Fetch the user's analysis summary from the server.
 * Returns null if no analysis exists yet.
 * Throws on network or auth errors.
 */
export declare function fetchUserSummary(): Promise<UserSummary | null>;
/**
 * Verify server connectivity by hitting /api/auth/me.
 * No authentication required — always succeeds if server is reachable.
 */
export declare function verifyAuth(): Promise<{
    id: string;
    email: string;
} | null>;
