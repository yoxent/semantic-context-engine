const { readFileSync, writeFileSync } = require('fs');
const { resolve } = require('path');

// Read chunks
const chunks = JSON.parse(readFileSync(resolve(__dirname, '../../sce-export/chunks.json'), 'utf-8'));
console.log('Chunks to import:', chunks.length);

// Generate SQL for first 200 chunks
const batchSize = 50;
const batches = [];
for (let i = 0; i < Math.min(chunks.length, 200); i += batchSize) {
  const batch = chunks.slice(i, i + batchSize);
  const values = batch.map(c => {
    const text = c.text.replace(/'/g, "''").substring(0, 1000);
    const path = c.relativePath.replace(/'/g, "''");
    const heading = (c.headingPath || '').replace(/'/g, "''");
    return `('${c.id}', '${c.repositoryId}', '${path}', '${c.language || ''}', '${heading}', ${c.startLine}, ${c.endLine}, '${text}')`;
  }).join(', ');
  batches.push(`INSERT OR REPLACE INTO chunks (id, repository_id, relative_path, language, heading_path, start_line, end_line, text) VALUES ${values};`);
}

// Write SQL file
const sql = batches.join('\n');
writeFileSync(resolve(__dirname, './import-data.sql'), sql);
console.log('Generated SQL batches:', batches.length);
console.log('SQL file size:', sql.length, 'bytes');
