#!/usr/bin/env node
/**
 * Re-index all topics after file renaming
 * Usage: node scripts/re-index-all.mjs [--topic <topic-name>]
 */

import { readdirSync, existsSync, mkdirSync } from 'fs';
import { join, resolve } from 'path';
import { execSync } from 'child_process';

const KNOWLEDGE_DIR = 'knowledge';
const CLI_PATH = resolve('packages/cli/dist/src/main.js');
const IMPORT_PATH = resolve('packages/web/import.ts');
const TARGET_DB = 'sce-db';

// Check for specific topic
const topicArg = process.argv.find(arg => arg.startsWith('--topic='));
const specificTopic = topicArg ? topicArg.split('=')[1] : null;

/**
 * Check if a directory has an sce.config.json
 */
function hasSceConfig(dirPath) {
  return existsSync(join(dirPath, 'sce.config.json'));
}

/**
 * Re-index a single topic
 */
function reIndexTopic(topicDir) {
  const topicPath = join(KNOWLEDGE_DIR, topicDir);
  const exportPath = resolve(KNOWLEDGE_DIR, `${topicDir}-export`);
  
  console.log(`\n🔄 Processing: ${topicDir}`);
  
  try {
    // Step 1: Update index
    console.log('   📝 Updating index...');
    execSync(`node "${CLI_PATH}" update .`, {
      cwd: topicPath,
      stdio: 'pipe'
    });
    
    // Step 2: Export
    console.log('   📤 Exporting...');
    // Remove existing export if present
    if (existsSync(exportPath)) {
      execSync(`rm -rf "${exportPath}"`);
    }
    execSync(`node "${CLI_PATH}" export -o "${exportPath}" --path .`, {
      cwd: topicPath,
      stdio: 'pipe'
    });
    
    // Step 2.5: Delete old data from D1 for this topic
    console.log('   🗑️  Deleting old data from D1...');
    const deleteCommands = [
      `cd packages/web/worker && npx wrangler d1 execute ${TARGET_DB} --remote --command "DELETE FROM vectors WHERE chunk_id IN (SELECT id FROM chunks WHERE relative_path LIKE 'https___%' OR relative_path LIKE '${topicDir}-%')"`,
      `cd packages/web/worker && npx wrangler d1 execute ${TARGET_DB} --remote --command "DELETE FROM chunks WHERE relative_path LIKE 'https___%' OR relative_path LIKE '${topicDir}-%'"`,
    ];
    for (const cmd of deleteCommands) {
      try {
        execSync(cmd, { stdio: 'pipe' });
      } catch (e) {
        // Ignore delete errors
      }
    }
    
    // Step 3: Import to D1
    console.log('   📥 Importing to D1...');
    execSync(`npx tsx "${IMPORT_PATH}" "${exportPath}" ${TARGET_DB} --append`, {
      cwd: resolve('.'),
      stdio: 'pipe'
    });
    
    // Cleanup export directory
    if (existsSync(exportPath)) {
      execSync(`rm -rf "${exportPath}"`);
    }
    
    console.log(`   ✅ ${topicDir} complete`);
    return true;
    
  } catch (err) {
    console.error(`   ❌ ${topicDir} failed: ${err.message}`);
    return false;
  }
}

/**
 * Main function
 */
function main() {
  console.log('🔄 Re-indexing all topics...\n');
  
  // Get topics to process
  let topics;
  
  if (specificTopic) {
    // Process single topic
    const topicPath = join(KNOWLEDGE_DIR, specificTopic);
    if (!existsSync(topicPath)) {
      console.error(`❌ Topic not found: ${specificTopic}`);
      process.exit(1);
    }
    topics = [specificTopic];
  } else {
    // Get all topics with sce.config.json
    topics = readdirSync(KNOWLEDGE_DIR).filter(item => {
      const itemPath = join(KNOWLEDGE_DIR, item);
      return hasSceConfig(itemPath);
    });
  }
  
  console.log(`Found ${topics.length} topics to re-index`);
  
  const results = {
    success: [],
    failed: []
  };
  
  for (const topic of topics) {
    const success = reIndexTopic(topic);
    if (success) {
      results.success.push(topic);
    } else {
      results.failed.push(topic);
    }
  }
  
  // Summary
  console.log('\n📊 Summary:');
  console.log(`   ✅ Success: ${results.success.length}`);
  console.log(`   ❌ Failed: ${results.failed.length}`);
  
  if (results.failed.length > 0) {
    console.log('\n❌ Failed topics:');
    for (const topic of results.failed) {
      console.log(`   - ${topic}`);
    }
  }
  
  console.log('\n✅ Re-indexing complete!');
}

main();
