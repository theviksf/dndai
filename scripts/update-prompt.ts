#!/usr/bin/env tsx

/**
 * CLI Script to update prompt files with automatic timestamped backups
 * 
 * Usage:
 *   npx tsx scripts/update-prompt.ts <promptType> <contentFilePath>
 * 
 * Example:
 *   npx tsx scripts/update-prompt.ts primary prompts/primary.md
 * 
 * This will:
 * 1. Read the new content from the specified file
 * 2. Create a timestamped backup of the existing prompt (e.g., primary-2025-10-07T06-30-45.md)
 * 3. Update the prompt file with the new content
 */

import { readFile, writeFile, copyFile } from 'fs/promises';
import { join } from 'path';

const VALID_PROMPT_TYPES = ['primary', 'parser', 'imageCharacter', 'imageLocation'];

const FILE_MAP: Record<string, string> = {
  primary: 'primary.md',
  parser: 'parser.md',
  imageCharacter: 'image-character.md',
  imageLocation: 'image-location.md',
};

async function updatePrompt(promptType: string, newContent: string) {
  const filename = FILE_MAP[promptType];
  if (!filename) {
    throw new Error(`Invalid promptType. Must be one of: ${VALID_PROMPT_TYPES.join(', ')}`);
  }

  const promptsDir = join(process.cwd(), 'prompts');
  const filepath = join(promptsDir, filename);
  
  // Create backup with timestamp
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const backupFilename = filename.replace('.md', `-${timestamp}.md`);
  const backupPath = join(promptsDir, backupFilename);
  
  let backupCreated = false;
  try {
    // Copy existing file to backup
    await copyFile(filepath, backupPath);
    backupCreated = true;
    console.log(`✓ Created backup: ${backupFilename}`);
  } catch (copyError: any) {
    // If file doesn't exist yet, that's okay (new file)
    if (copyError.code === 'ENOENT') {
      console.log('ℹ No existing file to backup (creating new file)');
    } else {
      // Any other error means backup failed - abort the update
      throw new Error(`Failed to create backup: ${copyError.message}. Update aborted to prevent data loss.`);
    }
  }
  
  // Write new content only if backup succeeded or file is new
  await writeFile(filepath, newContent, 'utf-8');
  console.log(`✓ Updated ${filename}`);
  
  return { filename, backupFilename: backupCreated ? backupFilename : null };
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.error('Usage: npx tsx scripts/update-prompt.ts <promptType> <contentFilePath>');
    console.error('');
    console.error('Valid prompt types:', VALID_PROMPT_TYPES.join(', '));
    console.error('');
    console.error('Example:');
    console.error('  npx tsx scripts/update-prompt.ts primary prompts/primary.md');
    process.exit(1);
  }

  const [promptType, contentFilePath] = args;

  if (!VALID_PROMPT_TYPES.includes(promptType)) {
    console.error(`Error: Invalid promptType "${promptType}"`);
    console.error(`Valid types: ${VALID_PROMPT_TYPES.join(', ')}`);
    process.exit(1);
  }

  try {
    // Read new content from file
    const newContent = await readFile(contentFilePath, 'utf-8');
    
    // Update prompt with backup
    const result = await updatePrompt(promptType, newContent);
    
    console.log('');
    console.log('✓ Prompt update complete!');
    console.log(`  Updated: prompts/${result.filename}`);
    if (result.backupFilename) {
      console.log(`  Backup: prompts/${result.backupFilename}`);
    } else {
      console.log(`  Backup: None (new file created)`);
    }
  } catch (error: any) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
