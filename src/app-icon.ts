import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import publisherManifest from '../privos-app.json';

const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
let cachedIcon: string | undefined | null = null;

export function getAppIconDataUri(): string | undefined {
  if (cachedIcon !== null) return cachedIcon;
  if (!publisherManifest.icon.startsWith('/')) {
    cachedIcon = undefined;
    return cachedIcon;
  }

  const iconPath = path.resolve(moduleDirectory, '..', publisherManifest.icon.slice(1));
  if (!fs.existsSync(iconPath)) {
    cachedIcon = undefined;
    return cachedIcon;
  }

  try {
    const extension = path.extname(iconPath).slice(1).toLowerCase();
    const mimeType = extension === 'svg' ? 'image/svg+xml' : `image/${extension}`;
    cachedIcon = `data:${mimeType};base64,${fs.readFileSync(iconPath).toString('base64')}`;
  } catch {
    cachedIcon = undefined;
  }
  return cachedIcon;
}
