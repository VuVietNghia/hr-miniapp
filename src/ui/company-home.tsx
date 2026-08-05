import { useEffect, useMemo, useState, type CSSProperties, type FormEvent } from 'react';
import { usePrivosApp, usePrivosContext } from '@privos/app-react';
import { createOrUpdateFile, ensureFolderPath, getFileContent, restCall } from './privos-rest';

type LayoutStyle = 'corporate' | 'product' | 'editorial' | 'minimal' | 'bold';
type ProfileLanguage = 'vi' | 'en';

type CompanyTheme = {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  surfaceColor: string;
  textColor: string;
  visualStyle: string;
};

type CompanyProfile = {
  companyName: string;
  website: string;
  logoDataUrl: string;
  logoFileName: string;
  heroImageDataUrl: string;
  heroImageFileName: string;
  language: ProfileLanguage;
  industry: string;
  team: string;
  contact: string;
  goals: string;
  tagline: string;
  description: string;
  cultureSummary: string;
  products: string[];
  brands: string[];
  values: string[];
  highlights: string[];
  differentiators: string[];
  hiringTone: string;
  sourceNotes: string[];
  layoutStyle: LayoutStyle;
  theme: CompanyTheme;
};

type UploadedCompanyDoc = {
  id: string;
  name: string;
};

type EditableListField = 'products' | 'brands' | 'values' | 'highlights' | 'differentiators' | 'sourceNotes';
type EditableTextField = 'companyName' | 'website' | 'industry' | 'team' | 'contact' | 'goals' | 'tagline' | 'description' | 'cultureSummary' | 'hiringTone';

const TEXT = {
  setupTitle: 'Thi\u1ebft l\u1eadp Trang ch\u1ee7',
  setupDescription: 'G\u1eafn link website, t\u1ea3i logo v\u00e0 t\u00e0i li\u1ec7u li\u00ean quan. AI agent s\u1ebd \u0111\u1ecdc ngu\u1ed3n d\u1eef li\u1ec7u n\u00e0y v\u00e0 d\u1ef1ng Home theo phong c\u00e1ch website.',
  setupToggle: 'C\u1eadp nh\u1eadt ngu\u1ed3n d\u1eef li\u1ec7u',
  websiteLabel: 'Website c\u00f4ng ty',
  logoLabel: 'Logo c\u00f4ng ty',
  heroImageLabel: '\u1ea2nh gi\u1edbi thi\u1ec7u',
  docsLabel: 'T\u00e0i li\u1ec7u c\u00f4ng ty',
  generating: '\u0110ang t\u1ea1o...',
  createHome: 'T\u1ea1o Home',
  recreateHome: 'T\u1ea1o l\u1ea1i Home',
  edit: 'Ch\u1ec9nh s\u1eeda',
  editTitle: 'Ch\u1ec9nh s\u1eeda n\u1ed9i dung \u0111\u00e3 t\u1ea1o',
  save: 'L\u01b0u',
  cancel: 'H\u1ee7y',
  previewEmpty: 'Home s\u1ebd xu\u1ea5t hi\u1ec7n \u1edf \u0111\u00e2y sau khi AI \u0111\u1ecdc website v\u00e0 t\u00e0i li\u1ec7u c\u00f4ng ty.',
  companyName: 'T\u00ean c\u00f4ng ty',
  industry: 'L\u0129nh v\u1ef1c',
  team: '\u0110\u1ed9i ng\u0169',
  contact: 'Li\u00ean h\u1ec7',
  goals: 'M\u1ee5c ti\u00eau',
  tagline: 'Tagline',
  description: 'M\u00f4 t\u1ea3',
  cultureSummary: 'T\u00f3m t\u1eaft v\u0103n h\u00f3a',
  products: 'S\u1ea3n ph\u1ea9m / d\u1ecbch v\u1ee5',
  brands: 'C\u00e1c th\u01b0\u01a1ng hi\u1ec7u',
  values: 'V\u0103n h\u00f3a / gi\u00e1 tr\u1ecb',
  highlights: '\u0110i\u1ec3m n\u1ed5i b\u1eadt',
  differentiators: 'Kh\u00e1c bi\u1ec7t',
  hiringTone: 'Gi\u1ecdng v\u0103n tuy\u1ec3n d\u1ee5ng',
  uploadStatus: '\u0110ang t\u1ea3i t\u00e0i li\u1ec7u c\u00f4ng ty...',
  agentStatus: '\u0110ang g\u1eedi website v\u00e0 t\u00e0i li\u1ec7u cho AI agent \u0111\u1ecdc...',
  saveStatus: '\u0110ang l\u01b0u Home c\u00f4ng ty...',
  doneStatus: '\u0110\u00e3 t\u1ea1o Home t\u1eeb website v\u00e0 t\u00e0i li\u1ec7u c\u00f4ng ty.',
  editSaved: '\u0110\u00e3 l\u01b0u ch\u1ec9nh s\u1eeda Home.',
};

const PAGE_TEXT = {
  vi: {
    openWebsite: 'M\u1edf website',
    overview: 'T\u1ed5ng quan',
    industry: 'L\u0129nh v\u1ef1c',
    team: '\u0110\u1ed9i ng\u0169',
    contact: 'Li\u00ean h\u1ec7',
    goals: 'M\u1ee5c ti\u00eau',
    productCount: 'S\u1ea3n ph\u1ea9m',
    brands: 'C\u00e1c th\u01b0\u01a1ng hi\u1ec7u',
    highlights: '\u0110i\u1ec3m n\u1ed5i b\u1eadt',
    products: 'S\u1ea3n ph\u1ea9m / d\u1ecbch v\u1ee5',
    differentiators: 'L\u1ee3i th\u1ebf kh\u00e1c bi\u1ec7t',
    values: 'V\u0103n h\u00f3a / gi\u00e1 tr\u1ecb',
    culture: 'V\u0103n h\u00f3a l\u00e0m vi\u1ec7c',
    hiringTone: 'Gi\u1ecdng v\u0103n tuy\u1ec3n d\u1ee5ng',
    explore: 'Kh\u00e1m ph\u00e1',
    workWithUs: 'L\u00e0m vi\u1ec7c c\u00f9ng ch\u00fang t\u00f4i',
  },
  en: {
    openWebsite: 'Open website',
    overview: 'Overview',
    industry: 'Industry',
    team: 'Team',
    contact: 'Contact',
    goals: 'Goals',
    productCount: 'Products',
    brands: 'Brands',
    highlights: 'Highlights',
    products: 'Products / Services',
    differentiators: 'Differentiators',
    values: 'Culture / Values',
    culture: 'Work culture',
    hiringTone: 'Hiring tone',
    explore: 'Explore',
    workWithUs: 'Work with us',
  },
};

const defaultTheme: CompanyTheme = {
  primaryColor: '#156FF5',
  secondaryColor: '#148660',
  accentColor: '#F59E0B',
  backgroundColor: '#F7F8FA',
  surfaceColor: '#FFFFFF',
  textColor: '#1F2329',
  visualStyle: '',
};

const emptyProfile: CompanyProfile = {
  companyName: '',
  website: '',
  logoDataUrl: '',
  logoFileName: '',
  heroImageDataUrl: '',
  heroImageFileName: '',
  language: 'vi',
  industry: '',
  team: '',
  contact: '',
  goals: '',
  tagline: '',
  description: '',
  cultureSummary: '',
  products: [],
  brands: [],
  values: [],
  highlights: [],
  differentiators: [],
  hiringTone: '',
  sourceNotes: [],
  layoutStyle: 'product',
  theme: defaultTheme,
};

const UNKNOWN_VALUES = new Set(['chua xac dinh', 'ch\u01b0a x\u00e1c \u0111\u1ecbnh', 'khong xac dinh', 'kh\u00f4ng x\u00e1c \u0111\u1ecbnh', 'unknown', 'n/a', 'na', 'null']);
const HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

function readAsDataUri(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error || new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

function cleanText(value: unknown): string {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  return UNKNOWN_VALUES.has(trimmed.toLowerCase()) ? '' : trimmed;
}

function cleanList(value: unknown, max = 8): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(cleanText).filter(Boolean).slice(0, max);
}

function cleanHex(value: unknown, fallback: string): string {
  const text = cleanText(value);
  return HEX_COLOR.test(text) ? text : fallback;
}

function cleanLayoutStyle(value: unknown): LayoutStyle {
  const style = cleanText(value).toLowerCase();
  return ['corporate', 'product', 'editorial', 'minimal', 'bold'].includes(style) ? style as LayoutStyle : 'product';
}

function cleanLanguage(value: unknown): ProfileLanguage {
  return cleanText(value).toLowerCase() === 'en' ? 'en' : 'vi';
}

function linesToList(value: string): string[] {
  return value.split('\n').map((line) => line.trim()).filter(Boolean);
}

function summarizeList(items: string[], max = 3): string {
  const visible = items.filter(Boolean).slice(0, max);
  if (!visible.length) return '';
  return `${visible.join(', ')}${items.length > visible.length ? ', ...' : ''}`;
}

function truncateWords(text: string, max = 15): string {
  const words = text.trim().split(/\s+/);
  if (words.length <= max) return text.trim();
  return words.slice(0, max).join(' ') + '...';
}

// --- LocalStorage helpers: split profile into 3 keys to avoid QuotaExceededError ---
function lsKey(roomId: string) { return `hr-miniapp-cp2-${roomId}`; }

function saveProfileToLocal(roomId: string, profile: CompanyProfile): void {
  const base = lsKey(roomId);
  // Always save text (tiny). Images saved separately — each fails independently.
  const { logoDataUrl, heroImageDataUrl, ...text } = profile;
  try { localStorage.setItem(base, JSON.stringify(text)); } catch { }
  try { if (logoDataUrl) localStorage.setItem(`${base}-logo`, logoDataUrl); else localStorage.removeItem(`${base}-logo`); } catch { }
  try { if (heroImageDataUrl) localStorage.setItem(`${base}-hero`, heroImageDataUrl); else localStorage.removeItem(`${base}-hero`); } catch { }
}

function loadProfileFromLocal(roomId: string): CompanyProfile | null {
  const base = lsKey(roomId);
  try {
    const text = localStorage.getItem(base);
    if (!text) return null;
    const obj = JSON.parse(text);
    try { obj.logoDataUrl = localStorage.getItem(`${base}-logo`) || ''; } catch { }
    try { obj.heroImageDataUrl = localStorage.getItem(`${base}-hero`) || ''; } catch { }
    return toCompanyProfile(obj);
  } catch { return null; }
}

function extractJsonObject(text: string): any {
  const fenced = [...text.matchAll(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/gi)];
  for (let i = fenced.length - 1; i >= 0; i--) {
    try { return JSON.parse(fenced[i][1]); } catch { }
  }
  const first = text.indexOf('{');
  const last = text.lastIndexOf('}');
  if (first >= 0 && last > first) {
    try { return JSON.parse(text.slice(first, last + 1)); } catch { return null; }
  }
  return null;
}

function toCompanyTheme(raw: any): CompanyTheme {
  const theme = raw?.theme || {};
  return {
    primaryColor: cleanHex(theme.primaryColor, defaultTheme.primaryColor),
    secondaryColor: cleanHex(theme.secondaryColor, defaultTheme.secondaryColor),
    accentColor: cleanHex(theme.accentColor, defaultTheme.accentColor),
    backgroundColor: cleanHex(theme.backgroundColor, defaultTheme.backgroundColor),
    surfaceColor: cleanHex(theme.surfaceColor, defaultTheme.surfaceColor),
    textColor: cleanHex(theme.textColor, defaultTheme.textColor),
    visualStyle: cleanText(theme.visualStyle),
  };
}

function toCompanyProfile(raw: any, websiteFallback = '', logoFallback = '', heroImageFallback = ''): CompanyProfile {
  return {
    companyName: cleanText(raw?.companyName),
    website: cleanText(raw?.website) || websiteFallback,
    logoDataUrl: cleanText(raw?.logoDataUrl) || logoFallback,
    logoFileName: cleanText(raw?.logoFileName),
    heroImageDataUrl: cleanText(raw?.heroImageDataUrl) || heroImageFallback,
    heroImageFileName: cleanText(raw?.heroImageFileName),
    language: cleanLanguage(raw?.language),
    industry: cleanText(raw?.industry),
    team: cleanText(raw?.team),
    contact: cleanText(raw?.contact),
    goals: cleanText(raw?.goals),
    tagline: cleanText(raw?.tagline),
    description: cleanText(raw?.description),
    cultureSummary: cleanText(raw?.cultureSummary),
    products: cleanList(raw?.products, 6),
    brands: cleanList(raw?.brands, 8),
    values: cleanList(raw?.values, 6),
    highlights: cleanList(raw?.highlights, 6),
    differentiators: cleanList(raw?.differentiators, 6),
    hiringTone: cleanText(raw?.hiringTone),
    sourceNotes: cleanList(raw?.sourceNotes, 8),
    layoutStyle: cleanLayoutStyle(raw?.layoutStyle),
    theme: toCompanyTheme(raw),
  };
}

function getHostName(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; }
}

function buildCompanyPrompt(website: string, docs: UploadedCompanyDoc[], roomId: string): string {
  const docLines = docs.length ? docs.map((doc) => `- @Files:${roomId}/hr-miniapp/company/docs/${doc.name}`).join('\n') : '- No uploaded company documents.';
  return `
[SYSTEM AUTOMATION] EXECUTE NOW. DO NOT ASK FOLLOW-UP QUESTIONS.
You are building a reusable company homepage profile for an HR mini app.

Read this official company website: ${website}
Also read all uploaded company files listed below.

Company files:
${docLines}

Return only valid JSON with this exact schema:
{
  "companyName": "string",
  "website": "string",
  "language": "vi | en",
  "industry": "string",
  "team": "string",
  "contact": "string",
  "goals": "string",
  "tagline": "string",
  "description": "string",
  "cultureSummary": "string",
  "products": ["string"],
  "brands": ["string"],
  "values": ["string"],
  "highlights": ["string"],
  "differentiators": ["string"],
  "hiringTone": "string",
  "sourceNotes": ["string"],
  "layoutStyle": "corporate | product | editorial | minimal | bold",
  "theme": {
    "primaryColor": "#RRGGBB",
    "secondaryColor": "#RRGGBB",
    "accentColor": "#RRGGBB",
    "backgroundColor": "#RRGGBB",
    "surfaceColor": "#RRGGBB",
    "textColor": "#RRGGBB",
    "visualStyle": "short phrase"
  }
}

Rules:
- Use the website and uploaded documents as the only sources.
- LANGUAGE RULE (CRITICAL): Read the website content language first. If the website text is primarily in English, you MUST write ALL output fields in English and set language="en". If the website text is primarily in Vietnamese, write ALL output fields in Vietnamese and set language="vi". Never mix languages. Never default to Vietnamese if the website is in English.
- Detect dominant brand colors from website CSS, logo, header, hero, buttons, and repeated visual accents. Return hex colors only.
- Choose layoutStyle from the actual website feel: corporate, product, editorial, minimal, or bold.
- Build a polished company homepage like a large company website: hero, overview, brand/product sections, culture/work section, and clear CTA content.
- Keep text concise but useful: tagline max 12 words, description max 55 words, cultureSummary max 35 words, goals max 15 words, each list item max 10 words, industry max 15 words, team max 15 words, contact max 15 words.
- Return up to 6 specific products/services. Return product names or product lines, not counts.
- Return up to 8 brands in "brands": owned brands, sub-brands, partner brands, or customer/client brands shown on the website. If no reliable brands/customers are visible, return an empty array.
- Return up to 6 values, highlights, and differentiators. Hide missing sections by returning empty strings or empty arrays.
- Do not write "Chua xac dinh". Do not invent benefits, company size, customers, funding, founders, or team facts.
`.trim();
}

async function askCompanyAgent(app: ReturnType<typeof usePrivosApp>, roomId: string, prompt: string, fileIds: string[]): Promise<string> {
  const sent = await restCall<any>(app, 'POST', 'ai-messages.send', {
    body: { entityType: 'room-chat', entityId: roomId, roomId, flowChatId: roomId, content: prompt, ...(fileIds.length ? { fileIds } : {}) },
    timeoutMs: 60000,
  });
  const sessionId = sent.sessionId;
  const aiMessageId = sent.aiMessage?._id;
  if (!sessionId || !aiMessageId) throw new Error('Khong tao duoc phien AI.');
  await restCall(app, 'POST', 'ai-messages.startGeneration', { body: { messageId: aiMessageId }, timeoutMs: 60000 });

  for (let i = 0; i < 90; i++) {
    await new Promise((resolve) => window.setTimeout(resolve, 2000));
    const res = await restCall<any>(app, 'GET', 'ai-messages.list', { query: { sessionId, count: 20 }, timeoutMs: 60000 });
    const list = Array.isArray(res?.messages) ? res.messages : [];
    const aiMsg = [...list].reverse().find((message: any) => message.type === 'ai');
    if (!aiMsg) continue;
    if (['completed', 'failed', 'cancelled'].includes(aiMsg.status || '')) {
      if (aiMsg.status !== 'completed') throw new Error(`AI dung voi trang thai ${aiMsg.status}.`);
      return aiMsg.content || '';
    }
  }
  throw new Error('AI polling timeout.');
}

function hasProfileContent(profile: CompanyProfile | null): boolean {
  if (!profile) return false;
  return [profile.companyName, profile.website, profile.logoDataUrl, profile.heroImageDataUrl, profile.industry, profile.team, profile.contact, profile.goals, profile.tagline, profile.description, profile.cultureSummary, profile.hiringTone, ...profile.products, ...profile.brands, ...profile.values, ...profile.highlights, ...profile.differentiators, ...profile.sourceNotes].some(Boolean);
}

export default function CompanyHome() {
  const app = usePrivosApp();
  const { roomId } = usePrivosContext();
  const [website, setWebsite] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [selectedLogo, setSelectedLogo] = useState<File | null>(null);
  const [selectedHeroImage, setSelectedHeroImage] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState('');
  const [heroImagePreview, setHeroImagePreview] = useState('');
  const [uploadedDocs, setUploadedDocs] = useState<UploadedCompanyDoc[]>([]);
  const [profile, setProfile] = useState<CompanyProfile | null>(null);
  const [draftProfile, setDraftProfile] = useState<CompanyProfile>(emptyProfile);
  const [isSetupOpen, setIsSetupOpen] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  const canGenerate = useMemo(() => !!roomId && !!website.trim() && !isGenerating, [roomId, website, isGenerating]);
  const profileReady = hasProfileContent(profile);
  const displayProfile = profile || emptyProfile;
  const displayTheme = displayProfile.theme || defaultTheme;
  const pageText = PAGE_TEXT[displayProfile.language || 'vi'];
  const heroTitle = displayProfile.companyName || getHostName(displayProfile.website) || 'Company Home';
  const logoSrc = logoPreview || displayProfile.logoDataUrl;
  const heroImageSrc = heroImagePreview || displayProfile.heroImageDataUrl;
  const facts = [
    { label: pageText.industry, value: truncateWords(displayProfile.industry) },
    { label: pageText.team, value: truncateWords(displayProfile.team) },
    { label: pageText.contact, value: truncateWords(displayProfile.contact) },
    { label: pageText.goals, value: truncateWords(displayProfile.goals) },
    { label: pageText.productCount, value: summarizeList(displayProfile.products) },
    { label: pageText.brands, value: summarizeList(displayProfile.brands) },
  ].filter((item) => item.value);
  const focusItems = Array.from(new Set([...displayProfile.highlights, ...displayProfile.differentiators, ...displayProfile.values].filter(Boolean))).slice(0, 6);
  const brandRows: string[][] = [];
  { let i = 0, rowIdx = 0; while (i < displayProfile.brands.length) { const size = rowIdx % 2 === 0 ? 5 : 4; brandRows.push(displayProfile.brands.slice(i, i + size)); i += size; rowIdx++; } }

  const previewStyle = {
    '--company-primary': displayTheme.primaryColor,
    '--company-secondary': displayTheme.secondaryColor,
    '--company-accent': displayTheme.accentColor,
    '--company-bg': displayTheme.backgroundColor,
    '--company-surface': displayTheme.surfaceColor,
    '--company-text': displayTheme.textColor,
  } as CSSProperties;

  useEffect(() => {
    if (!roomId) return;
    let cancelled = false;

    // 1. Show from localStorage immediately (zero network wait)
    const cached = loadProfileFromLocal(roomId);
    if (cached && hasProfileContent(cached)) {
      setProfile(cached);
      setDraftProfile(cached);
      setLogoPreview(cached.logoDataUrl);
      setHeroImagePreview(cached.heroImageDataUrl);
      setIsSetupOpen(false);
      if (cached.website) setWebsite(cached.website);
    }

    // 2. Load from server (lean JSON + separate image files)
    (async () => {
      try {
        const content = await getFileContent(app, `${roomId}/hr-miniapp/company/company-profile.json`);
        if (cancelled || !content.trim()) return;
        const obj = JSON.parse(content);

        // Load images: localStorage first, then .b64 text files on server
        const base = lsKey(roomId);
        let logoDataUrl = '';
        let heroImageDataUrl = '';
        try { logoDataUrl = localStorage.getItem(`${base}-logo`) || ''; } catch { }
        try { heroImageDataUrl = localStorage.getItem(`${base}-hero`) || ''; } catch { }
        if (!logoDataUrl) { try { logoDataUrl = await getFileContent(app, `${roomId}/hr-miniapp/company/assets/logo.b64`); } catch { } }
        if (!heroImageDataUrl) { try { heroImageDataUrl = await getFileContent(app, `${roomId}/hr-miniapp/company/assets/hero.b64`); } catch { } }

        obj.logoDataUrl = logoDataUrl;
        obj.heroImageDataUrl = heroImageDataUrl;
        const nextProfile = toCompanyProfile(obj);
        if (!cancelled) {
          setProfile(nextProfile);
          setDraftProfile(nextProfile);
          setLogoPreview(nextProfile.logoDataUrl);
          setHeroImagePreview(nextProfile.heroImageDataUrl);
          setIsSetupOpen(false);
          if (nextProfile.website) setWebsite(nextProfile.website);
          saveProfileToLocal(roomId, nextProfile);
        }
      } catch { }
    })();

    return () => { cancelled = true; };
  }, [app, roomId]);

  const saveProfile = async (nextProfile: CompanyProfile) => {
    // 1. Save to localStorage immediately (instant on next reload)
    saveProfileToLocal(roomId, nextProfile);
    // 2. Save lean JSON to server (no base64 images — avoids file size limit)
    const { logoDataUrl, heroImageDataUrl, ...lean } = nextProfile;
    await createOrUpdateFile(app, `${roomId}/hr-miniapp/company/company-profile.json`, JSON.stringify(lean, null, 2));
    // 3. Save images as separate plain-text .b64 files (loadable via getFileContent)
    if (logoDataUrl) { try { await createOrUpdateFile(app, `${roomId}/hr-miniapp/company/assets/logo.b64`, logoDataUrl); } catch { } }
    if (heroImageDataUrl) { try { await createOrUpdateFile(app, `${roomId}/hr-miniapp/company/assets/hero.b64`, heroImageDataUrl); } catch { } }
    setProfile(nextProfile);
    setDraftProfile(nextProfile);
    setLogoPreview(nextProfile.logoDataUrl);
    setHeroImagePreview(nextProfile.heroImageDataUrl);
  };


  const handleLogoSelect = async (file: File | null) => {
    setSelectedLogo(file);
    if (!file) return;
    setLogoPreview(await readAsDataUri(file));
  };

  const handleHeroImageSelect = async (file: File | null) => {
    setSelectedHeroImage(file);
    if (!file) return;
    setHeroImagePreview(await readAsDataUri(file));
  };

  const uploadLogoIfNeeded = async (): Promise<{ dataUrl: string; fileName: string }> => {
    if (!selectedLogo) return { dataUrl: logoPreview || displayProfile.logoDataUrl, fileName: displayProfile.logoFileName };
    const dataUrl = await readAsDataUri(selectedLogo);
    const folderId = await ensureFolderPath(app, roomId, ['hr-miniapp', 'company', 'assets']);
    await app.uploadFile({ channelId: roomId, fileName: selectedLogo.name, base64Data: dataUrl, mimeType: selectedLogo.type || 'image/png', duplicateAction: 'replace', ...(folderId ? { folderId } : {}) });
    setSelectedLogo(null);
    setLogoPreview(dataUrl);
    return { dataUrl, fileName: selectedLogo.name };
  };

  const uploadHeroImageIfNeeded = async (): Promise<{ dataUrl: string; fileName: string }> => {
    if (!selectedHeroImage) return { dataUrl: heroImagePreview || displayProfile.heroImageDataUrl, fileName: displayProfile.heroImageFileName };
    const dataUrl = await readAsDataUri(selectedHeroImage);
    const folderId = await ensureFolderPath(app, roomId, ['hr-miniapp', 'company', 'assets']);
    await app.uploadFile({ channelId: roomId, fileName: selectedHeroImage.name, base64Data: dataUrl, mimeType: selectedHeroImage.type || 'image/jpeg', duplicateAction: 'replace', ...(folderId ? { folderId } : {}) });
    setSelectedHeroImage(null);
    setHeroImagePreview(dataUrl);
    return { dataUrl, fileName: selectedHeroImage.name };
  };

  const uploadCompanyDocs = async (): Promise<UploadedCompanyDoc[]> => {
    if (!selectedFiles.length) return uploadedDocs;
    setStatus(TEXT.uploadStatus);
    const folderId = await ensureFolderPath(app, roomId, ['hr-miniapp', 'company', 'docs']);
    const uploaded: UploadedCompanyDoc[] = [];
    for (const file of selectedFiles) {
      const res: any = await app.uploadFile({ channelId: roomId, fileName: file.name, base64Data: await readAsDataUri(file), mimeType: file.type || 'application/octet-stream', duplicateAction: 'replace', ...(folderId ? { folderId } : {}) });
      const id = res?.file?._id || res?._id;
      if (!id) throw new Error(`Upload did not return file id for ${file.name}.`);
      uploaded.push({ id, name: res?.file?.name || file.name });
    }
    const merged = [...uploadedDocs.filter((existing) => !uploaded.some((doc) => doc.name === existing.name)), ...uploaded];
    setUploadedDocs(merged);
    setSelectedFiles([]);
    return merged;
  };

  const handleGenerate = async (event: FormEvent) => {
    event.preventDefault();
    if (!canGenerate) return;
    setIsGenerating(true);
    setError('');
    setIsEditing(false);
    try {
      const logo = await uploadLogoIfNeeded();
      const heroImage = await uploadHeroImageIfNeeded();
      const docs = await uploadCompanyDocs();
      setStatus(TEXT.agentStatus);
      const prompt = buildCompanyPrompt(website.trim(), docs, roomId);
      const text = await askCompanyAgent(app, roomId, prompt, docs.map((doc) => doc.id));
      const parsed = extractJsonObject(text);
      if (!parsed) throw new Error('AI did not return valid JSON.');
      const nextProfile = { ...toCompanyProfile(parsed, website.trim(), logo.dataUrl, heroImage.dataUrl), logoDataUrl: logo.dataUrl, logoFileName: logo.fileName, heroImageDataUrl: heroImage.dataUrl, heroImageFileName: heroImage.fileName };
      setStatus(TEXT.saveStatus);
      await saveProfile(nextProfile);
      setIsSetupOpen(false);
      setStatus(TEXT.doneStatus);
    } catch (err: any) {
      setError(err?.message || 'Khong tao duoc Home cong ty.');
      setStatus('');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDraftText = (field: EditableTextField, value: string) => setDraftProfile((prev) => ({ ...prev, [field]: value }));
  const handleDraftList = (field: EditableListField, value: string) => setDraftProfile((prev) => ({ ...prev, [field]: linesToList(value) }));

  const handleSaveEdit = async () => {
    setError('');
    try {
      const logo = await uploadLogoIfNeeded();
      const heroImage = await uploadHeroImageIfNeeded();
      const nextProfile = {
        ...toCompanyProfile(draftProfile, website.trim(), logo.dataUrl || logoPreview || displayProfile.logoDataUrl, heroImage.dataUrl || heroImagePreview || displayProfile.heroImageDataUrl),
        logoDataUrl: logo.dataUrl || logoPreview || displayProfile.logoDataUrl,
        logoFileName: logo.fileName || displayProfile.logoFileName,
        heroImageDataUrl: heroImage.dataUrl || heroImagePreview || displayProfile.heroImageDataUrl,
        heroImageFileName: heroImage.fileName || displayProfile.heroImageFileName,
      };
      await saveProfile(nextProfile);
      setIsEditing(false);
      setStatus(TEXT.editSaved);
    } catch (err: any) {
      setError(err?.message || 'Khong luu duoc chinh sua.');
    }
  };

  const startEditing = () => {
    setDraftProfile(profile || emptyProfile);
    setHeroImagePreview((profile || emptyProfile).heroImageDataUrl);
    setIsEditing(true);
    setStatus('');
    setError('');
  };

  return (
    <main className="company-home">
      <section className={`company-setup-wrap${profileReady ? ' is-collapsed' : ''}`}>
        {profileReady && (
          <button type="button" className="company-setup-toggle" onClick={() => setIsSetupOpen((open) => !open)} aria-expanded={isSetupOpen}>
            <span>{TEXT.setupToggle}</span>
            <span className="company-toggle-chevron" aria-hidden="true">{isSetupOpen ? '\u25b2' : '\u25bc'}</span>
          </button>
        )}

        {(!profileReady || isSetupOpen) && (
          <div className="company-source-panel">
            <div className="company-source-copy">
              <span className="company-kicker">Company Knowledge</span>
              <h1>{TEXT.setupTitle}</h1>
              <p>{TEXT.setupDescription}</p>
            </div>

            <form className="company-source-form" onSubmit={handleGenerate}>
              <label className="company-url-field">
                <span>{TEXT.websiteLabel}</span>
                <input required type="url" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://company.com" />
              </label>

              <label className="company-logo-upload">
                <span>{TEXT.logoLabel}</span>
                <div>
                  {logoSrc ? <img src={logoSrc} alt="Company logo" /> : <strong>LOGO</strong>}
                  <input type="file" accept=".png,.jpg,.jpeg,.webp,.svg" onChange={(e) => handleLogoSelect(e.target.files?.[0] || null)} />
                </div>
              </label>

              <label className="company-logo-upload company-hero-image-upload">
                <span>{TEXT.heroImageLabel}</span>
                <div>
                  {heroImageSrc ? <img src={heroImageSrc} alt="Company visual" /> : <strong>IMG</strong>}
                  <input type="file" accept=".png,.jpg,.jpeg,.webp" onChange={(e) => handleHeroImageSelect(e.target.files?.[0] || null)} />
                </div>
              </label>

              <label className="company-upload compact">
                <span>{TEXT.docsLabel}</span>
                <input type="file" multiple accept=".pdf,.doc,.docx,.txt,.md,.ppt,.pptx,.png,.jpg,.jpeg" onChange={(e) => setSelectedFiles(Array.from(e.target.files || []))} />
              </label>

              {(selectedFiles.length > 0 || uploadedDocs.length > 0) && (
                <div className="company-file-list">
                  {[...uploadedDocs.map((doc) => doc.name), ...selectedFiles.map((file) => file.name)].map((name) => <span key={name}>{name}</span>)}
                </div>
              )}

              <div className="company-actions">
                <button type="submit" disabled={!canGenerate}>{isGenerating ? TEXT.generating : profileReady ? TEXT.recreateHome : TEXT.createHome}</button>
                {profileReady && <button type="button" className="company-secondary-btn" onClick={startEditing}>{TEXT.edit}</button>}
                {status && <p>{status}</p>}
                {error && <p className="company-error">{error}</p>}
              </div>
            </form>
          </div>
        )}
      </section>

      {isEditing && (
        <section className="company-editor" aria-label="Edit company home">
          <div className="company-editor-head">
            <div><span className="company-kicker">Edit Home</span><h2>{TEXT.editTitle}</h2></div>
            <div className="company-editor-actions"><button type="button" onClick={handleSaveEdit}>{TEXT.save}</button><button type="button" className="company-secondary-btn" onClick={() => setIsEditing(false)}>{TEXT.cancel}</button></div>
          </div>
          <div className="company-editor-grid">
            <label className="company-logo-upload wide">
              <span>{TEXT.logoLabel}</span>
              <div>
                {logoSrc ? <img src={logoSrc} alt="Company logo" /> : <strong>LOGO</strong>}
                <input type="file" accept=".png,.jpg,.jpeg,.webp,.svg" onChange={(e) => handleLogoSelect(e.target.files?.[0] || null)} />
              </div>
            </label>
            <label className="company-logo-upload company-hero-image-upload wide">
              <span>{TEXT.heroImageLabel}</span>
              <div>
                {heroImageSrc ? <img src={heroImageSrc} alt="Company visual" /> : <strong>IMG</strong>}
                <input type="file" accept=".png,.jpg,.jpeg,.webp" onChange={(e) => handleHeroImageSelect(e.target.files?.[0] || null)} />
              </div>
            </label>
            <label><span>{TEXT.companyName}</span><input value={draftProfile.companyName} onChange={(e) => handleDraftText('companyName', e.target.value)} /></label>
            <label><span>{TEXT.industry}</span><input value={draftProfile.industry} onChange={(e) => handleDraftText('industry', e.target.value)} /></label>
            <label><span>{TEXT.team}</span><input value={draftProfile.team} onChange={(e) => handleDraftText('team', e.target.value)} /></label>
            <label><span>{TEXT.contact}</span><input value={draftProfile.contact} onChange={(e) => handleDraftText('contact', e.target.value)} /></label>
            <label className="wide"><span>{TEXT.tagline}</span><input value={draftProfile.tagline} onChange={(e) => handleDraftText('tagline', e.target.value)} /></label>
            <label className="wide"><span>{TEXT.goals}</span><textarea value={draftProfile.goals} onChange={(e) => handleDraftText('goals', e.target.value)} /></label>
            <label className="wide"><span>{TEXT.description}</span><textarea value={draftProfile.description} onChange={(e) => handleDraftText('description', e.target.value)} /></label>
            <label className="wide"><span>{TEXT.cultureSummary}</span><textarea value={draftProfile.cultureSummary} onChange={(e) => handleDraftText('cultureSummary', e.target.value)} /></label>
            <label><span>{TEXT.highlights}</span><textarea value={draftProfile.highlights.join('\n')} onChange={(e) => handleDraftList('highlights', e.target.value)} /></label>
            <label><span>{TEXT.products}</span><textarea value={draftProfile.products.join('\n')} onChange={(e) => handleDraftList('products', e.target.value)} /></label>
            <label><span>{TEXT.brands}</span><textarea value={draftProfile.brands.join('\n')} onChange={(e) => handleDraftList('brands', e.target.value)} /></label>
            <label><span>{TEXT.differentiators}</span><textarea value={draftProfile.differentiators.join('\n')} onChange={(e) => handleDraftList('differentiators', e.target.value)} /></label>
            <label><span>{TEXT.values}</span><textarea value={draftProfile.values.join('\n')} onChange={(e) => handleDraftList('values', e.target.value)} /></label>
            <label className="wide"><span>{TEXT.hiringTone}</span><textarea value={draftProfile.hiringTone} onChange={(e) => handleDraftText('hiringTone', e.target.value)} /></label>
          </div>
        </section>
      )}

      {profileReady ? (
        <section className={`company-preview company-layout-${displayProfile.layoutStyle}`} style={previewStyle} aria-label="Company home preview">
          <section className="company-hero-shell company-masthead" id="company-overview">
            <div className="company-hero-main">
              {logoSrc && <div className="company-masthead-logo"><img src={logoSrc} alt={`${heroTitle} logo`} /></div>}
              {displayProfile.industry && <span className="company-hero-eyebrow">{displayProfile.industry}</span>}
              <h2>{heroTitle}</h2>
              {displayProfile.tagline && <p className="company-tagline">{displayProfile.tagline}</p>}
              {displayProfile.website && <a href={displayProfile.website} target="_blank" rel="noreferrer">{pageText.openWebsite}</a>}
            </div>
            <aside className="company-hero-aside">{heroImageSrc ? <img className="company-hero-photo" src={heroImageSrc} alt={`${heroTitle} visual`} /> : <div className="company-hero-photo-placeholder" aria-hidden="true" />}</aside>
          </section>

          {facts.length > 0 && <section className="company-stats-bar" aria-label={pageText.overview}>{facts.map((fact) => <article key={fact.label}><span>{fact.label}</span><strong>{fact.value}</strong></article>)}</section>}

          {(displayProfile.description || displayProfile.goals) && (
            <section className="company-about-section">
              <div className="company-section-heading"><span className="company-kicker">{pageText.overview}</span><h3>{displayProfile.tagline || heroTitle}</h3></div>
              <div className="company-about-copy">{displayProfile.description && <p>{displayProfile.description}</p>}{displayProfile.goals && <p className="company-goal-copy">{displayProfile.goals}</p>}</div>
            </section>
          )}

          {focusItems.length > 0 && (
            <section className="company-focus-section">
              <div className="company-section-heading"><span className="company-kicker">{pageText.highlights}</span><h3>{pageText.differentiators}</h3></div>
              <div className="company-focus-grid">{focusItems.map((item, index) => <article key={item}><span>{String(index + 1).padStart(2, '0')}</span><p>{item}</p></article>)}</div>
            </section>
          )}

          {displayProfile.products.length > 0 && (
            <section className="company-portfolio-section" id="company-explore">
              <div className="company-section-heading"><span className="company-kicker">{pageText.explore}</span><h3>{pageText.products}</h3></div>
              <div className="company-portfolio-grid">{displayProfile.products.map((item, index) => <article key={item} className="company-portfolio-card"><span>{String(index + 1).padStart(2, '0')}</span><h4>{item}</h4></article>)}</div>
            </section>
          )}

          {brandRows.length > 0 && (
            <section className="company-partners-section">
              <div className="company-section-heading"><span className="company-kicker">{pageText.brands}</span><h3>{pageText.brands}</h3></div>
              <div className="company-brand-grid">
                {brandRows.map((row, rowIndex) => (
                  <div key={rowIndex} className="company-brand-row">
                    {row.map((item) => (
                      <div key={item} className="company-brand-pill">
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </section>
          )}


          {(displayProfile.values.length > 0 || displayProfile.cultureSummary || displayProfile.hiringTone) && (
            <section className="company-collaboration-section" id="company-work">
              <div className="company-collaboration-copy"><span className="company-kicker">{pageText.workWithUs}</span><h3>{pageText.values}</h3>{displayProfile.values.length > 0 && <ul>{displayProfile.values.map((item) => <li key={item}>{item}</li>)}</ul>}</div>
              <div className="company-collaboration-copy">{displayProfile.cultureSummary && <div><span className="company-kicker">{pageText.culture}</span><p>{displayProfile.cultureSummary}</p></div>}{displayProfile.hiringTone && <div><span className="company-kicker">{pageText.hiringTone}</span><p>{displayProfile.hiringTone}</p></div>}</div>
            </section>
          )}
        </section>
      ) : (
        <section className="company-empty-state"><span className="company-kicker">Preview</span><p>{TEXT.previewEmpty}</p></section>
      )}
    </main>
  );
}
