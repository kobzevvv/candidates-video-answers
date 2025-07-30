#!/usr/bin/env node

// Script to get GitHub Action logs via API and format them

const https = require('https');
const fs = require('fs');

// Configuration
const OWNER = 'kobzevvv';
const REPO = 'candidates-video-answers';
const WORKFLOW_NAME = 'evaluate-candidates.yml';

// Get GitHub token from environment
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

if (!GITHUB_TOKEN) {
  console.error('❌ GITHUB_TOKEN environment variable is required');
  console.log('\nTo set it:');
  console.log('export GITHUB_TOKEN="your-github-token"');
  console.log('\nCreate a token at: https://github.com/settings/tokens');
  process.exit(1);
}

// Make GitHub API request
async function githubApi(path, method = 'GET') {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path: `/repos/${OWNER}/${REPO}${path}`,
      method: method,
      headers: {
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'GitHub-Action-Log-Fetcher'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(JSON.parse(data));
        } else {
          reject(new Error(`API error: ${res.statusCode} - ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

// Get latest workflow run
async function getLatestRun() {
  const runs = await githubApi(`/actions/workflows/${WORKFLOW_NAME}/runs?per_page=1`);
  return runs.workflow_runs[0];
}

// Get run by ID
async function getRun(runId) {
  return await githubApi(`/actions/runs/${runId}`);
}

// Get jobs for a run
async function getJobs(runId) {
  const result = await githubApi(`/actions/runs/${runId}/jobs`);
  return result.jobs;
}

// Get logs for a job
async function getJobLogs(jobId) {
  // Note: This returns a redirect URL to download logs
  return await githubApi(`/actions/jobs/${jobId}/logs`);
}

// Format run summary
function formatRunSummary(run, jobs) {
  let summary = `# 🤖 GitHub Action Run Report\n\n`;
  summary += `## Run Information\n`;
  summary += `- **Run ID:** ${run.id}\n`;
  summary += `- **Run Number:** #${run.run_number}\n`;
  summary += `- **Status:** ${run.status}\n`;
  summary += `- **Conclusion:** ${run.conclusion || 'In Progress'}\n`;
  summary += `- **Started:** ${new Date(run.created_at).toLocaleString()}\n`;
  summary += `- **Duration:** ${calculateDuration(run.created_at, run.updated_at)}\n`;
  summary += `- **URL:** ${run.html_url}\n\n`;
  
  summary += `## Jobs\n`;
  jobs.forEach(job => {
    summary += `\n### ${job.name}\n`;
    summary += `- Status: ${job.status}\n`;
    summary += `- Conclusion: ${job.conclusion || 'In Progress'}\n`;
    summary += `- Started: ${new Date(job.started_at).toLocaleString()}\n`;
    summary += `- Duration: ${calculateDuration(job.started_at, job.completed_at)}\n`;
    
    // Add step summaries
    if (job.steps && job.steps.length > 0) {
      summary += `\n#### Steps:\n`;
      job.steps.forEach(step => {
        const icon = step.conclusion === 'success' ? '✅' : 
                    step.conclusion === 'failure' ? '❌' : '⏳';
        summary += `${icon} ${step.name} (${step.status})\n`;
      });
    }
  });
  
  return summary;
}

// Calculate duration between two timestamps
function calculateDuration(start, end) {
  if (!start || !end) return 'N/A';
  const duration = new Date(end) - new Date(start);
  const minutes = Math.floor(duration / 60000);
  const seconds = Math.floor((duration % 60000) / 1000);
  return `${minutes}m ${seconds}s`;
}

// Extract evaluation results from logs
function extractEvaluationResults(logContent) {
  const lines = logContent.split('\n');
  let results = '\n## Evaluation Results\n```\n';
  
  // Find evaluation summary section
  let foundSummary = false;
  for (const line of lines) {
    if (line.includes('Evaluation Summary') || line.includes('Re-evaluation Summary')) {
      foundSummary = true;
    }
    if (foundSummary && (
      line.includes('✅ Processed:') ||
      line.includes('⏭️  Skipped:') ||
      line.includes('❌ Errors:') ||
      line.includes('📊 Total answers:') ||
      line.includes('🏁 Evaluated answers:') ||
      line.includes('⏳ Pending answers:')
    )) {
      results += line + '\n';
    }
  }
  
  results += '```\n';
  return results;
}

// Main function
async function main() {
  try {
    console.log('🔍 Fetching latest evaluation run...\n');
    
    // Get latest run
    const latestRun = await getLatestRun();
    
    if (!latestRun) {
      console.log('❌ No runs found');
      return;
    }
    
    console.log(`Found run #${latestRun.run_number} (${latestRun.status})`);
    
    // Get jobs
    const jobs = await getJobs(latestRun.id);
    
    // Format summary
    const summary = formatRunSummary(latestRun, jobs);
    
    // Save summary
    const filename = `run-${latestRun.id}-summary.md`;
    fs.writeFileSync(filename, summary);
    console.log(`\n✅ Summary saved to: ${filename}`);
    
    // Show summary
    console.log('\n' + summary);
    
    // If you want to post as a comment
    const args = process.argv.slice(2);
    if (args[0] === '--comment' && args[1]) {
      const issueNumber = args[1];
      console.log(`\n📝 To post this as a comment on issue #${issueNumber}, run:`);
      console.log(`gh issue comment ${issueNumber} --body-file "${filename}"`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}