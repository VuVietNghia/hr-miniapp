import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import packageJson from '../../package.json';

function sourceFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(absolute);
    return /\.(ts|tsx)$/.test(entry.name) ? [absolute] : [];
  });
}

describe('PrivOS SDK boundary', () => {
  it('uses registry SDK packages and no legacy namespace', () => {
    const packageText = JSON.stringify(packageJson);
    const sourceText = sourceFiles(path.resolve('src'))
      .map((file) => fs.readFileSync(file, 'utf8'))
      .join('\n');

    expect(packageText).not.toContain('file:../privos-app-packages');
    expect(packageText).not.toContain('@privos/app-react');
    expect(sourceText).not.toContain("'@privos/app-react'");
    expect(packageJson.dependencies?.['@privos_ai/app-server']).toBe('^0.9.0');
    expect(packageJson.devDependencies?.['@privos_ai/app-react']).toBe('^0.5.0');
  });
});
