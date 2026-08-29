#!/usr/bin/env node

/**
 * upload-via-sql.mjs — Upload staging data to Supabase using raw SQL
 *
 * Generates INSERT SQL from staging data and writes it to batch files
 * that can be executed via the Supabase MCP's execute_sql tool.
 *
 * This is the "no service key needed" path — the MCP server already
 * has elevated access to the database.
 *
 * Usage:
 *   node scripts/upload-via-sql.mjs              # Generate all batch files
 *   node scripts/upload-via-sql.mjs --index-only  # Index batches only
 *   node scripts/upload-via-sql.mjs --detail-only  # Detail batches only
 */

import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const STAGING_DIR = join(__dirname, '..', 'data', 'staging');
const SQL_DIR = join(__dirname, '..', 'data', 'sql-batches');

// Keep batches small enough for MCP execute_sql
const INDEX_BATCH_SIZE = 200;
const DETAIL_BATCH_SIZE = 50;  // Detail rows are much larger (JSONB blobs)

const args = process.argv.slice(2);
const indexOnly = args.includes('--index-only');
const detailOnly = args.includes('--detail-only');

/**
 * Escape a value for PostgreSQL literal insertion.
 */
function escSql(val) {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
  if (typeof val === 'number') return String(val);
  if (typeof val === 'object') {
    const json = JSON.stringify(val);
    return `'${json.replace(/'/g, "''")}'::jsonb`;
  }
  return `'${String(val).replace(/'/g, "''")}'`;
}

function main() {
  mkdirSync(SQL_DIR, { recursive: true });
  
  if (!detailOnly) {
    console.log('── Generating index batch files ──');
    const index = JSON.parse(readFileSync(join(STAGING_DIR, 'tc-index.json'), 'utf-8'));
    const indexBatches = Math.ceil(index.length / INDEX_BATCH_SIZE);
    
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
    
    for (let b = 0; b < indexBatches; b++) {
      const batch = index.slice(b * INDEX_BATCH_SIZE, (b + 1) * INDEX_BATCH_SIZE);
      
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
      
      const filename = `index_batch_${String(b).padStart(3, '0')}.sql`;
      writeFileSync(join(SQL_DIR, filename), sql);
      if ((b + 1) % 10 === 0 || b === indexBatches - 1) {
        console.log(`  ${b + 1}/${indexBatches} index batches written`);
      }
    }
  }
  
  if (!indexOnly) {
    console.log('── Generating detail batch files ──');
    const langDir = join(STAGING_DIR, 'tc-lang');
    const files = readdirSync(langDir).filter(f => f.endsWith('.json')).sort();
    const detailBatches = Math.ceil(files.length / DETAIL_BATCH_SIZE);
    
    for (let b = 0; b < detailBatches; b++) {
      const batch = files.slice(b * DETAIL_BATCH_SIZE, (b + 1) * DETAIL_BATCH_SIZE);
      
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
      
      const filename = `detail_batch_${String(b).padStart(3, '0')}.sql`;
      writeFileSync(join(SQL_DIR, filename), sql);
      if ((b + 1) % 20 === 0 || b === detailBatches - 1) {
        console.log(`  ${b + 1}/${detailBatches} detail batches written`);
      }
    }
  }
  
  // Summary
  const sqlFiles = readdirSync(SQL_DIR).filter(f => f.endsWith('.sql')).sort();
  const totalSize = sqlFiles.reduce((sum, f) => {
    const stat = readFileSync(join(SQL_DIR, f));
    return sum + stat.length;
  }, 0);
  
  console.log(`\n── Done ──`);
  console.log(`  ${sqlFiles.length} SQL batch files in ${SQL_DIR}`);
  console.log(`  Total SQL size: ${(totalSize / 1024 / 1024).toFixed(1)} MB`);
  console.log(`\nRun execute-sql-batches.mjs to upload via Supabase MCP,`);
  console.log(`or paste batch files into the Supabase SQL Editor.`);
}

main();
