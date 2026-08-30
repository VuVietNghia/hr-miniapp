import packageJson from '../../package.json';

export const HR_UI_RESOURCE_URI = 'ui://demo-hr-management/form.html';
export const HR_UI_RESOURCE_MIME = 'text/html;profile=mcp-app' as const;

export interface UiAssetReader {
  readAssets(): Readonly<{ js: string; css: string }>;
}

export interface HrUiResourceProvider {
  read(uri: string): Readonly<{
    uri: string;
    mimeType: typeof HR_UI_RESOURCE_MIME;
    text: string;
  }>;
  setDevPublicUrl(url: string | null): void;
}

function neutralizeJavaScriptRawTextClosings(source: string): string {
  return source.replace(/<\/script/gi, (closingPrefix) => `<\\/${closingPrefix.slice(2)}`);
}

function neutralizeCssRawTextClosings(source: string): string {
  return source.replace(/<\/style/gi, (closingPrefix) => `<\\/${closingPrefix.slice(2)}`);
}

function productionHtml(assets: Readonly<{ js: string; css: string }>): string {
  const safeJavaScript = neutralizeJavaScriptRawTextClosings(assets.js);
  const safeCss = neutralizeCssRawTextClosings(assets.css);
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${packageJson.title}</title>
  <style>${safeCss}</style>
</head>
<body>
  <div id="root"></div>
  <script type="module">${safeJavaScript}</script>
</body>
</html>`;
}

function developmentHtml(publicUrl: string): string {
  const base = `${publicUrl}/ui`;
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${packageJson.title} (dev)</title>
  <script type="module" src="${base}/@vite/client"></script>
  <script type="module">
    import RefreshRuntime from "${base}/@react-refresh";
    RefreshRuntime.injectIntoGlobalHook(window);
    window.$RefreshReg$ = () => {};
    window.$RefreshSig$ = () => (type) => type;
    window.__vite_plugin_react_preamble_installed__ = true;
  </script>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="${base}/main.tsx"></script>
</body>
</html>`;
}

export function createUiResourceProvider(dependencies: {
  assetReader: UiAssetReader;
}): HrUiResourceProvider {
  let devPublicUrl: string | null = null;

  return {
    read(uri) {
      if (uri !== HR_UI_RESOURCE_URI) {
        throw new Error(`Unknown UI resource URI: ${uri}`);
      }

      return {
        uri: HR_UI_RESOURCE_URI,
        mimeType: HR_UI_RESOURCE_MIME,
        text: devPublicUrl === null
          ? productionHtml(dependencies.assetReader.readAssets())
          : developmentHtml(devPublicUrl),
      };
    },
    setDevPublicUrl(url) {
      devPublicUrl = url === null ? null : url.replace(/\/$/, '');
    },
  };
}
