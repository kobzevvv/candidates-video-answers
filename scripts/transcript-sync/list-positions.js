const { Client } = require('pg');
require('dotenv').config();

class HireflixPositionLister {
  constructor() {
    this.apiKey = process.env.HIREFLIX_API_KEY;
    this.databaseUrl = process.env.DATABASE_URL;
    this.hireflixEndpoint = 'https://api.hireflix.com/me';
    
    if (!this.apiKey) {
      throw new Error('HIREFLIX_API_KEY is required');
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

  async fetchAllPositions(includeArchived = false) {
    const query = `
      query GetAllPositions {
        positions {
          id
          name
          archived
        }
      }
    `;

    try {
      console.log('🔍 Fetching all positions from Hireflix...');
      const data = await this.fetchHireflixData(query);
      
      if (!data.positions) {
        console.log('⚠️  No positions found or no access');
        return [];
      }

      let positions = data.positions;
      
      // Filter archived positions if requested
      if (!includeArchived) {
        const originalCount = positions.length;
        positions = positions.filter(p => !p.archived);
        console.log(`📦 Filtered out ${originalCount - positions.length} archived positions`);
      }

      console.log(`📋 Found ${positions.length} position(s)`);
      return positions;

    } catch (error) {
      console.error('❌ Error fetching positions:', error.message);
      throw error;
    }
  }

  async trackPositionsInDatabase(positions) {
    if (!this.databaseUrl) {
      console.log('⚠️  No DATABASE_URL provided, skipping position tracking');
      return { newPositions: [], updatedPositions: [], allPositions: positions };
    }

    const client = new Client({ connectionString: this.databaseUrl });

    try {
      await client.connect();
      
      const newPositions = [];
      const updatedPositions = [];
      
      for (const position of positions) {
        // Check if position exists
        const existingResult = await client.query(
          'SELECT id, name, archived, first_seen FROM position_tracking WHERE id = $1',
          [position.id]
        );

        if (existingResult.rows.length === 0) {
          // New position
          await client.query(`
            INSERT INTO position_tracking (id, name, archived, first_seen, last_seen, updated_at)
            VALUES ($1, $2, $3, NOW(), NOW(), NOW())
          `, [position.id, position.name, position.archived || false]);
          
          newPositions.push(position);
          console.log(`🆕 New position tracked: ${position.name} (${position.id})`);
          
        } else {
          // Existing position - update last_seen and check for changes
          const existing = existingResult.rows[0];
          const nameChanged = existing.name !== position.name;
          const archivedChanged = existing.archived !== (position.archived || false);
          
          await client.query(`
            UPDATE position_tracking 
            SET name = $2, archived = $3, last_seen = NOW(), updated_at = NOW()
            WHERE id = $1
          `, [position.id, position.name, position.archived || false]);
          
          if (nameChanged || archivedChanged) {
            updatedPositions.push({
              ...position,
              previousName: existing.name,
              previousArchived: existing.archived
            });
            console.log(`🔄 Position updated: ${position.name} (${position.id})`);
          }
        }
      }

      return { newPositions, updatedPositions, allPositions: positions };

    } catch (error) {
      console.error('❌ Error tracking positions in database:', error.message);
      return { newPositions: [], updatedPositions: [], allPositions: positions };
    } finally {
      await client.end();
    }
  }

  formatAsTable(positions, tracking = null) {
    console.log('\n📊 POSITIONS TABLE');
    console.log('=' .repeat(100));
    
    // Header
    const idCol = 'ID'.padEnd(26);
    const nameCol = 'NAME'.padEnd(35);
    const statusCol = 'STATUS'.padEnd(10);
    const trackingCol = 'TRACKING'.padEnd(15);
    
    console.log(`${idCol} | ${nameCol} | ${statusCol} | ${trackingCol}`);
    console.log('-'.repeat(100));
    
    // Rows
    positions.forEach(pos => {
      const id = pos.id.padEnd(26);
      const name = (pos.name || 'Unknown').substring(0, 34).padEnd(35);
      const status = (pos.archived ? 'ARCHIVED' : 'ACTIVE').padEnd(10);
      
      let trackingStatus = 'EXISTING';
      if (tracking?.newPositions.some(p => p.id === pos.id)) trackingStatus = 'NEW';
      if (tracking?.updatedPositions.some(p => p.id === pos.id)) trackingStatus = 'UPDATED';
      trackingStatus = trackingStatus.padEnd(15);
      
      console.log(`${id} | ${name} | ${status} | ${trackingStatus}`);
    });
    
    console.log('=' .repeat(100));
  }

  formatAsJSON(positions, tracking = null) {
    const output = {
      timestamp: new Date().toISOString(),
      summary: {
        total: positions.length,
        active: positions.filter(p => !p.archived).length,
        archived: positions.filter(p => !!p.archived).length,
        new: tracking?.newPositions.length || 0,
        updated: tracking?.updatedPositions.length || 0
      },
      positions: positions.map(pos => ({
        id: pos.id,
        name: pos.name,
        archived: pos.archived || false,
        status: tracking?.newPositions.some(p => p.id === pos.id) ? 'new' :
                tracking?.updatedPositions.some(p => p.id === pos.id) ? 'updated' : 'existing'
      }))
    };

    console.log('\n📄 POSITIONS JSON');
    console.log('=' .repeat(50));
    console.log(JSON.stringify(output, null, 2));
  }

  formatAsCSV(positions, tracking = null) {
    console.log('\n📈 POSITIONS CSV');
    console.log('=' .repeat(50));
    console.log('id,name,archived,status');
    
    positions.forEach(pos => {
      const status = tracking?.newPositions.some(p => p.id === pos.id) ? 'new' :
                     tracking?.updatedPositions.some(p => p.id === pos.id) ? 'updated' : 'existing';
      
      const name = (pos.name || '').replace(/"/g, '""'); // Escape quotes
      console.log(`"${pos.id}","${name}",${pos.archived || false},"${status}"`);
    });
  }

  async listPositions() {
    try {
      const includeArchived = process.env.INCLUDE_ARCHIVED === 'true';
      const outputFormat = process.env.OUTPUT_FORMAT || 'table';

      console.log('🚀 Hireflix Position Lister');
      console.log('============================');
      console.log(`📋 Include Archived: ${includeArchived}`);
      console.log(`📄 Output Format: ${outputFormat}`);
      console.log('');

      // Fetch positions from Hireflix
      const positions = await this.fetchAllPositions(includeArchived);
      
      if (positions.length === 0) {
        console.log('✅ No positions found');
        return;
      }

      // Track positions for deduplication
      const tracking = await this.trackPositionsInDatabase(positions);

      // Show summary
      console.log('\n📊 Summary:');
      console.log(`   Total positions: ${positions.length}`);
      console.log(`   Active: ${positions.filter(p => !p.archived).length}`);
      console.log(`   Archived: ${positions.filter(p => !!p.archived).length}`);
      if (tracking.newPositions.length > 0) {
        console.log(`   🆕 New positions: ${tracking.newPositions.length}`);
      }
      if (tracking.updatedPositions.length > 0) {
        console.log(`   🔄 Updated positions: ${tracking.updatedPositions.length}`);
      }

      // Format output
      switch (outputFormat) {
        case 'json':
          this.formatAsJSON(positions, tracking);
          break;
        case 'csv':
          this.formatAsCSV(positions, tracking);
          break;
        default:
          this.formatAsTable(positions, tracking);
      }

      // Highlight new positions
      if (tracking.newPositions.length > 0) {
        console.log('\n🆕 NEW POSITIONS DETECTED:');
        tracking.newPositions.forEach(pos => {
          console.log(`   • ${pos.name} (${pos.id}) - ${pos.archived ? 'ARCHIVED' : 'ACTIVE'}`);
        });
      }

      // Highlight updated positions
      if (tracking.updatedPositions.length > 0) {
        console.log('\n🔄 UPDATED POSITIONS:');
        tracking.updatedPositions.forEach(pos => {
          console.log(`   • ${pos.name} (${pos.id})`);
          if (pos.previousName !== pos.name) {
            console.log(`     Name: "${pos.previousName}" → "${pos.name}"`);
          }
          if (pos.previousArchived !== (pos.archived || false)) {
            const from = pos.previousArchived ? 'ARCHIVED' : 'ACTIVE';
            const to = pos.archived ? 'ARCHIVED' : 'ACTIVE';
            console.log(`     Status: ${from} → ${to}`);
          }
        });
      }

    } catch (error) {
      console.error('❌ Fatal error:', error.message);
      process.exit(1);
    }
  }
}

// Run if called directly
if (require.main === module) {
  const lister = new HireflixPositionLister();
  lister.listPositions();
}

module.exports = HireflixPositionLister;