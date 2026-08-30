import { describe, expect, it } from 'vitest';

import manifest from '../../privos-app.json';
import { HR_TOOL_DEFINITIONS } from '../../src/mcp/tool-definitions';

describe('MCP tool parity', () => {
  it('keeps runtime tools identical to the reviewed manifest', () => {
    expect(HR_TOOL_DEFINITIONS).toEqual(manifest.tools);
  });
});
