#!/usr/bin/env node
/**
 * Import-only script: Export already-indexed topics to D1
 * Skips the update step since local .sce/metadata.sqlite already exists
 */

import { readdirSync, existsSync, mkdirSync } from 'fs';
import { join, resolve } from 'path';
import { execSync } from 'child_process';

const KNOWLEDGE_DIR = 'knowledge';
const CLI_PATH = resolve('packages/cli/dist/src/main.js');
const IMPORT_PATH = resolve('packages/web/import.ts');
const TARGET_DB = 'sce-db';

function hasSceConfig(dirPath) {
  return existsSync(join(dirPath, 'sce.config.json'));
}

function hasLocalIndex(dirPath) {
  return existsSync(join(dirPath, '.sce', 'metadata.sqlite'));
}

function importTopic(topicDir) {
  const topicPath = join(KNOWLEDGE_DIR, topicDir);
  const exportPath = resolve(KNOWLEDGE_DIR, `${topicDir}-export`);
  
  console.log(`\n🔄 Processing: ${topicDir}`);
  
  try {
    // Step 1: Export from local index
    console.log('   📤 Exporting...');
    if (existsSync(exportPath)) {
      execSync(`rm -rf "${exportPath}"`);
    }
    execSync(`node "${CLI_PATH}" export -o "${exportPath}" --path .`, {
      cwd: topicPath,
      stdio: 'pipe'
    });
    
    // Step 2: Delete old data from D1 for this topic
    console.log('   🗑️  Cleaning old data...');
    try {
      execSync(`cd packages/web/worker && npx wrangler d1 execute ${TARGET_DB} --remote --command "DELETE FROM vectors WHERE chunk_id IN (SELECT id FROM chunks WHERE relative_path IN (SELECT relative_path FROM chunks WHERE relative_path LIKE '${topicDir}-%' OR relative_path IN (SELECT relative_path FROM chunks WHERE id IN (SELECT chunk_id FROM vectors WHERE chunk_id LIKE '${topicDir}-%'))))"`, { stdio: 'pipe' });
    } catch (e) { /* ignore */ }
    
    // Step 3: Import to D1
    console.log('   📥 Importing to D1...');
    execSync(`npx tsx "${IMPORT_PATH}" "${exportPath}" ${TARGET_DB} --append`, {
      cwd: resolve('.'),
      stdio: 'pipe'
    });
    
    // Cleanup
    if (existsSync(exportPath)) {
      execSync(`rm -rf "${exportPath}"`);
    }
    
    console.log(`   ✅ ${topicDir} complete`);
    return true;
    
  } catch (err) {
    console.error(`   ❌ ${topicDir} failed: ${err.message?.slice(0, 200)}`);
    // Cleanup on failure
    if (existsSync(exportPath)) {
      try { execSync(`rm -rf "${exportPath}"`); } catch {}
    }
    return false;
  }
}

function main() {
  console.log('📥 Importing all indexed topics to D1...\n');
  
  const topicArg = process.argv.find(arg => arg.startsWith('--topic='));
  const specificTopic = topicArg ? topicArg.split('=')[1] : null;
  
  let topics;
  if (specificTopic) {
    topics = [specificTopic];
  } else {
    topics = readdirSync(KNOWLEDGE_DIR).filter(item => {
      const itemPath = join(KNOWLEDGE_DIR, item);
      return hasSceConfig(itemPath) && hasLocalIndex(itemPath);
    });
  }
  
  console.log(`Found ${topics.length} topics with local indexes`);
  
  const results = { success: [], failed: [] };
  
  for (const topic of topics) {
    const success = importTopic(topic);
    if (success) results.success.push(topic);
    else results.failed.push(topic);
  }
  
  console.log('\n📊 Summary:');
  console.log(`   ✅ Success: ${results.success.length}`);
  console.log(`   ❌ Failed: ${results.failed.length}`);
  
  if (results.failed.length > 0) {
    console.log('\n❌ Failed topics:');
    for (const topic of results.failed) {
      console.log(`   - ${topic}`);
    }
  }
}

main();
