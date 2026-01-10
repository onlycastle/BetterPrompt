import 'dotenv/config';
import { getEvaluationJsonSchema, getEvaluationTool } from '../src/analyzer/schema-converter.js';

console.log('=== JSON Schema ===');
console.log(JSON.stringify(getEvaluationJsonSchema(), null, 2));

console.log('\n=== Tool Definition ===');
console.log(JSON.stringify(getEvaluationTool(), null, 2));
