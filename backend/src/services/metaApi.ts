/**
 * Meta WhatsApp Cloud API client
 * Docs: https://developers.facebook.com/docs/whatsapp/cloud-api
 */

const BASE = 'https://graph.facebook.com/v19.0';

export interface WaTextMessage {
  to: string;
  body: string;
}

export interface WaTemplateMessage {
  to: string;
  templateName: string;
  languageCode: string;
  components?: object[];
}

export interface WaMediaMessage {
  to: string;
  type: 'image' | 'video' | 'document';
  mediaUrl: string;
  caption?: string;
}

export type SendResult = { messageId: string } | { error: string; code?: string };

async function post(phoneNumberId: string, token: string, body: object): Promise<SendResult> {
  const res = await fetch(`${BASE}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const json: any = await res.json();
  if (!res.ok) {
    return {
      error: json?.error?.message ?? 'Unknown error',
      code: String(json?.error?.code ?? ''),
    };
  }
  return { messageId: json.messages?.[0]?.id ?? '' };
}

export function sendText(
  phoneNumberId: string,
  token: string,
  msg: WaTextMessage
): Promise<SendResult> {
  return post(phoneNumberId, token, {
    messaging_product: 'whatsapp',
    to: msg.to,
    type: 'text',
    text: { body: msg.body, preview_url: false },
  });
}

export function sendTemplate(
  phoneNumberId: string,
  token: string,
  msg: WaTemplateMessage
): Promise<SendResult> {
  return post(phoneNumberId, token, {
    messaging_product: 'whatsapp',
    to: msg.to,
    type: 'template',
    template: {
      name: msg.templateName,
      language: { code: msg.languageCode },
      components: msg.components ?? [],
    },
  });
}

export function sendMedia(
  phoneNumberId: string,
  token: string,
  msg: WaMediaMessage
): Promise<SendResult> {
  return post(phoneNumberId, token, {
    messaging_product: 'whatsapp',
    to: msg.to,
    type: msg.type,
    [msg.type]: { link: msg.mediaUrl, caption: msg.caption },
  });
}

/** Fetch approved templates from Meta */
export async function fetchTemplates(wabaId: string, token: string) {
  const url = `${BASE}/${wabaId}/message_templates?fields=name,language,category,components,status&limit=250`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Meta API error ${res.status}`);
  const json: any = await res.json();
  return (json.data ?? []) as any[];
}

