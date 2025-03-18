import { createAgent } from "spinai";
import { analyzeCodeChanges } from "./actions/analyze-code-changes.js";
import { createReviewComments } from "./actions/create-review-comments.js";
import { getFileBeforeAfter } from "./actions/get-file-before-after.js";
import { getPrFiles } from "./actions/get-pr-info.js";
import { replyToComment } from "./actions/reply-to-comment.js";
import { getCommentThread } from "./actions/get-comment-thread.js";
import { openrouter } from "./utils/openrouter.js";

// Unique marker for bot-generated comments
export const BOT_COMMENT_MARKER = "🤖 ";

/**
 * Create a PR review agent with the given GitHub token
 */
export async function getPRReviewAgent() {
  const agent = await createAgent({
    instructions: `You are a GitHub assistant that can help with repository management.
    Use the available GitHub actions to help users with their requests.

    if you are replying to a comment make sure you run the get comment thread action first to get the full thread history for a GitHub PR review comment
    `,
    actions: [
      analyzeCodeChanges,
      replyToComment,
      createReviewComments,
      getFileBeforeAfter,
      getPrFiles,
      getCommentThread,
    ],
    model: openrouter("meta-llama/llama-3.3-70b-instruct:free"),
    spinApiKey: process.env.SPINAI_API_KEY,
    agentId: "github-pr-review-agent",
  });

  return agent;
}
