import { readFileSync, writeFileSync } from 'node:fs';
import { normalizeEvents } from '../js/eventOps.js';

const [, , input, output] = process.argv;
if (!input || !output) {
  console.error('usage: node scripts/migrate-v2.mjs <input.json> <output.json>');
  process.exit(1);
}
const source = JSON.parse(readFileSync(input, 'utf8'));
const migrated = normalizeEvents(source);
const doneCount = source.filter((e) => e.completed === true).length;
writeFileSync(output, `${JSON.stringify(migrated, null, 2)}\n`);
console.log(`input ${source.length} events, completed:true ${doneCount}, output ${migrated.length} series`);
