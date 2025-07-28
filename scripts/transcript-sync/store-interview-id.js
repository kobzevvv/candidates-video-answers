const { Client } = require('pg');

/**
 * Helper function to store interview ID when created
 * This should be called from your Google Cloud Function after creating an interview
 */
class InterviewTracker {
  constructor(databaseUrl) {
    this.databaseUrl = databaseUrl;
  }

  async storeInterviewId(interviewId, candidateInfo = {}) {
    const client = new Client({
      connectionString: this.databaseUrl,
    });

    try {
      await client.connect();

      // Insert interview record for tracking
      await client.query(`
        INSERT INTO interviews (
          id, candidate_email, candidate_first_name, candidate_last_name, 
          position_id, status, created_at, updated_at
        ) 
        VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
        ON CONFLICT (id) 
        DO UPDATE SET 
          candidate_email = COALESCE($2, interviews.candidate_email),
          candidate_first_name = COALESCE($3, interviews.candidate_first_name),
          candidate_last_name = COALESCE($4, interviews.candidate_last_name),
          position_id = COALESCE($5, interviews.position_id),
          updated_at = NOW()
      `, [
        interviewId,
        candidateInfo.email || null,
        candidateInfo.firstName || null,
        candidateInfo.lastName || null,
        candidateInfo.positionId || null,
        'invited'
      ]);

      console.log(`✅ Stored interview ID ${interviewId} for tracking`);
      return true;

    } catch (error) {
      console.error(`❌ Error storing interview ID ${interviewId}:`, error.message);
      return false;
    } finally {
      await client.end();
    }
  }

  async markInterviewCompleted(interviewId) {
    const client = new Client({
      connectionString: this.databaseUrl,
    });

    try {
      await client.connect();

      await client.query(`
        UPDATE interviews 
        SET status = 'completed', updated_at = NOW()
        WHERE id = $1
      `, [interviewId]);

      console.log(`✅ Marked interview ${interviewId} as completed`);
      return true;

    } catch (error) {
      console.error(`❌ Error updating interview ${interviewId}:`, error.message);
      return false;
    } finally {
      await client.end();
    }
  }
}

module.exports = InterviewTracker;