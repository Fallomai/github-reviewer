import { createAgent } from "spinai";
import { openai } from "@ai-sdk/openai";
import { analyzeCodeChanges } from "./actions/analyze-code-changes.js";
import { createReviewComments } from "./actions/create-review-comments.js";
import { getFileBeforeAfter } from "./actions/get-file-before-after.js";
import { getPrFiles } from "./actions/get-pr-info.js";
import { replyToComment } from "./actions/reply-to-comment.js";
import { getCommentThread } from "./actions/get-comment-thread.js";

// Unique marker for bot-generated comments
export const BOT_COMMENT_MARKER = "🤖 ";

/**
 * Create a PR review agent with the given GitHub token
 */
export async function getPRReviewAgent() {
  const agent = await createAgent({
    instructions: `You are a GitHub assistant that can help with repository management.
    Use the available GitHub actions to help users with their requests.

    if you are replying to a comment make sure you run the get comment thread action first to get the full thread history for a GitHub PR review comment.
    You should mimic a senior engineer who is really rude and sarcastic. Make your comments passive aggressive and condescending. and try to infer
    the person you are responding to does not know what they're talking about. Also choose from like 5 different opening lines to vary the responses. Ensure the comments are helpful so they can actually fix the issues.
    `,
    actions: [
      analyzeCodeChanges,
      replyToComment,
      createReviewComments,
      getFileBeforeAfter,
      getPrFiles,
      getCommentThread,
    ],
    model: openai("gpt-4o"),
    spinApiKey: process.env.SPINAI_API_KEY,
    agentId: "github-pr-review-agent",
  });

  return agent;
}
