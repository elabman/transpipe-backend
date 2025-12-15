require('dotenv').config();
const fs = require('fs');
const path = require('path');
const db = require('../config/database');
const logger = require('../utils/logger');

async function runMigrations() {
  try {
    logger.info('Starting database migrations...');

    // Read and execute schema
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');

    await db.query(schema);

    logger.info('Database migrations completed successfully');
    process.exit(0);
  } catch (error) {
    logger.error('Migration failed', { error: error.message });
    process.exit(1);
  }
}

runMigrations();