const { neon } = require('@neondatabase/serverless');

// Database connection
let sql;

// Current evaluation prompt version
const CURRENT_PROMPT_VERSION = "1.0";

// Initialize database connection
function initDatabase() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is required. Please set it to your Neon database connection string.');
  }
  
  sql = neon(process.env.DATABASE_URL);
  console.log('🗄️ Database connection initialized');
}

// Initialize sql immediately if DATABASE_URL is available
if (process.env.DATABASE_URL) {
  sql = neon(process.env.DATABASE_URL);
}

// Create tables if they don't exist
async function createTables() {
  try {
    // Create interview_answers_datamart table
    await sql`
      CREATE TABLE IF NOT EXISTS interview_answers_datamart (
        id SERIAL PRIMARY KEY,
        interview_id VARCHAR(255) NOT NULL,
        candidate_id VARCHAR(255) NOT NULL,
        position_id VARCHAR(255) NOT NULL,
        question_id VARCHAR(255) NOT NULL,
        question_text TEXT NOT NULL,
        answer_text TEXT NOT NULL,
        evaluation_addressing INTEGER,
        evaluation_be_specific INTEGER,
        evaluation_openness INTEGER,
        evaluation_summary TEXT,
        evaluation_timestamp TIMESTAMP,
        gpt_model VARCHAR(100) DEFAULT 'gpt-3.5-turbo',
        evaluation_prompt_version VARCHAR(20) DEFAULT '1.0',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Create indexes for better performance
    await sql`
      CREATE INDEX IF NOT EXISTS idx_interview_answers_interview_id ON interview_answers_datamart(interview_id)
    `;
    
    await sql`
      CREATE INDEX IF NOT EXISTS idx_interview_answers_candidate_id ON interview_answers_datamart(candidate_id)
    `;
    
    await sql`
      CREATE INDEX IF NOT EXISTS idx_interview_answers_position_id ON interview_answers_datamart(position_id)
    `;
    
    await sql`
      CREATE INDEX IF NOT EXISTS idx_interview_answers_evaluation ON interview_answers_datamart(evaluation_addressing)
    `;

    console.log('✅ Database tables created/verified (interview_answers_datamart)');
  } catch (error) {
    console.error('❌ Error creating tables:', error);
    throw error;
  }
}

class InterviewDataModel {
  constructor() {
    if (!sql) {
      initDatabase();
    }
  }

  // Get all question-answer pairs for a specific interview
  async getInterviewAnswers(interviewId) {
    try {
      const rows = await sql`
        SELECT * FROM interview_answers_datamart 
        WHERE interview_id = ${interviewId}
        ORDER BY question_id
      `;
      return rows;
    } catch (error) {
      console.error('❌ Error fetching interview answers:', error);
      throw error;
    }
  }

  // Get all interviews for a specific position
  async getInterviewsByPosition(positionId) {
    try {
      const rows = await sql`
        SELECT DISTINCT interview_id, candidate_id 
        FROM interview_answers_datamart 
        WHERE position_id = ${positionId}
      `;
      return rows;
    } catch (error) {
      console.error('❌ Error fetching interviews by position:', error);
      throw error;
    }
  }

  // Get specific question-answer pair
  async getQuestionAnswer(interviewId, questionId) {
    try {
      const rows = await sql`
        SELECT * FROM interview_answers_datamart 
        WHERE interview_id = ${interviewId} AND question_id = ${questionId}
      `;
      return rows[0] || null;
    } catch (error) {
      console.error('❌ Error fetching question answer:', error);
      throw error;
    }
  }

  // Get all unevaluated answers (those without evaluation scores)
  async getUnevaluatedAnswers(positionId = null) {
    try {
      let query;
      if (positionId) {
        query = sql`
          SELECT * FROM interview_answers_datamart 
          WHERE evaluation_addressing IS NULL AND position_id = ${positionId}
        `;
      } else {
        query = sql`
          SELECT * FROM interview_answers_datamart 
          WHERE evaluation_addressing IS NULL
        `;
      }
      const rows = await query;
      return rows;
    } catch (error) {
      console.error('❌ Error fetching unevaluated answers:', error);
      throw error;
    }
  }

  // Update evaluation results back to the datamart
  async updateEvaluationResults(interviewId, questionId, evaluation, gptModel = 'gpt-3.5-turbo') {
    try {
      await sql`
        UPDATE interview_answers_datamart 
        SET evaluation_addressing = ${evaluation.addressing},
            evaluation_be_specific = ${evaluation.be_specific},
            evaluation_openness = ${evaluation.openness},
            evaluation_summary = ${evaluation.short_summary},
            evaluation_timestamp = NOW(),
            gpt_model = ${gptModel},
            evaluation_prompt_version = ${CURRENT_PROMPT_VERSION},
            updated_at = NOW()
        WHERE interview_id = ${interviewId} AND question_id = ${questionId}
      `;
      console.log(`✅ Updated evaluation for interview ${interviewId}, question ${questionId}`);
    } catch (error) {
      console.error('❌ Error updating evaluation results:', error);
      throw error;
    }
  }

  // Clear all evaluations for re-processing (when prompt changes or model changes)
  async clearEvaluations(positionId = null, interviewId = null) {
    try {
      let query;
      if (interviewId) {
        query = sql`
          UPDATE interview_answers_datamart 
          SET evaluation_addressing = NULL,
              evaluation_be_specific = NULL,
              evaluation_openness = NULL,
              evaluation_summary = NULL,
              evaluation_timestamp = NULL,
              gpt_model = NULL,
              evaluation_prompt_version = NULL,
              updated_at = NOW()
          WHERE interview_id = ${interviewId}
        `;
      } else if (positionId) {
        query = sql`
          UPDATE interview_answers_datamart 
          SET evaluation_addressing = NULL,
              evaluation_be_specific = NULL,
              evaluation_openness = NULL,
              evaluation_summary = NULL,
              evaluation_timestamp = NULL,
              gpt_model = NULL,
              evaluation_prompt_version = NULL,
              updated_at = NOW()
          WHERE position_id = ${positionId}
        `;
      } else {
        throw new Error('Either positionId or interviewId must be provided');
      }
      
      await query;
      console.log('✅ Cleared evaluations for re-processing');
    } catch (error) {
      console.error('❌ Error clearing evaluations:', error);
      throw error;
    }
  }

  // Get evaluation statistics
  async getEvaluationStats(positionId = null) {
    try {
      let query;
      if (positionId) {
        query = sql`
          SELECT 
            COUNT(*) as total_answers,
            COUNT(evaluation_addressing) as evaluated_answers,
            COUNT(CASE WHEN evaluation_addressing IS NULL THEN 1 END) as pending_answers,
            COUNT(DISTINCT gpt_model) as models_used,
            COUNT(DISTINCT evaluation_prompt_version) as prompt_versions_used
          FROM interview_answers_datamart 
          WHERE position_id = ${positionId}
        `;
      } else {
        query = sql`
          SELECT 
            COUNT(*) as total_answers,
            COUNT(evaluation_addressing) as evaluated_answers,
            COUNT(CASE WHEN evaluation_addressing IS NULL THEN 1 END) as pending_answers,
            COUNT(DISTINCT gpt_model) as models_used,
            COUNT(DISTINCT evaluation_prompt_version) as prompt_versions_used
          FROM interview_answers_datamart
        `;
      }
      
      const stats = await query;
      return stats[0];
    } catch (error) {
      console.error('❌ Error getting evaluation stats:', error);
      throw error;
    }
  }
}

module.exports = {
  InterviewDataModel,
  createTables,
  initDatabase,
  CURRENT_PROMPT_VERSION
};