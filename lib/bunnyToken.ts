import crypto from 'crypto';

/**
 * Generates a Bunny Stream "Embed View" token, following Bunny's official formula exactly:
 *   token = hex(SHA256(libraryApiKey + videoId + expires))
 * The libraryApiKey is read from an environment variable — it must NEVER be hardcoded
 * or committed to source control (this repo is public).
 */
export function generateBunnyEmbedToken(videoId: string, expiresInSeconds = 300) {
  const apiKey = process.env.BUNNY_LIBRARY_API_KEY;
  if (!apiKey) {
    throw new Error('BUNNY_LIBRARY_API_KEY is not set in the environment');
  }

  const expires = Math.floor(Date.now() / 1000) + expiresInSeconds;
  const hash = crypto.createHash('sha256');
  hash.update(apiKey + videoId + expires);
  const token = hash.digest('hex');

  return { token, expires };
}
