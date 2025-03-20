/**
 * PR and comment handling logic
 */
import { queuePrReview, queueIssueComment, queueReviewComment } from "./pr-queue.js";

/**
 * Handle new pull request events
 */
export async function handleNewPullRequest({
  payload,
  installationId,
}: {
  payload: any;
  installationId: string;
}) {
  const { repository, pull_request } = payload;
  const owner = repository.owner.login;
  const repo = repository.name;
  const pullNumber = pull_request.number;

  console.log(`Queuing PR #${pullNumber} in ${owner}/${repo}`);

  try {
    // Queue the job for background processing
    await queuePrReview({
      installationId,
      owner,
      repo,
      pullNumber
    });

    console.log(`PR #${pullNumber} queued for review`);
    return true;
  } catch (error) {
    console.log(`Error queuing PR #${pullNumber}:`, error);
    return false;
  }
}

/**
 * Handle issue comments (comments on a PR)
 */
export async function handleIssueComment({
  payload,
  installationId,
}: {
  payload: any;
  installationId: string;
}) {
  const { repository, issue, comment, sender } = payload;

  // Only respond to comments on PRs, not regular issues
  if (!issue.pull_request) {
    return false;
  }

  console.log(sender.login, process.env.BOT_USERNAME);

  // Check if we should respond to this comment
  if (sender.login === process.env.BOT_USERNAME) {
    return false;
  }

  const owner = repository.owner.login;
  const repo = repository.name;
  const prNumber = issue.number;

  console.log(`Queuing response to comment on PR #${prNumber}`);

  try {
    // Queue the job for background processing
    await queueIssueComment({
      installationId,
      owner, 
      repo,
      prNumber,
      commentBody: comment.body,
      commentUser: comment.user.login
    });

    console.log(`Comment on PR #${prNumber} queued for response`);
    return true;
  } catch (error) {
    console.log(`Error queuing comment on PR #${prNumber}:`, error);
    return false;
  }
}

/**
 * Handle PR review comments (comments on specific lines)
 */
export async function handleReviewComment({
  payload,
  installationId,
}: {
  payload: any;
  installationId: string;
}) {
  const { repository, pull_request, comment, sender } = payload;

  console.log(sender.login, process.env.BOT_USERNAME);
  // Check if we should respond to this comment
  if (sender.login === process.env.BOT_USERNAME) {
    return false;
  }

  const owner = repository.owner.login;
  const repo = repository.name;
  const prNumber = pull_request.number;
  const filePath = comment.path;
  const linePosition = comment.position || "N/A";

  console.log(`Queuing response to review comment on file ${filePath}`);

  try {
    // Queue the job for background processing
    await queueReviewComment({
      installationId,
      owner,
      repo,
      prNumber,
      prUrl: pull_request.html_url,
      filePath,
      linePosition,
      commentBody: comment.body,
      commentUser: comment.user.login,
      line: comment.line,
      position: comment.position,
      diffHunk: comment.diff_hunk,
      commentId: comment.id
    });

    console.log(`Review comment on PR #${prNumber} queued for response`);
    return true;
  } catch (error) {
    console.log(`Error queuing review comment on PR #${prNumber}:`, error);
    return false;
  }
}