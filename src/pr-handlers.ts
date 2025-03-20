import axios from "axios";
import { Agent } from "spinai";
import { CodeReviewSchema, CommentResponseSchema } from "./schemas.js";

/**
 * Post AI-generated review comments or a summary to a PR
 */
export async function postPRReview(
  reviewData: any,
  pull_request: any,
  token: string
) {
  const { repository, number: prNumber } = pull_request;
  const owner = repository.owner.login;
  const repo = repository.name;

  console.log(`📢 Posting review for PR #${prNumber} in ${owner}/${repo}...`);

  try {
    // Extract key points & review summary
    const { status, review } = reviewData;

    if (!review || !review.summary) {
      console.warn(`⚠️ No review summary available. Posting default response.`);
      await axios.post(
        `https://api.github.com/repos/${owner}/${repo}/issues/${prNumber}/comments`,
        {
          body: "🤖 AI Review: No issues detected, PR looks good!",
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/vnd.github.v3+json",
          },
        }
      );
      return;
    }

    // Construct review message
    let reviewComment = `🤖 **AI Review Summary:**\n\n${review.summary}\n\n`;

    if (review.keyPoints?.length > 0) {
      reviewComment += "**Key Points:**\n" + review.keyPoints.map((p) => `- ${p}`).join("\n");
    }

    await axios.post(
      `https://api.github.com/repos/${owner}/${repo}/issues/${prNumber}/comments`,
      { body: reviewComment },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github.v3+json",
        },
      }
    );

    console.log("✅ PR review posted!");
  } catch (error) {
    console.error("❌ Error posting PR review:", error?.response?.data || error.message);
  }
}

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

  console.log(`🔍 Reviewing PR #${pullNumber} in ${owner}/${repo}`);

  try {
    const response = await agent({
      input: `Review pull request #${pullNumber} in repo ${owner}/${repo}.
      - Identify any issues and suggest improvements.
      - Use JSON format for structured comments.
      - If no issues found, return a positive summary.`,
      responseFormat: CodeReviewSchema,
      state: { token },
    });

    console.log("✅ AI Review Response:", JSON.stringify(response, null, 2));

    await postPRReview(response, pull_request, token);
    return true;
  } catch (error) {
    console.error(`❌ Error reviewing PR #${pullNumber}:`, error);
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

  if (!issue.pull_request) return false;
  if (sender.login === process.env.BOT_USERNAME) return false;

  const owner = repository.owner.login;
  const repo = repository.name;
  const prNumber = issue.number;

  console.log(`💬 Responding to PR comment from ${sender.login}`);

  try {
    const response = await agent({
      input: `Respond to this PR comment:
              PR #${prNumber} in ${owner}/${repo}
              Comment: ${comment.body}
              Comment Author: ${comment.user.login}`,
      responseFormat: CommentResponseSchema,
      state: { token },
    });

    const aiResponse = response?.response;
    if (!aiResponse) {
      console.error("❌ AI response is empty.");
      return false;
    }

    console.log("✅ Generated AI Response:", aiResponse);

    await axios.post(
      `https://api.github.com/repos/${owner}/${repo}/issues/${prNumber}/comments`,
      { body: `🤖 ${aiResponse}` },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github.v3+json",
        },
      }
    );

    console.log(`✅ Response posted to PR comment!`);
    return true;
  } catch (error) {
    console.error(`❌ Error responding to comment on PR #${prNumber}:`, error);
    return false;
  }
}

/**
 * Handle PR review comments (inline review comments)
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

  if (sender.login === process.env.BOT_USERNAME) return false;

  const owner = repository.owner.login;
  const repo = repository.name;
  const prNumber = pull_request.number;
  const filePath = comment.path;
  const linePosition = comment.position || "N/A";

  console.log(`📝 Responding to review comment on ${filePath}`);

  const input = `You are responding to a **code review comment** on PR #${prNumber} in ${owner}/${repo}.
              - **Original Comment**: ${comment.body}
              - **Comment Author**: ${comment.user.login}
              - **File**: ${filePath}
              - **Line**: ${linePosition}
              - **Diff Context**: ${comment.diff_hunk}
              
              Respond with a **brief, professional review comment**.`;

  try {
    const response = await agent({
      input,
      responseFormat: CommentResponseSchema,
      state: { token },
    });

    const aiResponse = response?.response;
    if (!aiResponse) {
      console.error("❌ AI response is empty.");
      return false;
    }

    console.log("✅ Generated AI Response:", aiResponse);

    await axios.post(
      `https://api.github.com/repos/${owner}/${repo}/pulls/comments/${comment.id}/replies`,
      { body: `🤖 ${aiResponse}` },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github.v3+json",
        },
      }
    );

    console.log(`✅ Response posted to review comment!`);
    return true;
  } catch (error) {
    console.error(`❌ Error responding to review comment:`, error);
    return false;
  }
}