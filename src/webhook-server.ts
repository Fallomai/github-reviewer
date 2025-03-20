import { Hono } from "hono";
import { serve } from "@hono/node-server";
import * as dotenv from "dotenv";
import {
  handleNewPullRequest,
  handleIssueComment,
  handleReviewComment,
} from "./pr-handlers.js";
import { startQueueProcessor } from "./pr-queue.js";

// Load environment variables
dotenv.config();

/**
 * Start the webhook server
 */
export async function startServer() {
  const app = new Hono();
  const port = process.env.PORT || 3000;

  // Start the queue processor
  startQueueProcessor();

  // Health check endpoint
  app.get("/", (c) => c.text("GitHub PR Review Bot is running"));

  // Webhook endpoint for GitHub events
  app.post("/webhook", async (c) => {
    try {
      const payload = await c.req.json();
      const event = c.req.header("X-GitHub-Event");

      if (!event) {
        return c.json({ error: "Missing X-GitHub-Event header" }, 400);
      }

      console.log(`Received ${event} event`);

      // Get installation ID from the webhook payload
      const installationId = payload.installation?.id;
      if (!installationId) {
        return c.json({ error: "Missing installation ID in webhook" }, 400);
      }

      // Handle each event type
      switch (event) {
        case "pull_request":
          if (payload.action === "opened" || payload.action === "synchronize") {
            // Queue the job and respond immediately
            handleNewPullRequest({ payload, installationId });
          }
          break;
        case "issue_comment":
          if (payload.action === "created" && !payload.comment?.body?.startsWith("🤖 ")) {
            // Queue the job and respond immediately
            handleIssueComment({ payload, installationId });
          }
          break;
        case "pull_request_review_comment":
          if (payload.action === "created" && !payload.comment?.body?.startsWith("🤖 ")) {
            // Queue the job and respond immediately
            handleReviewComment({ payload, installationId });
          }
          break;
      }

      // Return success response immediately
      return c.json({ status: "Accepted" }, 202);
    } catch (error) {
      console.error("Error processing webhook:", error);
      return c.json({ error: "Internal server error" }, 500);
    }
  });

  serve(
    {
      fetch: app.fetch,
      port: Number(port),
    },
    (info) => {
      console.log(`PR Review Bot server running at http://localhost:${info.port}`);
    }
  );
}

// Start the server only when executed directly
if (process.argv[1]?.endsWith("webhook-server.js")) {
  startServer().catch((error) => {
    console.error("Failed to start server:", error);
    process.exit(1);
  });
}