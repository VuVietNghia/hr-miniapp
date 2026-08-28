/**
 * MCP JSON-RPC method handlers for the relay demo app.
 * UI is delivered fully inline via resources/read — no external URL references.
 * In production: reads built assets from dist/ui/ and embeds them in HTML.
 * In development: reads source and builds on-the-fly via Vite.
 */
import fs from 'fs';
import path from 'path';

import _pkg from '../package.json';
import { callHubTool } from './relay-client';
import { EmailHistoryRepository } from './services/EmailHistoryRepository';
import { mailService } from './services/MailService';
import { TrackedMailService } from './services/TrackedMailService';
import { isValidEmailAddress } from './utils/email-validation';

const pkg = _pkg as Record<string, any>;
const TOOL_NAME = 'hr_management_dashboard';
const UI_RESOURCE_URI = 'ui://demo-hr-management/form.html';
const trackedMailService = new TrackedMailService(
	new EmailHistoryRepository(callHubTool),
	mailService,
);

/** Read icon as data URI from package.json icon path */
function getIconDataUri(): string | undefined {
	const iconPath = pkg.icon?.startsWith('/') ? path.join(__dirname, '..', pkg.icon) : undefined;
	if (!iconPath || !fs.existsSync(iconPath)) return undefined;
	const ext = path.extname(iconPath).slice(1);
	const mime = ext === 'svg' ? 'image/svg+xml' : `image/${ext}`;
	const data = fs.readFileSync(iconPath).toString('base64');
	return `data:${mime};base64,${data}`;
}
const appIcon = getIconDataUri();

/** Cache the built UI HTML — invalidated when dist changes (dev watch mode) */
let cachedUiHtml: string | null = null;
let lastBuildMtime = 0;

/**
 * When set, the UI is served live from a Vite dev server at this public origin
 * (HMR + breakpoints) instead of an inlined production bundle. See dev-server.ts.
 */
let devPublicUrl: string | null = null;

/** Enable dev mode: iframe loads UI from the Vite dev server at `publicUrl`. */
export function setDevPublicUrl(publicUrl: string): void {
	devPublicUrl = publicUrl.replace(/\/$/, '');
}

/** Clear cache so next resources/read picks up rebuilt UI */
export function invalidateUiCache(): void {
	cachedUiHtml = null;
}

/** Handle an incoming MCP JSON-RPC request and return the result */
export async function handleMcpMessage(method: string, _id: number, params: any): Promise<any> {
	switch (method) {
		case 'initialize':
			return {
				protocolVersion: '2025-03-26',
				capabilities: {
					tools: {},
					extensions: {
						'io.modelcontextprotocol/ui': {
							mimeTypes: ['text/html;profile=mcp-app'],
						},
					},
				},
				serverInfo: {
				name: pkg.title || pkg.name,
				version: pkg.version,
				...(appIcon && { icon: appIcon }),
				// Advertise the manifest's requested scopes so the hub can refresh
				// `requestedScopes` on reconnect/refresh without a re-pair.
				...(Array.isArray(pkg.scopes) && { scopes: pkg.scopes }),
			},
			};

		case 'notifications/initialized':
			return {};

		case 'tools/list':
			return {
				tools: [
					{
						name: 'debug_log',
						title: 'Debug Log',
						description: 'Log to IDE terminal',
						inputSchema: { type: 'object' }
					},
					{
						name: TOOL_NAME,
						title: pkg.title || 'Demo HR Management',
						description: pkg.description || 'HR management dashboard',
						inputSchema: {
							type: 'object',
							properties: { roomId: { type: 'string' } },
						},
						_meta: {
							ui: { resourceUri: UI_RESOURCE_URI },
						},
					},
					{
						name: 'hrm.payroll.query',
						title: 'Query Payroll Data',
						description: 'Query payroll records (Requires Password)',
						inputSchema: { type: 'object' }
					},
					{
						name: 'hrm.mail.send',
						title: 'Send Email via HR System',
						description: 'Send an email to a candidate or employee using the backend email service and queue to avoid rate limits.',
						inputSchema: {
							type: 'object',
							properties: {
								toName: { type: 'string', description: 'Name of the recipient' },
								toEmail: { type: 'string', description: 'Email address of the recipient' },
								subject: { type: 'string', description: 'Subject of the email' },
								htmlContent: { type: 'string', description: 'HTML content of the email' },
								roomId: { type: 'string', description: 'Room that owns the email history' },
								source: { type: 'string', enum: ['cv_scored', 'lifecycle'] },
								cvItemId: { type: 'string' },
								cvListId: { type: 'string' },
								jdName: { type: 'string' },
								requestedBy: { type: 'string' }
							},
							required: ['toName', 'toEmail', 'subject', 'htmlContent']
						}
					},
					{
						name: 'hrm.mail.retry',
						title: 'Retry a failed HR email',
						description: 'Retry a failed Room email using its original recipient and content.',
						inputSchema: {
							type: 'object',
							properties: {
								roomId: { type: 'string' },
								itemId: { type: 'string' }
							},
							required: ['roomId', 'itemId']
						}
					},
					{
						name: 'hrm.payroll.create',
						title: 'Create Payroll Data',
						description: 'Create a payroll record (Requires Password)',
						inputSchema: { type: 'object' }
					},
					{
						name: 'hrm.payroll.update',
						title: 'Update Payroll Data',
						description: 'Update a payroll record (Requires Password)',
						inputSchema: { type: 'object' }
					},
					{
						name: 'hrm.payroll.delete',
						title: 'Delete Payroll Data',
						description: 'Delete a payroll record (Requires Password)',
						inputSchema: { type: 'object' }
					}
				],
			};

		case 'tools/call':
			if (params?.name === 'debug_log') {
				console.log('\n\n--- [FRONTEND DEBUG LOG] ---');
				console.log(params.arguments?.message);
				console.log(JSON.stringify(params.arguments?.data, null, 2));
				console.log('----------------------------\n\n');
				return { content: [{ type: 'text', text: 'Logged to terminal' }] };
			}

			if (params?.name?.startsWith('hrm.payroll.')) {
				// Map hrm.payroll.* back to privos.db.*
				const hubToolName = params.name.replace('hrm.payroll.', 'privos.db.');
				
				// Remove the password from arguments before sending to the database to keep logs clean
				const safeArgs = { ...params.arguments };
				delete safeArgs.password;
				
				const result = await callHubTool(hubToolName, safeArgs);
				return result;
			}

			if (params?.name === 'hrm.mail.send') {
				const args = params.arguments;
				console.log('[MCP DEBUG] Đã nhận yêu cầu hrm.mail.send:', { toEmail: args?.toEmail, subject: args?.subject });
				
				if (!args?.toName || !args?.toEmail || !args?.subject || !args?.htmlContent) {
					throw new Error('Missing required arguments for hrm.mail.send');
				}
				if (!isValidEmailAddress(args.toEmail)) {
					throw new Error('Recipient email is invalid for hrm.mail.send');
				}
				
				if (args.roomId || args.source) {
					if (!args.roomId || args.source !== 'cv_scored') {
						throw new Error('Tracked mail requires roomId and source=cv_scored in phase one');
					}
					const record = await trackedMailService.send({
						roomId: args.roomId,
						source: args.source,
						recipientName: args.toName,
						recipientEmail: args.toEmail,
						subject: args.subject,
						htmlContent: args.htmlContent,
						cvItemId: args.cvItemId,
						cvListId: args.cvListId,
						jdName: args.jdName,
						requestedBy: args.requestedBy,
					});
					return {
						content: [{ type: 'text', text: JSON.stringify({ itemId: record.id, status: record.status }) }]
					};
				}

				await mailService.queueMail({
					toName: args.toName,
					toEmail: args.toEmail,
					subject: args.subject,
					htmlContent: args.htmlContent,
				});

				return {
					content: [
						{ type: 'text', text: 'Email has been sent successfully.' }
					]
				};
			}

			if (params?.name === 'hrm.mail.retry') {
				const args = params.arguments;
				if (!args?.roomId || !args?.itemId) {
					throw new Error('Missing required arguments for hrm.mail.retry');
				}
				const record = await trackedMailService.retry(args.roomId, args.itemId);
				return {
					content: [{ type: 'text', text: JSON.stringify({ itemId: record.id, status: record.status }) }]
				};
			}

			if (params?.name !== TOOL_NAME) {
				throw new Error(`Unknown tool: ${params?.name || '<missing>'}`);
			}
			return {
				content: [
					{
						type: 'resource',
						resource: {
							uri: UI_RESOURCE_URI,
							mimeType: 'text/html;profile=mcp-app',
							text: getInlineUiHtml(),
						},
					},
				],
			};

		case 'resources/read':
			return {
				contents: [
					{
						uri: params?.uri || UI_RESOURCE_URI,
						mimeType: 'text/html;profile=mcp-app',
						text: getInlineUiHtml(),
					},
				],
			};

		default:
			throw new Error(`Unknown method: ${method}`);
	}
}

/**
 * Build HTML referencing a live Vite dev server (HMR + TypeScript breakpoints).
 * Loads @vite/client and the React Fast Refresh preamble cross-origin from the
 * tunnel, then the real entry module — equivalent to what Vite injects into a
 * transformed index.html, but emitted here since the relay serves the document.
 */
function getDevUiHtml(publicUrl: string): string {
	const base = `${publicUrl}/ui`;
	return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${pkg.title || 'Demo HR Management'} (dev)</title>
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

/**
 * Build a fully self-contained HTML page with inlined JS and CSS.
 * Reads from dist/ui/ (Vite build output). Run `npm run build` first.
 */
function getInlineUiHtml(): string {
	// Dev mode: serve live from the Vite dev server for HMR + breakpoints.
	if (devPublicUrl) return getDevUiHtml(devPublicUrl);

	const distDir = path.join(__dirname, '../dist/ui');

	// In dev watch mode, check if build output changed since last cache
	const indexHtmlPath = path.join(distDir, 'index.html');
	if (fs.existsSync(indexHtmlPath)) {
		const stat = fs.statSync(indexHtmlPath);
		if (stat.mtimeMs !== lastBuildMtime) {
			cachedUiHtml = null;
			lastBuildMtime = stat.mtimeMs;
		}
	}

	if (cachedUiHtml) return cachedUiHtml;

	if (!fs.existsSync(indexHtmlPath)) {
		throw new Error('UI not built. Run `npm run build` first, then restart.');
	}

	cachedUiHtml = fs.readFileSync(indexHtmlPath, 'utf-8');

	return cachedUiHtml;
}
