import React, { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const host = vi.hoisted(() => ({
  app: null as null | Readonly<{
    callServerTool(request: unknown): Promise<unknown>;
    rest(request: unknown): Promise<unknown>;
    uploadFile(request: unknown): Promise<unknown>;
  }>,
  context: {
    theme: 'light',
    roomId: 'room-1',
    effectiveScopes: [] as readonly string[],
  },
  payrollRenders: 0,
}));

vi.mock('@privos_ai/app-react', async () => {
  const ReactModule = await import('react');
  return {
    PrivosAppProvider: ({ children }: { children: React.ReactNode }) => ReactModule.createElement(ReactModule.Fragment, null, children),
    usePrivosApp: () => host.app,
    usePrivosContext: () => host.context,
  };
});

vi.mock('../../src/ui/theme-provider', async () => {
  const ReactModule = await import('react');
  return {
    ThemeProvider: ({ children }: { children: React.ReactNode }) => ReactModule.createElement(ReactModule.Fragment, null, children),
    ThemeToggle: () => ReactModule.createElement('span', null, 'Theme'),
  };
});

vi.mock('../../src/ui/company-home', async () => {
  const ReactModule = await import('react');
  return { default: () => ReactModule.createElement('section', { 'data-feature': 'Home' }, 'Home feature') };
});
vi.mock('../../src/ui/email-history/EmailTab', async () => {
  const ReactModule = await import('react');
  return { default: () => ReactModule.createElement('section', { 'data-feature': 'Email' }, 'Email feature') };
});
vi.mock('../../src/ui/recruitment-panel', async () => {
  const ReactModule = await import('react');
  return { default: () => ReactModule.createElement('section', null, 'Recruitment feature') };
});
vi.mock('../../src/ui/pipeline-dashboard', async () => {
  const ReactModule = await import('react');
  return { default: () => ReactModule.createElement('section', null, 'Pipeline feature') };
});
vi.mock('../../src/ui/lifecycle/LifecycleDashboard', async () => {
  const ReactModule = await import('react');
  return { default: () => ReactModule.createElement('section', null, 'Lifecycle feature') };
});
vi.mock('../../src/ui/bot-drafting-tab', async () => {
  const ReactModule = await import('react');
  return { default: () => ReactModule.createElement('section', null, 'Bot feature') };
});
vi.mock('../../src/ui/cv-scored/CVScoredTab', async () => {
  const ReactModule = await import('react');
  return { default: () => ReactModule.createElement('section', null, 'CV feature') };
});
vi.mock('../../src/ui/jd-chatbot-functional', async () => {
  const ReactModule = await import('react');
  return { default: () => ReactModule.createElement('section', null, 'JD feature') };
});
vi.mock('../../src/ui/payroll/PayrollTab', async () => {
  const ReactModule = await import('react');
  return {
    default: () => {
      host.payrollRenders += 1;
      return ReactModule.createElement('section', { 'data-feature': 'Payroll' }, 'Payroll feature');
    },
  };
});

type Listener = Readonly<{ callback: (event: FakeEvent) => void; capture: boolean }>;

class FakeEvent {
  readonly type: string;
  target: FakeNode | null = null;
  currentTarget: FakeNode | null = null;
  bubbles = true;
  cancelBubble = false;
  defaultPrevented = false;
  button = 0;

  constructor(type: string) { this.type = type; }
  preventDefault(): void { this.defaultPrevented = true; }
  stopPropagation(): void { this.cancelBubble = true; }
}

class FakeNode {
  readonly nodeType: number;
  readonly ownerDocument: FakeDocument;
  parentNode: FakeNode | null = null;
  childNodes: FakeNode[] = [];
  nodeValue: string | null = null;
  private readonly listeners = new Map<string, Listener[]>();

  constructor(nodeType: number, ownerDocument: FakeDocument) {
    this.nodeType = nodeType;
    this.ownerDocument = ownerDocument;
  }

  get firstChild(): FakeNode | null { return this.childNodes[0] ?? null; }
  get lastChild(): FakeNode | null { return this.childNodes[this.childNodes.length - 1] ?? null; }
  get nextSibling(): FakeNode | null {
    if (!this.parentNode) return null;
    const index = this.parentNode.childNodes.indexOf(this);
    return this.parentNode.childNodes[index + 1] ?? null;
  }
  get textContent(): string {
    return this.nodeType === 3 ? this.nodeValue ?? '' : this.childNodes.map(child => child.textContent).join('');
  }
  set textContent(value: string) {
    this.childNodes = [];
    if (value) this.appendChild(this.ownerDocument.createTextNode(value));
  }
  appendChild<T extends FakeNode>(node: T): T {
    if (node.parentNode) node.parentNode.removeChild(node);
    node.parentNode = this;
    this.childNodes.push(node);
    return node;
  }
  insertBefore<T extends FakeNode>(node: T, before: FakeNode | null): T {
    if (before === null) return this.appendChild(node);
    if (node.parentNode) node.parentNode.removeChild(node);
    const index = this.childNodes.indexOf(before);
    node.parentNode = this;
    this.childNodes.splice(index < 0 ? this.childNodes.length : index, 0, node);
    return node;
  }
  removeChild<T extends FakeNode>(node: T): T {
    const index = this.childNodes.indexOf(node);
    if (index >= 0) this.childNodes.splice(index, 1);
    node.parentNode = null;
    return node;
  }
  addEventListener(type: string, callback: (event: FakeEvent) => void, options?: boolean | { capture?: boolean }): void {
    const capture = typeof options === 'boolean' ? options : Boolean(options?.capture);
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), { callback, capture }]);
  }
  removeEventListener(type: string, callback: (event: FakeEvent) => void): void {
    this.listeners.set(type, (this.listeners.get(type) ?? []).filter(listener => listener.callback !== callback));
  }
  dispatchEvent(event: FakeEvent): boolean {
    event.target = this;
    const path: FakeNode[] = [];
    for (let current: FakeNode | null = this; current; current = current.parentNode) path.push(current);
    const invoke = (node: FakeNode, capture: boolean) => {
      event.currentTarget = node;
      for (const listener of node.listeners.get(event.type) ?? []) {
        if (listener.capture === capture) listener.callback(event);
      }
    };
    for (const node of [...path].reverse()) { invoke(node, true); if (event.cancelBubble) return !event.defaultPrevented; }
    for (const node of path) { invoke(node, false); if (event.cancelBubble) break; }
    return !event.defaultPrevented;
  }
}

class FakeElement extends FakeNode {
  readonly nodeName: string;
  readonly tagName: string;
  readonly namespaceURI = 'http://www.w3.org/1999/xhtml';
  readonly style: Record<string, string> = {};
  readonly attributes = new Map<string, string>();
  onclick: unknown = null;

  constructor(tagName: string, ownerDocument: FakeDocument) {
    super(1, ownerDocument);
    this.tagName = tagName.toUpperCase();
    this.nodeName = this.tagName;
  }
  setAttribute(name: string, value: string): void { this.attributes.set(name, String(value)); }
  getAttribute(name: string): string | null { return this.attributes.get(name) ?? null; }
  removeAttribute(name: string): void { this.attributes.delete(name); }
  hasAttribute(name: string): boolean { return this.attributes.has(name); }
}

class FakeText extends FakeNode {
  readonly nodeName = '#text';
  constructor(value: string, ownerDocument: FakeDocument) { super(3, ownerDocument); this.nodeValue = value; }
}

class FakeDocument extends FakeNode {
  readonly nodeName = '#document';
  readonly documentElement: FakeElement;
  readonly body: FakeElement;
  readonly defaultView: Record<string, unknown>;
  hidden = false;

  constructor() {
    super(9, null as unknown as FakeDocument);
    Object.defineProperty(this, 'ownerDocument', { value: this });
    this.defaultView = {};
    this.documentElement = new FakeElement('html', this);
    this.body = new FakeElement('body', this);
    this.appendChild(this.documentElement);
    this.documentElement.appendChild(this.body);
  }
  get activeElement(): FakeElement { return this.body; }
  createElement(tagName: string): FakeElement { return new FakeElement(tagName, this); }
  createElementNS(_namespace: string, tagName: string): FakeElement { return this.createElement(tagName); }
  createTextNode(value: string): FakeText { return new FakeText(value, this); }
}

interface Deferred<T> {
  promise: Promise<T>;
  resolve(value: T): void;
  reject(error: unknown): void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((nextResolve, nextReject) => { resolve = nextResolve; reject = nextReject; });
  return { promise, resolve, reject };
}

function contextResult(userRoles: readonly string[]): unknown {
  return { content: [{ type: 'text', text: JSON.stringify({ userRoles }) }] };
}

function appWithResponses(...responses: Array<Promise<unknown>>): NonNullable<typeof host.app> {
  const queue = [...responses];
  return {
    async callServerTool() { return await (queue.shift() ?? new Promise<never>(() => {})); },
    async rest() { throw new Error('REST transport must not run'); },
    async uploadFile() { throw new Error('upload transport must not run'); },
  };
}

function elements(root: FakeNode): FakeElement[] {
  return root.childNodes.flatMap(child => [
    ...(child instanceof FakeElement ? [child] : []),
    ...elements(child),
  ]);
}

function button(root: FakeNode, label: string): FakeElement {
  const match = elements(root).find(element => element.tagName === 'BUTTON' && element.textContent.trim() === label);
  if (!match) throw new Error(`Button not found: ${label}`);
  return match;
}

function hasFeature(root: FakeNode, label: string): boolean {
  return elements(root).some(element => element.getAttribute('data-feature') === label);
}

const COMPLETE_SCOPES = [
  'basic:information', 'lists:read', 'lists:query', 'lists:write', 'files:read', 'files:write',
  'sandbox:skills:use', 'sandbox:botkey:push', 'sandbox:wake', 'sandbox:generate',
  'sandbox:ai-chat', 'sandbox:ai-chat:write', 'db:read', 'db:write', 'db:schema:read', 'db:schema:write',
] as const;

describe('App payroll revocation boundary', () => {
  let documentHost: FakeDocument;

  beforeEach(() => {
    vi.useFakeTimers();
    host.payrollRenders = 0;
    host.context = { theme: 'light', roomId: 'room-1', effectiveScopes: COMPLETE_SCOPES };
    documentHost = new FakeDocument();
    const windowHost = {
      document: documentHost,
      addEventListener() {}, removeEventListener() {},
      getSelection: () => null,
      setTimeout, clearTimeout,
      HTMLIFrameElement: class {}, HTMLElement: FakeElement, Node: FakeNode,
    };
    documentHost.defaultView.document = documentHost;
    Object.assign(documentHost.defaultView, windowHost);
    Object.assign(globalThis, {
      window: windowHost,
      document: documentHost,
      HTMLElement: FakeElement,
      HTMLIFrameElement: windowHost.HTMLIFrameElement,
      Node: FakeNode,
      Event: FakeEvent,
      IS_REACT_ACT_ENVIRONMENT: true,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('fails closed through owner polling and removes a visited Payroll mount on DB or owner revocation', async () => {
    const { createRoot } = await import('react-dom/client');
    const { default: App } = await import('../../src/ui/App');
    const container = documentHost.createElement('div');
    documentHost.body.appendChild(container);
    const root = createRoot(container as unknown as HTMLElement);
    const render = async () => { await act(async () => { root.render(React.createElement(App)); }); };
    const settle = async () => { await act(async () => { await Promise.resolve(); await Promise.resolve(); }); };

    const pending = deferred<unknown>();
    host.app = appWithResponses(pending.promise);
    await render();
    expect(container.textContent).not.toContain('Quản lý Lương');

    await act(async () => { button(container, 'Email').dispatchEvent(new FakeEvent('click')); });
    expect(hasFeature(container, 'Email')).toBe(true);

    const rejected = deferred<unknown>();
    host.app = appWithResponses(rejected.promise);
    await render();
    rejected.reject(new Error('denied'));
    await settle();
    expect(container.textContent).not.toContain('Quản lý Lương');

    host.app = appWithResponses(Promise.resolve({ content: [{ type: 'text', text: '{bad-json' }] }));
    await render();
    await settle();
    expect(container.textContent).not.toContain('Quản lý Lương');

    const staleOwner = deferred<unknown>();
    const replacementOwner = deferred<unknown>();
    host.app = appWithResponses(staleOwner.promise);
    await render();
    host.app = appWithResponses(replacementOwner.promise, Promise.resolve(contextResult(['member'])));
    await render();
    staleOwner.resolve(contextResult(['owner']));
    await settle();
    expect(container.textContent).not.toContain('Quản lý Lương');

    replacementOwner.resolve(contextResult(['owner']));
    await settle();
    expect(container.textContent).toContain('Quản lý Lương');
    await act(async () => { button(container, 'Quản lý Lương').dispatchEvent(new FakeEvent('click')); });
    expect(hasFeature(container, 'Payroll')).toBe(true);
    const grantedRenderCount = host.payrollRenders;

    host.context = { ...host.context, effectiveScopes: COMPLETE_SCOPES.filter(scope => scope !== 'db:read') };
    await render();
    expect(hasFeature(container, 'Payroll')).toBe(false);
    expect(hasFeature(container, 'Email')).toBe(true);
    expect(host.payrollRenders).toBe(grantedRenderCount);

    host.context = { ...host.context, effectiveScopes: COMPLETE_SCOPES };
    await render();
    await act(async () => { button(container, 'Quản lý Lương').dispatchEvent(new FakeEvent('click')); });
    expect(hasFeature(container, 'Payroll')).toBe(true);
    const beforeOwnerRevoke = host.payrollRenders;

    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    await settle();
    expect(hasFeature(container, 'Payroll')).toBe(false);
    expect(hasFeature(container, 'Email')).toBe(true);
    expect(host.payrollRenders).toBe(beforeOwnerRevoke);

    await act(async () => { root.unmount(); });
  });
});
