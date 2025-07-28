const { Client } = require('pg');
require('dotenv').config();

class HireflixTranscriptSync {
  constructor() {
    this.apiKey = process.env.HIREFLIX_API_KEY;
    this.databaseUrl = process.env.DATABASE_URL;
    this.hireflixEndpoint = 'https://api.hireflix.com/me';
    
    if (!this.apiKey) {
      throw new Error('HIREFLIX_API_KEY is required');
    }
    if (!this.databaseUrl) {
      throw new Error('DATABASE_URL is required');
    }
  }

  async fetchHireflixData(query, variables = {}) {
    const response = await fetch(this.hireflixEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey
      },
      body: JSON.stringify({ query, variables })
    });

    const data = await response.json();
    
    if (data.errors) {
      throw new Error(`Hireflix API error: ${JSON.stringify(data.errors)}`);
    }
    
    return data.data;
  }

  async getInterview(interviewId) {
    const query = `
      query GetInterview($id: ID!) {
        interview(id: $id) {
          id
          questions {
            id
            title
            description
            answer {
              id
              url
              transcription {
                languageCode
                text
                words { text start end }
              }
            }
          }
        }
      }
    `;

    return await this.fetchHireflixData(query, { id: interviewId });
  }

  async saveInterviewToDatabase(interviewData, candidateInfo = {}) {
    const client = new Client({
      connectionString: this.databaseUrl,
    });

    try {
      await client.connect();
      await client.query('BEGIN');

      const interview = interviewData.interview;
      
      // Insert/update interview record
      await client.query(`
        INSERT INTO interviews (
          id, candidate_email, candidate_first_name, candidate_last_name, 
          position_id, status, updated_at
        ) 
        VALUES ($1, $2, $3, $4, $5, $6, NOW())
        ON CONFLICT (id) 
        DO UPDATE SET 
          status = $6,
          updated_at = NOW()
      `, [
        interview.id,
        candidateInfo.email || null,
        candidateInfo.firstName || null,
        candidateInfo.lastName || null,
        candidateInfo.positionId || null,
        'completed'
      ]);

      // Process questions and answers
      for (let i = 0; i < interview.questions.length; i++) {
        const question = interview.questions[i];
        
        // Insert/update question
        await client.query(`
          INSERT INTO interview_questions (
            id, interview_id, title, description, question_order
          )
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (id)
          DO UPDATE SET 
            title = $3,
            description = $4,
            question_order = $5
        `, [
          question.id,
          interview.id,
          question.title,
          question.description,
          i + 1
        ]);

        // Insert/update answer with transcript
        if (question.answer) {
          const transcription = question.answer.transcription;
          
          await client.query(`
            INSERT INTO interview_answers (
              id, question_id, interview_id, video_url, 
              transcription_text, transcription_language, 
              transcription_words, updated_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
            ON CONFLICT (id)
            DO UPDATE SET 
              video_url = $4,
              transcription_text = $5,
              transcription_language = $6,
              transcription_words = $7,
              updated_at = NOW()
          `, [
            question.answer.id,
            question.id,
            interview.id,
            question.answer.url,
            transcription?.text || null,
            transcription?.languageCode || null,
            transcription?.words ? JSON.stringify(transcription.words) : null
          ]);
        }
      }

      await client.query('COMMIT');
      console.log(`✅ Successfully saved interview ${interview.id} to database`);
      
      return {
        interviewId: interview.id,
        questionsCount: interview.questions.length,
        answersWithTranscripts: interview.questions.filter(q => q.answer?.transcription?.text).length
      };

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      await client.end();
    }
  }

  async syncInterview(interviewId, candidateInfo = {}) {
    try {
      console.log(`🔄 Fetching interview ${interviewId} from Hireflix...`);
      
      const data = await this.getInterview(interviewId);
      
      if (!data.interview) {
        throw new Error(`Interview ${interviewId} not found`);
      }

      console.log(`📝 Saving interview ${interviewId} to database...`);
      const result = await this.saveInterviewToDatabase(data, candidateInfo);
      
      console.log(`✅ Sync completed for interview ${interviewId}`);
      console.log(`   - Questions: ${result.questionsCount}`);
      console.log(`   - Transcripts: ${result.answersWithTranscripts}`);
      
      return result;

    } catch (error) {
      console.error(`❌ Error syncing interview ${interviewId}:`, error.message);
      throw error;
    }
  }

  async syncMultipleInterviews(interviewIds, candidateInfoMap = {}) {
    const results = [];
    const errors = [];

    for (const interviewId of interviewIds) {
      try {
        const candidateInfo = candidateInfoMap[interviewId] || {};
        const result = await this.syncInterview(interviewId, candidateInfo);
        results.push({ interviewId, ...result });
      } catch (error) {
        errors.push({ interviewId, error: error.message });
      }
    }

    return { results, errors };
  }
}

// CLI usage
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('Usage:');
    console.log('  node sync-transcripts.js <interview-id1> [interview-id2] [...]');
    console.log('  or set INTERVIEW_IDS environment variable');
    process.exit(1);
  }

  // Get interview IDs from command line args or environment variable
  const interviewIds = args.length > 0 ? args : (process.env.INTERVIEW_IDS || '').split(',').filter(Boolean);
  
  if (interviewIds.length === 0) {
    console.error('❌ No interview IDs provided');
    process.exit(1);
  }

  const sync = new HireflixTranscriptSync();

  try {
    console.log(`🚀 Starting sync for ${interviewIds.length} interview(s)...`);
    
    const { results, errors } = await sync.syncMultipleInterviews(interviewIds);
    
    console.log('\n📊 Sync Summary:');
    console.log(`✅ Successful: ${results.length}`);
    console.log(`❌ Failed: ${errors.length}`);
    
    if (errors.length > 0) {
      console.log('\n❌ Errors:');
      errors.forEach(({ interviewId, error }) => {
        console.log(`  - ${interviewId}: ${error}`);
      });
      process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ Fatal error:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = HireflixTranscriptSync;