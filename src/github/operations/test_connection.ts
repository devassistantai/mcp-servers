import { z } from "zod";
import { githubRequest } from "../common/utils.js";
import { GitHubOwnerSchema } from "../common/types.js";

// Schema definition
export const TestConnectionSchema = z.object({
  random_string: z.string().describe("Dummy parameter for no-parameter tools"),
});

/**
 * Tests the GitHub API connection and token validity
 * by fetching the authenticated user's information
 */
export async function testConnection() {
  try {
    // Check if token exists
    const token = process.env.GITHUB_TOKEN;
    if (!token) {
      return {
        success: false,
        message: "GitHub token is not configured.",
        isValid: false
      };
    }
    
    // Make a simple API request to check authentication
    const response = await githubRequest("https://api.github.com/user");
    const user = GitHubOwnerSchema.parse(response);
    
    return {
      success: true,
      message: "GitHub API connection successful!",
      user,
      isValid: true
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Unknown error occurred",
      isValid: false,
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }
} 