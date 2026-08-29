#!/usr/bin/env node

/**
 * generate-insert-sql.mjs — Generate batched INSERT SQL from staging data
 * 
 * Reads the staging JSON and outputs SQL INSERT statements that can be
 * executed via Supabase MCP or SQL Editor.
 * 
 * Usage:
 *   node scripts/generate-insert-sql.mjs --batch 0    # First 500 rows
 *   node scripts/generate-insert-sql.mjs --batch 1    # Next 500 rows
 *   node scripts/generate-insert-sql.mjs --count       # Show total batch count
 *   node scripts/generate-insert-sql.mjs --detail-batch 0  # First 500 detail rows
 */

import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const STAGING_DIR = join(__dirname, '..', 'data', 'staging');
const BATCH_SIZE = 200;

const args = process.argv.slice(2);

/**
 * Escape a string for PostgreSQL single-quoted literals.
 * Handles null, undefined, and special characters.
 */
function escSql(val) {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
  if (typeof val === 'number') return String(val);
  if (typeof val === 'object') {
    // JSONB — escape as a JSON string literal
    const json = JSON.stringify(val);
    return `'${json.replace(/'/g, "''")}'::jsonb`;
  }
  // Plain string
  return `'${String(val).replace(/'/g, "''")}'`;
}

if (args.includes('--count')) {
  const index = JSON.parse(readFileSync(join(STAGING_DIR, 'tc-index.json'), 'utf-8'));
  const indexBatches = Math.ceil(index.length / BATCH_SIZE);
  
  const detailFiles = readdirSync(join(STAGING_DIR, 'tc-lang')).filter(f => f.endsWith('.json'));
  const detailBatches = Math.ceil(detailFiles.length / BATCH_SIZE);
  
  console.log(JSON.stringify({
    indexRows: index.length,
    indexBatches,
    detailFiles: detailFiles.length,
    detailBatches,
    batchSize: BATCH_SIZE
  }));
  process.exit(0);
}

if (args.includes('--batch')) {
  const batchNum = parseInt(args[args.indexOf('--batch') + 1]);
  const index = JSON.parse(readFileSync(join(STAGING_DIR, 'tc-index.json'), 'utf-8'));
  const start = batchNum * BATCH_SIZE;
  const batch = index.slice(start, start + BATCH_SIZE);
  
  if (batch.length === 0) {
    console.log('-- No rows in this batch');
    process.exit(0);
  }

  const columns = [
    'code', 'name', 'native_name', 'family', 'genus', 'macroarea', 'is_isolate',
    'speakers', 'speaker_count', 'script', 'script_name', 'scripts', 'dir',
    'vitality_badge', 'rarity', 'rarity_order', 'challenge_rating', 'digital_toolkit',
    'abilities', 'stats', 'pipeline_label', 'pipeline_emoji',
    'fact_count', 'source_count',
    'has_vocabulary', 'has_typology', 'has_phonology', 'has_nearest',
    'has_natural_pair', 'has_cultural', 'has_conflicts',
    'dialect_count', 'regions', 'ancestry', 'glottocode', 'cultural_aphorism'
  ];

  let sql = `INSERT INTO trading_card_index (${columns.join(', ')}) VALUES\n`;
  
  const valueRows = batch.map(e => {
    const vals = [
      escSql(e.code), escSql(e.name), escSql(e.nativeName || null),
      escSql(e.family || null), escSql(e.genus || null), escSql(e.macroarea || null),
      escSql(e.isIsolate || false),
      escSql(e.speakers || null), escSql(e.speakerCount ?? null),
      escSql(e.script || null), escSql(e.scriptName || null),
      escSql(e.scripts || []), escSql(e.dir ?? null),
      escSql(e.vitalityBadge || {}), escSql(e.rarity || {}),
      escSql(e.rarityOrder ?? null), escSql(e.stats || {}), escSql(e.digitalToolkit || {}),
      escSql(e.abilities || []), escSql(e.stats || null),
      escSql(e.pipelineLabel || null), escSql(e.pipelineEmoji || null),
      escSql(e.factCount ?? null), escSql(e.sourceCount ?? null),
      escSql(e.hasVocabulary || false), escSql(e.hasTypology || false),
      escSql(e.hasPhonology || false), escSql(e.hasNearest || false),
      escSql(e.hasNaturalPair || false), escSql(e.hasCultural || false),
      escSql(e.hasConflicts || false),
      escSql(e.dialectCount ?? null), escSql(e.regions || []),
      escSql(e.ancestry || []), escSql(e.glottocode || null),
      escSql(e.culturalAphorism || null)
    ];
    return `(${vals.join(', ')})`;
  });

  sql += valueRows.join(',\n');
  sql += `\nON CONFLICT (code) DO UPDATE SET\n`;
  sql += columns.filter(c => c !== 'code').map(c => `  ${c} = EXCLUDED.${c}`).join(',\n');
  sql += `,\n  updated_at = NOW();\n`;
  
  console.log(sql);
  process.exit(0);
}

if (args.includes('--detail-batch')) {
  const batchNum = parseInt(args[args.indexOf('--detail-batch') + 1]);
  const langDir = join(STAGING_DIR, 'tc-lang');
  const files = readdirSync(langDir).filter(f => f.endsWith('.json')).sort();
  const start = batchNum * BATCH_SIZE;
  const batch = files.slice(start, start + BATCH_SIZE);

  if (batch.length === 0) {
    console.log('-- No rows in this batch');
    process.exit(0);
  }

  let sql = `INSERT INTO trading_card_detail (code, detail, fact_count, source_count) VALUES\n`;
  
  const valueRows = batch.map(file => {
    const code = file.replace('.json', '');
    const detail = JSON.parse(readFileSync(join(langDir, file), 'utf-8'));
    const factCount = detail.provenance?.totalFacts || 0;
    const sourceCount = detail.provenance?.sources?.length || 0;
    return `(${escSql(code)}, ${escSql(detail)}, ${escSql(factCount)}, ${escSql(sourceCount)})`;
  });

  sql += valueRows.join(',\n');
  sql += `\nON CONFLICT (code) DO UPDATE SET\n`;
  sql += `  detail = EXCLUDED.detail,\n`;
  sql += `  fact_count = EXCLUDED.fact_count,\n`;
  sql += `  source_count = EXCLUDED.source_count,\n`;
  sql += `  updated_at = NOW();\n`;

  console.log(sql);
  process.exit(0);
}

console.error('Usage: --count | --batch N | --detail-batch N');
process.exit(1);
