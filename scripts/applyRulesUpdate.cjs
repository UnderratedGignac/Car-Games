const fs = require('fs');
const path = require('path');

const rulesPath = path.join(__dirname, '..', 'src', 'game', 'rules.ts');
const headerPath = path.join(__dirname, 'generatedRulesHeader.ts');

const rulesContent = fs.readFileSync(rulesPath, 'utf8');
const headerContent = fs.readFileSync(headerPath, 'utf8');

const markerStart = 'export type DiagonalDirection = \'right\' | \'left\';';
const markerEnd = 'export function resolveCarAppearance(';

const startIndex = rulesContent.indexOf(markerStart);
const endIndex = rulesContent.indexOf(markerEnd);

if (startIndex === -1 || endIndex === -1) {
  throw new Error(`Markers not found! startIndex: ${startIndex}, endIndex: ${endIndex}`);
}

const newRulesContent = rulesContent.slice(0, startIndex) + headerContent.trim() + '\n\n' + rulesContent.slice(endIndex);

fs.writeFileSync(rulesPath, newRulesContent, 'utf8');
console.log('Successfully updated src/game/rules.ts with 90 cars and expanded customization options!');
