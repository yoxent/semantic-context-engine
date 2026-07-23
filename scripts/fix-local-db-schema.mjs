#!/usr/bin/env node
/**
 * Fix local .sce/metadata.sqlite schema by adding missing columns
 * Usage: node scripts/fix-local-db-schema.mjs [--dry-run]
 */

import { readdirSync, existsSync, statSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

const KNOWLEDGE_DIR = 'knowledge';
const DRY_RUN = process.argv.includes('--dry-run');

/**
 * Check if a column exists in a table
 */
function columnExists(dbPath, table, column) {
  try {
    const result = execSync(`sqlite3 "${dbPath}" "PRAGMA table_info(${table});"`, {
      encoding: 'utf-8'
    });
    return result.includes(`|${column}|`);
  } catch (e) {
    return false;
  }
}

/**
 * Add a column to a table if it doesn't exist
 */
function addColumn(dbPath, table, column, type) {
  if (!columnExists(dbPath, table, column)) {
    if (!DRY_RUN) {
      execSync(`sqlite3 "${dbPath}" "ALTER TABLE ${table} ADD COLUMN ${column} ${type};"`);
    }
    return true;
  }
  return false;
}

/**
 * Fix schema for a single topic
 */
function fixSchema(topicDir) {
  const dbPath = join(KNOWLEDGE_DIR, topicDir, '.sce', 'metadata.sqlite');
  
  if (!existsSync(dbPath)) {
    return { status: 'skip', reason: 'no database' };
  }
  
  const changes = [];
  
  // Add part_index column
  if (addColumn(dbPath, 'chunks', 'part_index', 'INTEGER')) {
    changes.push('part_index');
  }
  
  // Add total_parts column
  if (addColumn(dbPath, 'chunks', 'total_parts', 'INTEGER')) {
    changes.push('total_parts');
  }
  
  // Add heading_path column (for FTS)
  if (addColumn(dbPath, 'chunks', 'heading_path', 'TEXT')) {
    changes.push('heading_path');
  }
  
  return {
    status: changes.length > 0 ? 'fixed' : 'ok',
    changes
  };
}

/**
 * Main function
 */
function main() {
  console.log('🔧 Fixing local database schemas...\n');
  
  if (DRY_RUN) {
    console.log('⚠️  DRY RUN MODE - No changes will be made\n');
  }
  
  // Get all topic directories with .sce databases
  const topics = readdirSync(KNOWLEDGE_DIR).filter(item => {
    const itemPath = join(KNOWLEDGE_DIR, item);
    try {
      const stat = statSync(itemPath);
      if (!stat.isDirectory()) return false;
      return existsSync(join(itemPath, '.sce', 'metadata.sqlite'));
    } catch (e) {
      return false;
    }
  });
  
  console.log(`Found ${topics.length} topics with local databases`);
  
  const results = {
    fixed: [],
    ok: [],
    skip: []
  };
  
  for (const topic of topics) {
    const result = fixSchema(topic);
    
    if (result.status === 'fixed') {
      console.log(`✅ ${topic}: Added ${result.changes.join(', ')}`);
      results.fixed.push(topic);
    } else if (result.status === 'skip') {
      results.skip.push(topic);
    } else {
      results.ok.push(topic);
    }
  }
  
  // Summary
  console.log('\n📊 Summary:');
  console.log(`   ✅ Fixed: ${results.fixed.length}`);
  console.log(`   ✓  OK: ${results.ok.length}`);
  console.log(`   ⏭  Skipped: ${results.skip.length}`);
  
  if (DRY_RUN) {
    console.log('\n⚠️  DRY RUN COMPLETE - No changes were made');
  }
}

main();
