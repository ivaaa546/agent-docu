import { db } from '../lib/db';
import fs from 'fs';
import path from 'path';

const schemaPath = path.join(__dirname, 'schema.sql');
const schema = fs.readFileSync(schemaPath, 'utf8');

try {
  db.exec(schema);
  console.log('✅ Migrations executed successfully');
} catch (err) {
  console.error('❌ Migration failed:', err);
  process.exit(1);
}
