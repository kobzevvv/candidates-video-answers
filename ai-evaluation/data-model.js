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

// Create evaluation results table (separate from the existing view)
async function createTables() {
  try {
    // Check if table exists with wrong data types and drop if needed
    try {
      const tableInfo = await sql`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'ai_evaluation_results' 
        AND column_name = 'answer_id'
      `;
      
      if (tableInfo.length > 0 && tableInfo[0].data_type === 'integer') {
        console.log('🔄 Dropping ai_evaluation_results table to fix data types...');
        await sql`DROP TABLE IF EXISTS ai_evaluation_results`;
      }
    } catch (error) {
      // Table doesn't exist yet, that's fine
    }

    // Create ai_evaluation_results table to store evaluation scores
    await sql`
      CREATE TABLE IF NOT EXISTS ai_evaluation_results (
        id SERIAL PRIMARY KEY,
        answer_id VARCHAR(255) NOT NULL UNIQUE,
        interview_id VARCHAR(255) NOT NULL,
        question_id VARCHAR(255) NOT NULL,
        evaluation_addressing INTEGER,
        evaluation_be_specific INTEGER,
        evaluation_openness INTEGER,
        evaluation_summary TEXT,
        evaluation_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        gpt_model VARCHAR(100) DEFAULT 'openai/gpt-4o-mini',
        evaluation_prompt_version VARCHAR(20) DEFAULT '1.0',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Create indexes for better performance
    await sql`
      CREATE INDEX IF NOT EXISTS idx_ai_evaluation_answer_id ON ai_evaluation_results(answer_id)
    `;
    
    await sql`
      CREATE INDEX IF NOT EXISTS idx_ai_evaluation_interview_id ON ai_evaluation_results(interview_id)
    `;
    
    await sql`
      CREATE INDEX IF NOT EXISTS idx_ai_evaluation_question_id ON ai_evaluation_results(question_id)
    `;

    console.log('✅ Database tables created/verified (ai_evaluation_results)');
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

  // Get all question-answer pairs for a specific interview with evaluation status
  async getInterviewAnswers(interviewId) {
    try {
      const rows = await sql`
        SELECT 
          dm.*,
          eval.evaluation_addressing,
          eval.evaluation_be_specific,
          eval.evaluation_openness,
          eval.evaluation_summary,
          eval.evaluation_timestamp,
          eval.gpt_model,
          eval.evaluation_prompt_version
        FROM interview_answers_datamart dm
        LEFT JOIN ai_evaluation_results eval ON dm.answer_id = eval.answer_id
        WHERE dm.interview_id = ${interviewId}
        ORDER BY dm.question_order
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
        SELECT DISTINCT interview_id, candidate_email, candidate_first_name, candidate_last_name
        FROM interview_answers_datamart 
        WHERE position_id = ${positionId}
      `;
      return rows;
    } catch (error) {
      console.error('❌ Error fetching interviews by position:', error);
      throw error;
    }
  }

  // Get specific question-answer pair with evaluation
  async getQuestionAnswer(interviewId, questionId) {
    try {
      const rows = await sql`
        SELECT 
          dm.*,
          eval.evaluation_addressing,
          eval.evaluation_be_specific,
          eval.evaluation_openness,
          eval.evaluation_summary,
          eval.evaluation_timestamp,
          eval.gpt_model,
          eval.evaluation_prompt_version
        FROM interview_answers_datamart dm
        LEFT JOIN ai_evaluation_results eval ON dm.answer_id = eval.answer_id
        WHERE dm.interview_id = ${interviewId} AND dm.question_id = ${questionId}
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
          SELECT dm.*
          FROM interview_answers_datamart dm
          LEFT JOIN ai_evaluation_results eval ON dm.answer_id = eval.answer_id
          WHERE eval.answer_id IS NULL AND dm.position_id = ${positionId}
        `;
      } else {
        query = sql`
          SELECT dm.*
          FROM interview_answers_datamart dm
          LEFT JOIN ai_evaluation_results eval ON dm.answer_id = eval.answer_id
          WHERE eval.answer_id IS NULL
        `;
      }
      const rows = await query;
      return rows;
    } catch (error) {
      console.error('❌ Error fetching unevaluated answers:', error);
      throw error;
    }
  }

  // Save evaluation results to separate table
  async updateEvaluationResults(answerId, interviewId, questionId, evaluation, gptModel = 'openai/gpt-4o-mini') {
    try {
      await sql`
        INSERT INTO ai_evaluation_results (
          answer_id, interview_id, question_id,
          evaluation_addressing, evaluation_be_specific, evaluation_openness,
          evaluation_summary, gpt_model, evaluation_prompt_version,
          evaluation_timestamp, updated_at
        ) VALUES (
          ${answerId}, ${interviewId}, ${questionId},
          ${evaluation.addressing}, ${evaluation.be_specific}, ${evaluation.openness},
          ${evaluation.short_summary}, ${gptModel}, ${CURRENT_PROMPT_VERSION},
          NOW(), NOW()
        )
        ON CONFLICT (answer_id) 
        DO UPDATE SET 
          evaluation_addressing = EXCLUDED.evaluation_addressing,
          evaluation_be_specific = EXCLUDED.evaluation_be_specific,
          evaluation_openness = EXCLUDED.evaluation_openness,
          evaluation_summary = EXCLUDED.evaluation_summary,
          gpt_model = EXCLUDED.gpt_model,
          evaluation_prompt_version = EXCLUDED.evaluation_prompt_version,
          evaluation_timestamp = NOW(),
          updated_at = NOW()
      `;
      console.log(`✅ Updated evaluation for answer ${answerId} (interview ${interviewId}, question ${questionId})`);
    } catch (error) {
      console.error('❌ Error updating evaluation results:', error);
      throw error;
    }
  }

  // Clear all evaluations for re-processing
  async clearEvaluations(positionId = null, interviewId = null) {
    try {
      let query;
      if (interviewId) {
        query = sql`
          DELETE FROM ai_evaluation_results 
          WHERE interview_id = ${interviewId}
        `;
      } else if (positionId) {
        query = sql`
          DELETE FROM ai_evaluation_results 
          WHERE answer_id IN (
            SELECT answer_id FROM interview_answers_datamart 
            WHERE position_id = ${positionId}
          )
        `;
      } else {
        throw new Error('Either positionId or interviewId must be provided');
      }
      
      const result = await query;
      console.log(`✅ Cleared ${result.length || 0} evaluations for re-processing`);
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
            COUNT(dm.answer_id) as total_answers,
            COUNT(eval.answer_id) as evaluated_answers,
            COUNT(dm.answer_id) - COUNT(eval.answer_id) as pending_answers,
            COUNT(DISTINCT eval.gpt_model) as models_used,
            COUNT(DISTINCT eval.evaluation_prompt_version) as prompt_versions_used
          FROM interview_answers_datamart dm
          LEFT JOIN ai_evaluation_results eval ON dm.answer_id = eval.answer_id
          WHERE dm.position_id = ${positionId}
        `;
      } else {
        query = sql`
          SELECT 
            COUNT(dm.answer_id) as total_answers,
            COUNT(eval.answer_id) as evaluated_answers,
            COUNT(dm.answer_id) - COUNT(eval.answer_id) as pending_answers,
            COUNT(DISTINCT eval.gpt_model) as models_used,
            COUNT(DISTINCT eval.evaluation_prompt_version) as prompt_versions_used
          FROM interview_answers_datamart dm
          LEFT JOIN ai_evaluation_results eval ON dm.answer_id = eval.answer_id
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