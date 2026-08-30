import { describe, expect, it } from 'vitest';
import manifest from '../../privos-app.json';
import packageJson from '../../package.json';
import { getAppIconDataUri } from '../../src/app-icon';
import {
  buildRelayAppDescriptor,
  createManifest,
  MARKETPLACE_MANIFEST_FIELDS,
} from '../../src/manifest';
import { APP_TOOL_NAMES } from '../../src/mcp/tool-names';

const payrollRecordSchema = {
  type: 'object',
  properties: {
    employeeId: { type: 'string' },
    baseSalary: { type: 'number' },
    taxId: { type: 'string' },
    bankAccount: { type: 'string' },
    bankName: { type: 'string' },
    contractType: { type: 'string' },
    applyProbationRate: { type: 'boolean' },
    probationRate: { type: 'number' },
  },
  required: ['employeeId', 'baseSalary', 'taxId', 'bankAccount'],
  additionalProperties: false,
};

const expectedToolSchemas = [
  {
    type: 'object',
    properties: { roomId: { type: 'string' } },
    additionalProperties: false,
  },
  {
    type: 'object',
    properties: {},
    additionalProperties: false,
  },
  {
    type: 'object',
    properties: {
      toName: { type: 'string' },
      toEmail: { type: 'string' },
      subject: { type: 'string' },
      htmlContent: { type: 'string' },
      roomId: { type: 'string' },
      source: { type: 'string', enum: ['cv_scored', 'lifecycle'] },
      cvItemId: { type: 'string' },
      cvListId: { type: 'string' },
      jdName: { type: 'string' },
    },
    required: ['toName', 'toEmail', 'subject', 'htmlContent'],
    additionalProperties: false,
  },
  {
    type: 'object',
    properties: {
      roomId: { type: 'string' },
      itemId: { type: 'string' },
    },
    required: ['roomId', 'itemId'],
    additionalProperties: false,
  },
  {
    type: 'object',
    properties: { record: payrollRecordSchema },
    required: ['record'],
    additionalProperties: false,
  },
  {
    type: 'object',
    properties: { id: { type: 'string' }, record: payrollRecordSchema },
    required: ['id', 'record'],
    additionalProperties: false,
  },
  {
    type: 'object',
    properties: { id: { type: 'string' } },
    required: ['id'],
    additionalProperties: false,
  },
];

describe('publisher manifest', () => {
  it('has the exact schema-v3 identity, runtime, policy, tier, and environment envelope', () => {
    expect(Object.keys(manifest)).toEqual(MARKETPLACE_MANIFEST_FIELDS);
    expect({
      schemaVersion: manifest.schemaVersion,
      kind: manifest.kind,
      name: manifest.name,
      version: manifest.version,
      title: manifest.title,
      description: manifest.description,
      icon: manifest.icon,
      author: manifest.author,
      homepage: manifest.homepage,
      repository: manifest.repository,
      availabilityTier: manifest.availabilityTier,
      capabilities: manifest.capabilities,
      agentBot: manifest.agentBot,
      port: manifest.port,
      resources: manifest.resources,
      volumes: manifest.volumes,
      stateless: manifest.stateless,
      resourceManifestTemplate: manifest.resourceManifestTemplate,
    }).toEqual({
      schemaVersion: 3,
      kind: 'mcp-app',
      name: 'ai.privos.demo-hr-management-ws',
      version: '2.0.0',
      title: 'HR Mini app V3',
      description: 'PrivOS Room-scoped HR management application for recruitment, CV processing, employee lifecycle, payroll, email history, and document drafting.',
      icon: '/public/images/company-logos/logo.svg',
      author: { name: 'PrivOS AI', email: 'dev@privos.ai', website: 'https://privos.ai' },
      homepage: 'https://privos.ai',
      repository: 'https://github.com/PrivOS-AI/privos-demo-hrm-ws',
      availabilityTier: 'single',
      capabilities: { verifiedActor: true },
      agentBot: { name: 'HR Mini App Service', slug: 'hr-mini-app-service' },
      port: 3000,
      resources: { memoryMb: 256, cpus: 0.25, tmpSizeMb: 64 },
      volumes: [],
      stateless: true,
      resourceManifestTemplate: [],
    });
    expect(manifest.dataPolicy).toEqual({
      version: '2026-08-29',
      retention: 'HR records, including tracked email content and delivery metadata, remain in the PrivOS Room until an authorized user deletes them; the stateless app container keeps no local persistent copy.',
      externalProcessing: true,
    });
    expect(manifest.license).toEqual({
      tiers: [{ id: 'default', name: 'Free', features: [] }],
    });
    expect(manifest.env).toEqual([
      { key: 'EMAILJS_SERVICE_ID', description: 'EmailJS service identifier used by the HR email delivery client.', required: true, secret: false },
      { key: 'EMAILJS_TEMPLATE_ID', description: 'EmailJS template identifier used for tracked HR email delivery.', required: true, secret: false },
      { key: 'EMAILJS_PUBLIC_KEY', description: 'EmailJS public runtime key used for tracked HR email delivery.', required: true, secret: false },
      { key: 'EMAILJS_PRIVATE_KEY', description: 'Optional EmailJS private key for authenticated HR email delivery.', required: false, secret: true },
      { key: 'PRIVOS_AGENT_BOT_CREDENTIAL', description: 'Installation agent-bot credential injected by the PrivOS platform.', required: false, secret: true },
      { key: 'PRIVOS_AGENT_BOT_USER_ID', description: 'Installation agent-bot user identifier injected by the PrivOS platform.', required: false, secret: false },
    ]);
    expect(manifest.name).toBe(packageJson.name);
    expect(manifest.version).toBe(packageJson.version);
    expect(manifest.title).toBe(packageJson.title);
    expect('scopes' in packageJson).toBe(false);
  });

  it('exposes exactly seven ordered tools with closed allowlisted input schemas', () => {
    expect(manifest.tools).toHaveLength(7);
    expect(manifest.tools.map((tool) => tool.name)).toEqual(Object.values(APP_TOOL_NAMES));
    expect(manifest.tools.map((tool) => tool.inputSchema)).toEqual(expectedToolSchemas);
    expect(manifest.tools[0]?.ui?.resourceUri).toBe('ui://demo-hr-management/form.html');

    for (const tool of manifest.tools) {
      const closed = 'additionalProperties' in tool.inputSchema
        ? tool.inputSchema.additionalProperties
        : undefined;
      expect(closed, `${tool.name} must reject undeclared top-level keys`).toBe(false);
    }

    let recordSchemaCount = 0;
    for (const tool of manifest.tools) {
      const recordSchema = 'record' in tool.inputSchema.properties
        ? tool.inputSchema.properties.record
        : undefined;
      if (recordSchema !== undefined) {
        recordSchemaCount += 1;
        expect(recordSchema.additionalProperties).toBe(false);
      }
    }
    expect(recordSchemaCount).toBe(2);

    const forbiddenAuthorityKeys = ['roomId', 'collection', 'filter', 'where'];
    for (const tool of manifest.tools.filter((item) => item.name.startsWith('hrm.payroll.'))) {
      const propertyNames = Object.keys(tool.inputSchema.properties);
      for (const forbiddenKey of forbiddenAuthorityKeys) {
        expect(propertyNames, `${tool.name} exposes caller authority key ${forbiddenKey}`)
          .not.toContain(forbiddenKey);
      }
    }
  });

  it('projects only the canonical publisher manifest into the Relay descriptor', () => {
    expect(Object.keys(createManifest())).toEqual(MARKETPLACE_MANIFEST_FIELDS);
    expect(createManifest()).toEqual(manifest);
    expect(buildRelayAppDescriptor()).toMatchObject({
      id: manifest.name,
      name: manifest.name,
      version: manifest.version,
      title: manifest.title,
      description: manifest.description,
      homepage: manifest.homepage,
      author: manifest.author,
      permissions: manifest.permissions,
      manifestIcon: manifest.icon,
    });
  });

  it('loads the manifest icon as an SVG data URI', () => {
    expect(getAppIconDataUri()).toMatch(/^data:image\/svg\+xml;base64,/);
  });

  it('contains none of the prohibited reference-demo extras', () => {
    const manifestText = JSON.stringify(manifest).toLowerCase();
    expect(manifest.tools.map((tool) => tool.name)).not.toEqual(expect.arrayContaining([
      'hr_whoami',
      'hr_bulk_export',
      'hr_agent_bot_credential_check',
    ]));
    expect(manifest.permissions.map((permission) => permission.scope))
      .not.toContain('sandbox:agent-sets:upload');
    expect(manifestText).not.toContain('youtube');
    expect(manifestText).not.toContain('app objects');
    expect(manifestText).not.toContain('bulk-export');
    expect(manifestText).not.toContain('"csp"');
    expect(manifestText).not.toContain('"limits"');
  });
});
