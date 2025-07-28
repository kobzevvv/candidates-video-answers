const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function setupDatabase() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('✅ Connected to Neon database');

    // Read and execute schema
    const schemaPath = path.join(__dirname, 'schema.sql');
    
    if (!fs.existsSync(schemaPath)) {
      console.log('⚠️  schema.sql not found, creating tables directly...');
      
      // Create tables directly if schema.sql is missing
      await client.query(`
        -- Main interviews table
        CREATE TABLE IF NOT EXISTS interviews (
            id VARCHAR(255) PRIMARY KEY,
            candidate_email VARCHAR(255),
            candidate_first_name VARCHAR(255),
            candidate_last_name VARCHAR(255),
            position_id VARCHAR(255),
            status VARCHAR(50) DEFAULT 'pending',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        -- Questions table
        CREATE TABLE IF NOT EXISTS interview_questions (
            id VARCHAR(255) PRIMARY KEY,
            interview_id VARCHAR(255) REFERENCES interviews(id) ON DELETE CASCADE,
            title TEXT,
            description TEXT,
            question_order INTEGER,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        -- Answers and transcripts table
        CREATE TABLE IF NOT EXISTS interview_answers (
            id VARCHAR(255) PRIMARY KEY,
            question_id VARCHAR(255) REFERENCES interview_questions(id) ON DELETE CASCADE,
            interview_id VARCHAR(255) REFERENCES interviews(id) ON DELETE CASCADE,
            video_url TEXT,
            transcription_text TEXT,
            transcription_language VARCHAR(10),
            transcription_words JSONB,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        -- Sync metadata table
        CREATE TABLE IF NOT EXISTS sync_metadata (
            id VARCHAR(50) PRIMARY KEY,
            last_sync_timestamp TIMESTAMP WITH TIME ZONE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `);
      
      // Create indexes
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_interviews_position_id ON interviews(position_id);
        CREATE INDEX IF NOT EXISTS idx_interviews_status ON interviews(status);
        CREATE INDEX IF NOT EXISTS idx_interviews_created_at ON interviews(created_at);
        CREATE INDEX IF NOT EXISTS idx_interview_questions_interview_id ON interview_questions(interview_id);
        CREATE INDEX IF NOT EXISTS idx_interview_answers_interview_id ON interview_answers(interview_id);
        CREATE INDEX IF NOT EXISTS idx_interview_answers_question_id ON interview_answers(question_id);
      `);
      
    } else {
      // Use schema file if it exists
      const schema = fs.readFileSync(schemaPath, 'utf8');
      await client.query(schema);
    }
    
    console.log('✅ Database schema created successfully');

  } catch (error) {
    console.error('❌ Error setting up database:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

if (require.main === module) {
  setupDatabase();
}

module.exports = setupDatabase;