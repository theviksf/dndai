import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_ENDPOINT = process.env.R2_ENDPOINT;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME;

// Initialize S3 client for Cloudflare R2
const s3Client = new S3Client({
  region: 'auto',
  endpoint: R2_ENDPOINT,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID!,
    secretAccessKey: R2_SECRET_ACCESS_KEY!,
  },
});

export interface CharacterImageMetadata {
  age: string;
  sex: string;
  race: string;
  job: string;
  mood?: string;
  sessionId: string;
}

export interface LocationImageMetadata {
  environment: string;
  timeOfDay: string;
  weather?: string;
  region?: string;
  vibe: string;
  sessionId: string;
}

/**
 * Sanitize a string for use in filenames by replacing spaces and special characters with underscores
 */
function sanitizeForFilename(str: string): string {
  return str.replace(/[^a-zA-Z0-9-]/g, '_');
}

/**
 * Generate filename for character images
 * Format: char_[age]-[sex]-[race]-[job]-[mood]_[sessionId]_[timestamp].jpg
 */
export function generateCharacterFilename(metadata: CharacterImageMetadata): string {
  const timestamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0]; // Format: 20251005T221030
  const parts = [
    sanitizeForFilename(metadata.age || 'NA'),
    sanitizeForFilename(metadata.sex || 'NA'),
    sanitizeForFilename(metadata.race || 'NA'),
    sanitizeForFilename(metadata.job || 'NA'),
    sanitizeForFilename(metadata.mood || 'NA'),
  ];
  
  const filename = `char_${parts.join('-')}_${metadata.sessionId}_${timestamp}.jpg`;
  return filename;
}

/**
 * Generate filename for location images
 * Format: loc_[environment]-[timeOfDay]-[weather]-[region]-[vibe]_[sessionId]_[timestamp].jpg
 */
export function generateLocationFilename(metadata: LocationImageMetadata): string {
  const timestamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0]; // Format: 20251005T221030
  const parts = [
    sanitizeForFilename(metadata.environment || 'NA'),
    sanitizeForFilename(metadata.timeOfDay || 'NA'),
    sanitizeForFilename(metadata.weather || 'NA'),
    sanitizeForFilename(metadata.region || 'NA'),
    sanitizeForFilename(metadata.vibe || 'NA'),
  ];
  
  const filename = `loc_${parts.join('-')}_${metadata.sessionId}_${timestamp}.jpg`;
  return filename;
}

/**
 * Upload base64 image to Cloudflare R2 and return public URL
 */
export async function uploadImageToR2(
  base64Image: string,
  filename: string
): Promise<string> {
  // Remove data URL prefix if present
  const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, '');
  const buffer = Buffer.from(base64Data, 'base64');

  const command = new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: filename,
    Body: buffer,
    ContentType: 'image/jpeg',
  });

  await s3Client.send(command);

  // Construct public URL (R2 public URL format)
  // You may need to configure a custom domain or public bucket URL in Cloudflare
  const publicUrl = `${R2_ENDPOINT}/${R2_BUCKET_NAME}/${filename}`;
  
  return publicUrl;
}
