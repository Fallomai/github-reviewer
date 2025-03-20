import { Hono } from "hono";
import { serve } from "@hono/node-server";
import * as dotenv from "dotenv";
import {
  handleNewPullRequest,
  handleIssueComment,
  handleReviewComment,
} from "./pr-handlers.js";
import { getTokenForWebhook } from "./auth.js";
import { getPRReviewAgent } from "./github-agent.js";

// Load environment variables
dotenv.config();

/**
 * Start the webhook server
 */
export async function startServer() {
  const app = new Hono();
  const port = process.env.PORT || 3000;

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

      // **Return response immediately to prevent timeout**
      c.json({ status: "Accepted" });

      // **Process webhook asynchronously**
      (async () => {
        try {
          const installationId = payload.installation?.id;
          if (!installationId) {
            console.error("Missing installation ID in webhook");
            return;
          }

          const token = await getTokenForWebhook(installationId);
          const agent = await getPRReviewAgent();

          switch (event) {
            case "pull_request":
              if (payload.action === "opened" || payload.action === "synchronize") {
                await handleNewPullRequest({ payload, agent, token });
              }
              break;
            case "issue_comment":
              if (payload.action === "created" && !payload.comment?.body?.startsWith("🤖 ")) {
                await handleIssueComment({ payload, agent, token });
              }
              break;
            case "pull_request_review_comment":
              if (payload.action === "created" && !payload.comment?.body?.startsWith("🤖 ")) {
                await handleReviewComment({ payload, agent, token });
              }
              break;
          }
        } catch (error) {
          console.error("Error processing webhook:", error);
        }
      })();

      return; // **Prevents further blocking of request**
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