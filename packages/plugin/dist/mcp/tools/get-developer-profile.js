/**
 * get_developer_profile MCP Tool
 *
 * Returns the developer's AI collaboration profile:
 * primaryType, controlLevel, domain scores, personality summary.
 */
export const definition = {
    name: 'get_developer_profile',
    description: 'Get the current developer\'s AI collaboration profile — their primary type ' +
        '(architect/analyst/conductor/speedrunner/trendsetter), control level ' +
        '(navigator/collaborator/delegator), domain scores (0-100), and a brief ' +
        'personality summary. Use this to understand how the developer works with AI.',
    inputSchema: {
        type: 'object',
        properties: {},
        required: [],
    },
};
export function formatResult(summary) {
    if (!summary) {
        return JSON.stringify({
            status: 'no_data',
            message: 'No analysis available yet. The developer needs to run at least one analysis first.',
        });
    }
    const { profile } = summary;
    return JSON.stringify({
        primaryType: profile.primaryType,
        controlLevel: profile.controlLevel,
        matrixName: profile.matrixName,
        personalitySummary: profile.personalitySummary,
        domainScores: profile.domainScores,
        analyzedAt: summary.analyzedAt,
    });
}
//# sourceMappingURL=get-developer-profile.js.map