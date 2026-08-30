export interface EmailJsConfig {
  serviceId: string;
  templateId: string;
  publicKey: string;
  privateKey?: string;
}

const REQUIRED_KEYS = [
  'EMAILJS_SERVICE_ID',
  'EMAILJS_TEMPLATE_ID',
  'EMAILJS_PUBLIC_KEY',
] as const;

export function readEmailJsConfig(environment: NodeJS.ProcessEnv): EmailJsConfig {
  const values = {
    EMAILJS_SERVICE_ID: environment.EMAILJS_SERVICE_ID?.trim() ?? '',
    EMAILJS_TEMPLATE_ID: environment.EMAILJS_TEMPLATE_ID?.trim() ?? '',
    EMAILJS_PUBLIC_KEY: environment.EMAILJS_PUBLIC_KEY?.trim() ?? '',
  };
  const missing = REQUIRED_KEYS.filter(key => !values[key]);
  if (missing.length > 0) {
    throw new Error(`Missing EmailJS configuration: ${missing.join(', ')}`);
  }

  const privateKey = environment.EMAILJS_PRIVATE_KEY?.trim();
  return {
    serviceId: values.EMAILJS_SERVICE_ID,
    templateId: values.EMAILJS_TEMPLATE_ID,
    publicKey: values.EMAILJS_PUBLIC_KEY,
    ...(privateKey ? { privateKey } : {}),
  };
}
