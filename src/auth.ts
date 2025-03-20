import axios from "axios";

/**
 * Get an installation access token from a webhook payload's installation ID
 */
export async function getTokenForWebhook(
  installationId: string
): Promise<string> {
  const APP_ID = process.env.GITHUB_APP_ID;
  const rawKey = process.env.GITHUB_APP_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!APP_ID || !rawKey) {
    throw new Error("Missing required GitHub App credentials");
  }

  // Ensure PRIVATE_KEY has correct formatting
  const PRIVATE_KEY = rawKey.includes("-----BEGIN")
    ? rawKey
    : `-----BEGIN RSA PRIVATE KEY-----\n${rawKey}\n-----END RSA PRIVATE KEY-----`;

  // Dynamically import `jsonwebtoken` for ESM compatibility
  const { default: jwt } = await import("jsonwebtoken"); 

  // Generate JWT for getting installation token
  const jwtToken = jwt.sign(
    {
      iat: Math.floor(Date.now() / 1000) - 60,
      exp: Math.floor(Date.now() / 1000) + 600,
      iss: APP_ID,
    },
    PRIVATE_KEY,
    { algorithm: "RS256" }
  );

  // Exchange JWT for installation token
  const response = await axios.post(
    `https://api.github.com/app/installations/${installationId}/access_tokens`,
    {},
    {
      headers: {
        Authorization: `Bearer ${jwtToken}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    }
  );

  return response.data.token;
}

// Cache for installation tokens to avoid unnecessary API calls
const tokenCache: Record<string, { token: string; expiresAt: number }> = {};

/**
 * Get a cached installation access token, refreshing if necessary
 */
export async function getCachedInstallationToken(
  installationId: string
): Promise<string> {
  const now = Date.now();
  const cached = tokenCache[installationId];

  // If we have a cached token that's still valid (with a 5-minute buffer)
  if (cached && cached.expiresAt > now + 300000) {
    return cached.token;
  }

  // Get new token
  const token = await getTokenForWebhook(installationId);

  // Cache token (GitHub tokens expire after 1 hour)
  tokenCache[installationId] = {
    token,
    expiresAt: now + 3600000, // 1 hour from now
  };

  return token;
}

/**
 * Get headers for GitHub API requests
 */
export async function getGitHubHeaders(installationId: string) {
  const token = await getCachedInstallationToken(installationId);

  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}