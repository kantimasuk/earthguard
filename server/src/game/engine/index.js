// จุดรวม export ของเอนจินเกม (import จากที่นี่ที่เดียว)
export { Engine, STAGE, LINES, LINE_TH, START_COINS } from './engine.js';
export { buildCatalog, catalogForClient, SYMBOLS, NUMBERS, SYMBOL_TH, NUMBER_TH, ABILITY_TH } from './catalog.js';
export { SmartAI, SimpleAI, RandomAI } from './ai.js';
export { describe } from './describe.js';
export { newSeed } from './rng.js';
export * as analysis from './analysis.js';
