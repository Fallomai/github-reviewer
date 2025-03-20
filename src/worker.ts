/**
 * Worker process for processing PR review jobs
 */
import * as dotenv from "dotenv";
import { startQueueProcessor } from "./pr-queue.js";

// Load environment variables
dotenv.config();

console.log("Starting PR review worker process");

// Start the queue processor
const queue = startQueueProcessor();

// Handle graceful shutdown
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

async function shutdown() {
  console.log("Worker shutting down");
  
  try {
    await queue.close();
    console.log("Queue closed");
    process.exit(0);
  } catch (error) {
    console.error("Error during shutdown:", error);
    process.exit(1);
  }
}

console.log("Worker ready and listening for jobs");