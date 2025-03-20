import * as dotenv from "dotenv";
import { startServer } from "./webhook-server.js";

// Load environment variables
dotenv.config();

// Start the webhook server
startServer().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
