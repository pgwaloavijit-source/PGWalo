import { generateFullMigrationSQL } from './migrate-data';
import { writeFileSync } from 'fs';

writeFileSync('database/data-migration.sql', generateFullMigrationSQL(), 'utf8');
console.log('Wrote database/data-migration.sql');
