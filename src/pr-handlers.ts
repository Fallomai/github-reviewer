/**
 * PR and comment handling logic
 */
import { CodeReviewSchema, CommentResponseSchema } from "./schemas";
import { BOT_COMMENT_MARKER } from "./github-agent";
import { Agent } from "spinai";

/**
 * Handle new pull request events
 */
export async function handleNewPullRequest({
  payload,
  agent,
  token,
}: {
  payload: any;
  agent: Agent;
  token: string;
}) {
  const { repository, pull_request } = payload;
  const owner = repository.owner.login;
  const repo = repository.name;
  const pullNumber = pull_request.number;

  console.log(`Reviewing PR #${pullNumber} in ${owner}/${repo}`);

  try {
    console.log("about to run agent");
    // Single agent call to analyze PR and create a proper review with line comments
    const response = await agent({
      input: `Review pull request #${pullNumber} in repo ${owner}/${repo}.

      Add comments to the issue/pr at the appriopriate places on anything that might need attention.
      
      If no changes are required, make a general comment about the PR saying it all looks good
      `,
      state: {
        token,
      },
    });
    console.log("Response from agent:", response);
    console.log(`Review completed for PR #${pullNumber}`);
    return true;
  } catch (error) {
    console.log(`Error reviewing PR #${pullNumber}:`, error);
    return false;
  }
}

/**
 * Handle issue comments (comments on a PR)
 */
export async function handleIssueComment({
  payload,
  agent,
  token,
}: {
  payload: any;
  agent: Agent;
  token: string;
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

  console.log(`Responding to comment on PR #${prNumber}`);

  try {
    // Single agent call to generate and post the response
    await agent({
      input: `Respond to this comment on PR #${prNumber} in ${owner}/${repo}:
              
              Comment: ${comment.body}
              Comment Author: ${comment.user.login}
              
              Generate a brief, helpful response that follows these rules.`,
      responseFormat: CommentResponseSchema,
      state: {
        token,
      },
    });

    console.log(`Response generated and posted to comment on PR #${prNumber}`);
    return true;
  } catch (error) {
    console.log(`Error responding to comment on PR #${prNumber}:`, error);
    return false;
  }
}

/**
 * Handle PR review comments (comments on specific lines)
 */
export async function handleReviewComment({
  payload,
  agent,
  token,
}: {
  payload: any;
  agent: Agent;
  token: string;
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

  console.log(`Responding to review comment on file ${filePath}`);

  const input = `You are responding to a code review comment thread on PR #${prNumber} in ${owner}/${repo}.
              This is a REVIEW COMMENT response, not a general PR comment.
              
              Original Comment: ${comment.body}
              Comment Author: ${comment.user.login}
              File: ${filePath}
              Line: ${linePosition}
              Diff Context: ${comment.diff_hunk}
              
              To respond in this thread, you MUST format your response as a review comment with these exact details:
              prUrl: ${pull_request.html_url}
              filename: ${filePath}
              comments: [{
                line: ${comment.line},
                position: ${comment.position},
                comment: "your response here",
                inReplyTo: ${comment.id}
              }]
              
              Generate a brief, technical response that follows these rules.`;

  try {
    // Single agent call to handle everything
    await agent({
      input,
      responseFormat: CommentResponseSchema,
      state: {
        token,
      },
    });

    console.log(`Response generated and posted to review comment`);
    return true;
  } catch (error) {
    console.log(`Error responding to review comment:`, error);
    return false;
  }
}
