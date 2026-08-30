import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';

import { afterEach, describe, expect, it } from 'vitest';

import { FileSystemUiAssetReader } from '../../src/mcp/FileSystemUiAssetReader';
import { createUiResourceProvider } from '../../src/mcp/ui-resource';

const temporaryDirectories: string[] = [];

function temporaryAssetsDirectory(): string {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'hr-ui-assets-'));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

describe('MCP UI resource', () => {
  it('inlines production JS and CSS under the preserved URI', () => {
    const provider = createUiResourceProvider({
      assetReader: {
        readAssets: () => ({ js: 'globalThis.__hrLoaded=true;', css: 'body{color:red}' }),
      },
    });

    const resource = provider.read('ui://demo-hr-management/form.html');

    expect(resource.mimeType).toBe('text/html;profile=mcp-app');
    expect(resource.text).toContain('<style>body{color:red}</style>');
    expect(resource.text).toContain('globalThis.__hrLoaded=true;');
    expect(resource.text).not.toContain('/assets/');
  });

  it('neutralizes mixed-case raw-text closing sequences without changing payload semantics', () => {
    const provider = createUiResourceProvider({
      assetReader: {
        readAssets: () => ({
          js: 'globalThis.result = "</ScRiPt>";',
          css: '.result::after{content:"</StYlE>"}',
        }),
      },
    });

    const html = provider.read('ui://demo-hr-management/form.html').text;
    const scriptOpen = '<script type="module">';
    const scriptStart = html.indexOf(scriptOpen) + scriptOpen.length;
    const scriptEnd = html.indexOf('</script>', scriptStart);
    const script = html.slice(scriptStart, scriptEnd);
    const executionContext: Record<string, unknown> = {};

    expect(html.match(/<\/script/gi) ?? []).toHaveLength(1);
    expect(html.match(/<\/style/gi) ?? []).toHaveLength(1);
    expect(script).toContain('"<\\/ScRiPt>"');
    vm.runInNewContext(script, executionContext);
    expect(executionContext.result).toBe('</ScRiPt>');
    expect(html).toContain('.result::after{content:"<\\/StYlE>"}');
  });

  it('emits the reference Vite client, React refresh, and main module in development', () => {
    const provider = createUiResourceProvider({
      assetReader: {
        readAssets: () => {
          throw new Error('Production assets must not be read in development');
        },
      },
    });
    provider.setDevPublicUrl('https://hr-ui.example.test/');

    const resource = provider.read('ui://demo-hr-management/form.html');

    expect(resource.text).toContain(
      '<script type="module" src="https://hr-ui.example.test/ui/@vite/client"></script>',
    );
    expect(resource.text).toContain(
      'import RefreshRuntime from "https://hr-ui.example.test/ui/@react-refresh";',
    );
    expect(resource.text).toContain(
      '<script type="module" src="https://hr-ui.example.test/ui/main.tsx"></script>',
    );
  });

  it('rejects every non-canonical resource URI', () => {
    const provider = createUiResourceProvider({
      assetReader: { readAssets: () => ({ js: '', css: '' }) },
    });

    expect(() => provider.read('ui://demo-hr-management/other.html')).toThrow(
      'Unknown UI resource URI',
    );
  });
});

describe('filesystem UI asset reader', () => {
  it('reads exactly one JavaScript asset and an optional CSS asset', () => {
    const assetsDirectory = temporaryAssetsDirectory();
    fs.writeFileSync(path.join(assetsDirectory, 'app.js'), 'globalThis.__built=true;');

    expect(new FileSystemUiAssetReader(assetsDirectory).readAssets()).toEqual({
      js: 'globalThis.__built=true;',
      css: '',
    });

    fs.writeFileSync(path.join(assetsDirectory, 'app.css'), 'body{margin:0}');
    expect(new FileSystemUiAssetReader(assetsDirectory).readAssets()).toEqual({
      js: 'globalThis.__built=true;',
      css: 'body{margin:0}',
    });
  });

  it('rejects zero or multiple JavaScript entry assets', () => {
    const assetsDirectory = temporaryAssetsDirectory();
    const reader = new FileSystemUiAssetReader(assetsDirectory);

    expect(() => reader.readAssets()).toThrow('found 0');

    fs.writeFileSync(path.join(assetsDirectory, 'first.js'), 'first');
    fs.writeFileSync(path.join(assetsDirectory, 'second.js'), 'second');
    expect(() => reader.readAssets()).toThrow('found 2');
  });

  it('rejects a relative assets directory', () => {
    expect(() => new FileSystemUiAssetReader('dist/ui/assets')).toThrow(
      'UI assets directory must be absolute',
    );
  });
});
