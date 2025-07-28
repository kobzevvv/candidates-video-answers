const { Client } = require('pg');
const HireflixTranscriptSync = require('./sync-transcripts.js');
require('dotenv').config();

class IncrementalTranscriptSync extends HireflixTranscriptSync {
  constructor() {
    super();
  }

  async getLastSyncTimestamp() {
    const client = new Client({
      connectionString: this.databaseUrl,
    });

    try {
      await client.connect();
      
      // Create sync_metadata table if it doesn't exist
      await client.query(`
        CREATE TABLE IF NOT EXISTS sync_metadata (
          id VARCHAR(50) PRIMARY KEY,
          last_sync_timestamp TIMESTAMP WITH TIME ZONE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `);

      // Get last sync timestamp
      const result = await client.query(`
        SELECT last_sync_timestamp 
        FROM sync_metadata 
        WHERE id = 'hireflix_transcript_sync'
      `);

      if (result.rows.length > 0) {
        return result.rows[0].last_sync_timestamp;
      }
      
      // If no previous sync, return null (will sync all)
      return null;

    } catch (error) {
      console.error('Error getting last sync timestamp:', error);
      return null;
    } finally {
      await client.end();
    }
  }

  async updateLastSyncTimestamp() {
    const client = new Client({
      connectionString: this.databaseUrl,
    });

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

  async getCompletedInterviews(sinceTimestamp = null) {
    // This would ideally use Hireflix API to get completed interviews
    // Since Hireflix doesn't have a direct "list completed interviews" endpoint,
    // we'll need to get this data from your existing interview tracking
    
    const client = new Client({
      connectionString: this.databaseUrl,
    });

    try {
      await client.connect();
      
      let query = `
        SELECT DISTINCT i.id, i.candidate_email, i.candidate_first_name, 
               i.candidate_last_name, i.position_id
        FROM interviews i
        WHERE i.status != 'completed' OR i.updated_at > COALESCE($1, '1970-01-01'::timestamp)
        ORDER BY i.updated_at DESC
      `;

      const result = await client.query(query, [sinceTimestamp]);
      
      return result.rows.map(row => ({
        id: row.id,
        candidateInfo: {
          email: row.candidate_email,
          firstName: row.candidate_first_name,
          lastName: row.candidate_last_name,
          positionId: row.position_id
        }
      }));

    } catch (error) {
      console.error('Error getting completed interviews:', error);
      return [];
    } finally {
      await client.end();
    }
  }

  async getInterviewsFromHireflix(positionId, limit = 50) {
    // Alternative approach: Query Hireflix for recent interviews by position
    const query = `
      query GetInterviews($positionId: ID!, $limit: Int) {
        position(id: $positionId) {
          interviews(first: $limit, orderBy: { field: CREATED_AT, direction: DESC }) {
            edges {
              node {
                id
                status
                createdAt
                candidate {
                  email
                  firstName
                  lastName
                }
              }
            }
          }
        }
      }
    `;

    try {
      const data = await this.fetchHireflixData(query, { positionId, limit });
      
      if (!data.position?.interviews?.edges) {
        return [];
      }

      return data.position.interviews.edges
        .map(edge => edge.node)
        .filter(interview => interview.status === 'COMPLETED')
        .map(interview => ({
          id: interview.id,
          createdAt: interview.createdAt,
          candidateInfo: {
            email: interview.candidate?.email,
            firstName: interview.candidate?.firstName,
            lastName: interview.candidate?.lastName,
            positionId
          }
        }));

    } catch (error) {
      console.error('Error fetching interviews from Hireflix:', error);
      return [];
    }
  }

  async syncNewTranscripts() {
    try {
      console.log('🔄 Starting incremental transcript sync...');
      
      const lastSync = await this.getLastSyncTimestamp();
      
      if (lastSync) {
        console.log(`📅 Last sync: ${lastSync.toISOString()}`);
      } else {
        console.log('📅 No previous sync found - this will be a full sync');
      }

      // Method 1: Get interviews from database that need syncing
      const interviewsToSync = await this.getCompletedInterviews(lastSync);
      
      // Method 2: If you have position IDs, you can also query Hireflix directly
      const positionId = process.env.HIREFLIX_POSITION_ID;
      if (positionId && interviewsToSync.length === 0) {
        console.log('🔍 Checking Hireflix for new completed interviews...');
        const hireflixInterviews = await this.getInterviewsFromHireflix(positionId);
        
        // Filter by timestamp if we have a last sync time
        const newInterviews = lastSync 
          ? hireflixInterviews.filter(i => new Date(i.createdAt) > lastSync)
          : hireflixInterviews;
          
        interviewsToSync.push(...newInterviews);
      }

      if (interviewsToSync.length === 0) {
        console.log('✅ No new interviews to sync');
        return { syncedCount: 0, errors: [] };
      }

      console.log(`📋 Found ${interviewsToSync.length} interviews to sync`);
      
      const results = [];
      const errors = [];

      for (const interview of interviewsToSync) {
        try {
          console.log(`\n🔄 Syncing interview ${interview.id}...`);
          
          const result = await this.syncInterview(interview.id, interview.candidateInfo);
          results.push({ interviewId: interview.id, ...result });
          
        } catch (error) {
          console.error(`❌ Error syncing ${interview.id}:`, error.message);
          errors.push({ interviewId: interview.id, error: error.message });
        }
      }

      // Update last sync timestamp only if we had some success
      if (results.length > 0) {
        await this.updateLastSyncTimestamp();
      }

      console.log('\n📊 Incremental Sync Summary:');
      console.log(`✅ Successful: ${results.length}`);
      console.log(`❌ Failed: ${errors.length}`);

      return { 
        syncedCount: results.length, 
        errors,
        results,
        lastSyncTime: lastSync
      };

    } catch (error) {
      console.error('❌ Fatal error in incremental sync:', error.message);
      throw error;
    }
  }
}

// CLI usage
async function main() {
  const sync = new IncrementalTranscriptSync();

  try {
    const result = await sync.syncNewTranscripts();
    
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

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = IncrementalTranscriptSync;