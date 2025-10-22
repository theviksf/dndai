import type { VercelRequest, VercelResponse } from '@vercel/node';
import { readFile } from 'fs/promises';
import { join } from 'path';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const promptsDir = join(process.cwd(), 'prompts');
    
    // Load all prompts from markdown files
    const [primary, parser, imageCharacter, imageLocation, backstory, revelations, lore] = await Promise.all([
      readFile(join(promptsDir, 'primary.md'), 'utf-8'),
      readFile(join(promptsDir, 'parser.md'), 'utf-8'),
      readFile(join(promptsDir, 'image-character.md'), 'utf-8'),
      readFile(join(promptsDir, 'image-location.md'), 'utf-8'),
      readFile(join(promptsDir, 'backstory.md'), 'utf-8'),
      readFile(join(promptsDir, 'revelations.md'), 'utf-8'),
      readFile(join(promptsDir, 'lore.md'), 'utf-8'),
    ]);
    
    res.json({
      primary,
      parser,
      imageCharacter,
      imageLocation,
      backstory,
      revelations,
      lore,
    });
  } catch (error: any) {
    res.status(500).json({ error: `Failed to load default prompts: ${error.message}` });
  }
}
