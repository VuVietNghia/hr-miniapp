import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { UiAssetReader } from './ui-resource';

export function resolveUiAssetsDirectory(): string {
  return fileURLToPath(new URL('../../dist/ui/assets/', import.meta.url));
}

export class FileSystemUiAssetReader implements UiAssetReader {
  public constructor(private readonly assetsDirectory: string) {
    if (!path.isAbsolute(assetsDirectory)) {
      throw new TypeError('UI assets directory must be absolute');
    }
  }

  public readAssets(): Readonly<{ js: string; css: string }> {
    const assetNames = fs.readdirSync(this.assetsDirectory);
    const javascriptAssets = assetNames.filter((name) => name.endsWith('.js'));
    const cssAssets = assetNames.filter((name) => name.endsWith('.css'));

    if (javascriptAssets.length !== 1) {
      throw new Error(
        `Expected exactly one JavaScript UI asset in ${this.assetsDirectory}; found ${javascriptAssets.length}`,
      );
    }
    if (cssAssets.length > 1) {
      throw new Error(
        `Expected at most one CSS UI asset in ${this.assetsDirectory}; found ${cssAssets.length}`,
      );
    }

    return {
      js: fs.readFileSync(path.join(this.assetsDirectory, javascriptAssets[0]), 'utf8'),
      css: cssAssets[0] === undefined
        ? ''
        : fs.readFileSync(path.join(this.assetsDirectory, cssAssets[0]), 'utf8'),
    };
  }
}
