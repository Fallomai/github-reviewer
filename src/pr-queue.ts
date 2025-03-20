/**
 * Queue implementation for PR processing
 */
import Queue from 'bull';
import { Agent } from "spinai";
import { getPRReviewAgent } from "./github-agent.js";
import { getTokenForWebhook } from "./auth.js";

// Create queue with Redis connection
const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const prQueue = new Queue('pr-review-queue', redisUrl);

// Queue types
type PrReviewJob = {
  installationId: string;
  owner: string;
  repo: string;
  pullNumber: number;
};

type CommentJob = {
  installationId: string;
  owner: string;
  repo: string;
  prNumber: number;
  commentBody: string;
  commentUser: string;
};

type ReviewCommentJob = {
  installationId: string;
  owner: string;
  repo: string;
  prNumber: number;
  prUrl: string;
  filePath: string;
  linePosition: string | number;
  commentBody: string;
  commentUser: string;
  line: number | undefined;
  position: number | undefined;
  diffHunk: string | undefined;
  commentId: number;
};

/**
 * Add a PR review job to the queue
 */
export async function queuePrReview(job: PrReviewJob) {
  return prQueue.add('pr-review', job, {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000
    }
  });
}

/**
 * Add an issue comment job to the queue
 */
export async function queueIssueComment(job: CommentJob) {
  return prQueue.add('issue-comment', job, {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000
    }
  });
}

/**
 * Add a review comment job to the queue
 */
export async function queueReviewComment(job: ReviewCommentJob) {
  return prQueue.add('review-comment', job, {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000
    }
  });
}

/**
 * Start the queue processing
 */
export function startQueueProcessor() {
  console.log('Starting PR queue processor');

  // Process PR reviews
  prQueue.process('pr-review', async (job) => {
    const { installationId, owner, repo, pullNumber } = job.data as PrReviewJob;
    
    console.log(`Processing PR #${pullNumber} in ${owner}/${repo}`);
    
    try {
      const token = await getTokenForWebhook(installationId);
      const agent = await getPRReviewAgent();

      console.log("about to run agent");
      await agent({
        input: `Review pull request #${pullNumber} in repo ${owner}/${repo}.

        Add comments to the issue/pr at the appropriate places on anything that might need attention.
        
        If no changes are required, make a general comment about the PR saying it all looks good
        `,
        state: {
          token,
        },
      });

      console.log(`Review completed for PR #${pullNumber}`);
      return true;
    } catch (error) {
      console.log(`Error reviewing PR #${pullNumber}:`, error);
      throw error; // Let Bull handle retries
    }
  });

  // Process issue comments
  prQueue.process('issue-comment', async (job) => {
    const { installationId, owner, repo, prNumber, commentBody, commentUser } = job.data as CommentJob;
    
    console.log(`Processing comment on PR #${prNumber}`);
    
    try {
      const token = await getTokenForWebhook(installationId);
      const agent = await getPRReviewAgent();

      await agent({
        input: `Respond to this comment on PR #${prNumber} in ${owner}/${repo}:
                
                Comment: ${commentBody}
                Comment Author: ${commentUser}
                
                Generate a brief, helpful response that follows these rules.`,
        state: {
          token,
        },
      });

      console.log(`Response generated and posted to comment on PR #${prNumber}`);
      return true;
    } catch (error) {
      console.log(`Error responding to comment on PR #${prNumber}:`, error);
      throw error;
    }
  });

  // Process review comments
  prQueue.process('review-comment', async (job) => {
    const { 
      installationId, owner, repo, prNumber, prUrl, filePath, linePosition, 
      commentBody, commentUser, line, position, diffHunk, commentId 
    } = job.data as ReviewCommentJob;
    
    console.log(`Processing review comment on file ${filePath}`);
    
    try {
      const token = await getTokenForWebhook(installationId);
      const agent = await getPRReviewAgent();

      const input = `You are responding to a code review comment thread on PR #${prNumber} in ${owner}/${repo}.
                This is a REVIEW COMMENT response, not a general PR comment.
                
                Original Comment: ${commentBody}
                Comment Author: ${commentUser}
                File: ${filePath}
                Line: ${linePosition}
                Diff Context: ${diffHunk}
                
                To respond in this thread, you MUST format your response as a review comment with these exact details:
                prUrl: ${prUrl}
                filename: ${filePath}
                comments: [{
                  line: ${line},
                  position: ${position},
                  comment: "your response here",
                  inReplyTo: ${commentId}
                }]
                
                Generate a brief, technical response that follows these rules.`;

      await agent({
        input,
        state: {
          token,
        },
      });

      console.log(`Response generated and posted to review comment`);
      return true;
    } catch (error) {
      console.log(`Error responding to review comment:`, error);
      throw error;
    }
  });

  // Add event listeners for monitoring
  prQueue.on('completed', (job) => {
    console.log(`Job ${job.id} completed successfully`);
  });

  prQueue.on('failed', (job, error) => {
    console.error(`Job ${job.id} failed:`, error);
  });

  return prQueue;
}