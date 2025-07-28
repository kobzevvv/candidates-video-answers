const { Client } = require('pg');
require('dotenv').config();

class HireflixDirectSync {
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

  async getLastSyncTimestamp() {
    const client = new Client({ connectionString: this.databaseUrl });

    try {
      await client.connect();
      
      await client.query(`
        CREATE TABLE IF NOT EXISTS sync_metadata (
          id VARCHAR(50) PRIMARY KEY,
          last_sync_timestamp TIMESTAMP WITH TIME ZONE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `);

      const result = await client.query(`
        SELECT last_sync_timestamp 
        FROM sync_metadata 
        WHERE id = 'hireflix_transcript_sync'
      `);

      return result.rows.length > 0 ? result.rows[0].last_sync_timestamp : null;

    } catch (error) {
      console.error('Error getting last sync timestamp:', error);
      return null;
    } finally {
      await client.end();
    }
  }

  async updateLastSyncTimestamp() {
    const client = new Client({ connectionString: this.databaseUrl });

    try {
      await client.connect();
      const now = new Date();
      
      await client.query(`
        INSERT INTO sync_metadata (id, last_sync_timestamp, updated_at)
        VALUES ('hireflix_transcript_sync', $1, $1)
        ON CONFLICT (id)
        DO UPDATE SET 
          last_sync_timestamp = $1,
          updated_at = $1
      `, [now]);

      console.log(`✅ Updated last sync timestamp to: ${now.toISOString()}`);

    } catch (error) {
      console.error('Error updating last sync timestamp:', error);
      throw error;
    } finally {
      await client.end();
    }
  }

  async getCompletedInterviewsFromHireflix(positionIds, sinceTimestamp = null, limit = 100) {
    const allInterviews = [];
    
    // Handle single position ID or array
    if (typeof positionIds === 'string') {
      positionIds = [positionIds];
    }
    
    // If no position IDs provided, try environment variable
    if (!positionIds || positionIds.length === 0) {
      const defaultPositionId = process.env.HIREFLIX_POSITION_ID;
      if (defaultPositionId) {
        positionIds = defaultPositionId.split(',').map(id => id.trim());
      } else {
        throw new Error('No position IDs provided. Set HIREFLIX_POSITION_ID or pass as parameter.');
      }
    }

    console.log(`🔍 Querying ${positionIds.length} position(s) for completed interviews...`);

    for (const positionId of positionIds) {
      console.log(`📋 Checking position: ${positionId}`);
      
      const query = `
        query GetInterviews($positionId: ID!, $limit: Int) {
          position(id: $positionId) {
            id
            name
            interviews(first: $limit, orderBy: { field: UPDATED_AT, direction: DESC }) {
              edges {
                node {
                  id
                  status
                  createdAt
                  updatedAt
                  candidate {
                    email
                    firstName
                    lastName
                  }
                  questions {
                    id
                    answer {
                      id
                      transcription {
                        text
                      }
                    }
                  }
                }
              }
            }
          }
        }
      `;

      try {
        const data = await this.fetchHireflixData(query, { positionId, limit });
        
        if (!data.position) {
          console.log(`⚠️  Position ${positionId} not found or no access`);
          continue;
        }

        const positionName = data.position.name || 'Unknown';
        console.log(`   Position: "${positionName}"`);

        if (!data.position.interviews?.edges) {
          console.log(`   No interviews found`);
          continue;
        }

        const rawInterviews = data.position.interviews.edges.map(edge => edge.node);
        console.log(`   Total interviews: ${rawInterviews.length}`);

        const completedInterviews = rawInterviews.filter(interview => {
          // Only completed interviews
          if (interview.status !== 'COMPLETED') return false;
          
          // Filter by timestamp if provided
          if (sinceTimestamp) {
            const interviewDate = new Date(interview.updatedAt || interview.createdAt);
            return interviewDate > sinceTimestamp;
          }
          
          return true;
        });

        console.log(`   Completed interviews: ${completedInterviews.length}`);

        if (sinceTimestamp) {
          console.log(`   (filtered since: ${sinceTimestamp.toISOString()})`);
        }

        const interviewsWithData = completedInterviews.map(interview => ({
          id: interview.id,
          status: interview.status,
          createdAt: interview.createdAt,
          updatedAt: interview.updatedAt,
          hasTranscripts: interview.questions?.some(q => q.answer?.transcription?.text),
          candidateInfo: {
            email: interview.candidate?.email,
            firstName: interview.candidate?.firstName,
            lastName: interview.candidate?.lastName,
            positionId
          }
        }));

        const withTranscripts = interviewsWithData.filter(i => i.hasTranscripts).length;
        console.log(`   With transcripts: ${withTranscripts}`);
        
        allInterviews.push(...interviewsWithData);

      } catch (error) {
        console.error(`❌ Error fetching interviews from position ${positionId}:`, error.message);
      }
    }

    return allInterviews;
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
    const client = new Client({ connectionString: this.databaseUrl });

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

  async syncNewTranscripts(positionIds = null, forceFullSync = false) {
    try {
      console.log('🚀 Starting Hireflix transcript sync...');
      
      const lastSync = forceFullSync ? null : await this.getLastSyncTimestamp();
      
      if (lastSync && !forceFullSync) {
        console.log(`📅 Last sync: ${lastSync.toISOString()}`);
        console.log(`⏱️  Syncing interviews updated since then`);
      } else {
        console.log('📅 Full sync mode - processing all completed interviews');
      }

      const completedInterviews = await this.getCompletedInterviewsFromHireflix(
        positionIds, 
        lastSync
      );

      if (completedInterviews.length === 0) {
        console.log('✅ No new interviews to sync');
        return { syncedCount: 0, errors: [], results: [] };
      }

      console.log(`\n🔄 Processing ${completedInterviews.length} interviews...`);
      
      const results = [];
      const errors = [];

      for (const interview of completedInterviews) {
        try {
          console.log(`\n📝 Syncing ${interview.id} (${interview.candidateInfo.firstName || 'Unknown'})...`);
          
          const interviewData = await this.getInterview(interview.id);
          
          if (!interviewData.interview) {
            throw new Error(`Interview details not found`);
          }

          const result = await this.saveInterviewToDatabase(
            interviewData, 
            interview.candidateInfo
          );
          
          console.log(`   ✅ Saved ${result.questionsCount} questions, ${result.answersWithTranscripts} transcripts`);
          results.push({ interviewId: interview.id, ...result });
          
        } catch (error) {
          console.error(`   ❌ Error: ${error.message}`);
          errors.push({ interviewId: interview.id, error: error.message });
        }
      }

      // Update last sync timestamp only if we had some success
      if (results.length > 0 && !forceFullSync) {
        await this.updateLastSyncTimestamp();
      }

      console.log('\n📊 Sync Summary:');
      console.log(`✅ Successful: ${results.length}`);
      console.log(`❌ Failed: ${errors.length}`);

      return { 
        syncedCount: results.length, 
        errors,
        results,
        lastSyncTime: lastSync
      };

    } catch (error) {
      console.error('❌ Fatal error in sync:', error.message);
      throw error;
    }
  }
}

// CLI usage
async function main() {
  const args = process.argv.slice(2);
  const forceFullSync = args.includes('--full') || process.env.FORCE_FULL_SYNC === 'true';
  
  // Extract position IDs from args (remove flags)
  const positionIds = args.filter(arg => !arg.startsWith('--'));
  
  const sync = new HireflixDirectSync();

  try {
    console.log('🚀 Hireflix Transcript Sync');
    console.log('============================');
    
    if (positionIds.length > 0) {
      console.log(`📋 Position IDs: ${positionIds.join(', ')}`);
    }
    
    if (forceFullSync) {
      console.log('🔄 Mode: Full sync (ignoring timestamps)');
    } else {
      console.log('🔄 Mode: Incremental sync');
    }
    
    const result = await sync.syncNewTranscripts(
      positionIds.length > 0 ? positionIds : null,
      forceFullSync
    );
    
    if (result.errors.length > 0) {
      console.log('\n❌ Errors:');
      result.errors.forEach(({ interviewId, error }) => {
        console.log(`  - ${interviewId}: ${error}`);
      });
      process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ Fatal error:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = HireflixDirectSync;