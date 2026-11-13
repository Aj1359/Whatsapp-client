/**
 * Meta WhatsApp Cloud API Client
 * Exactly implements the 8 integration functions from PRD Page 17
 */

import { classifyMetaError } from './errors.js';

export interface WhatsAppClientConfig {
  graphVersion?: string; // defaults to 'v21.0'
}

export class WhatsAppClient {
  private base: string;

  constructor(graphVersion: string = 'v21.0') {
    this.base = `https://graph.facebook.com/${graphVersion}`;
  }

  /**
   * 1. testConnection
   * GET /{phone-number-id}?fields=display_phone_number,verified_name,quality_rating
   * Used by: Test button; saves display number, verified name, and quality rating
   */
  async testConnection(phoneNumberId: string, token: string) {
    const url = `${this.base}/${phoneNumberId}?fields=display_phone_number,verified_name,quality_rating`;
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data: any = await res.json();
    if (!res.ok) {
      const code = data?.error?.code;
      const errorInfo = classifyMetaError(code, res.status);
      throw new Error(data?.error?.message || errorInfo.message);
    }

    return {
      display_phone_number: data.display_phone_number as string,
      verified_name: data.verified_name as string,
      quality_rating: data.quality_rating as string,
    };
  }

  /**
   * 2. subscribeApp
   * POST /{waba-id}/subscribed_apps
   * Used by: Runs when credentials are saved so Meta sends webhooks to our app
   */
  async subscribeApp(wabaId: string, token: string) {
    const url = `${this.base}/${wabaId}/subscribed_apps`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data: any = await res.json();
    if (!res.ok) {
      throw new Error(data?.error?.message || 'Failed to subscribe app to WABA');
    }
    return data;
  }

  /**
   * 3. uploadMedia
   * POST /{phone-number-id}/media (multipart: messaging_product=whatsapp, file, type)
   * Used by: Campaign start; returns id saved as media_id
   */
  async uploadMedia(phoneNumberId: string, token: string, fileBuffer: Buffer, mimeType: string, filename = 'image.jpg') {
    const url = `${this.base}/${phoneNumberId}/media`;
    const formData = new FormData();
    formData.append('messaging_product', 'whatsapp');
    formData.append('type', mimeType);
    const blob = new Blob([fileBuffer], { type: mimeType });
    formData.append('file', blob, filename);

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    const data: any = await res.json();
    if (!res.ok) {
      throw new Error(data?.error?.message || 'Media upload failed');
    }

    return { mediaId: data.id as string };
  }

  /**
   * 4. uploadTemplateSample
   * POST /{app-id}/uploads?file_length=&file_type=&file_name= -> upload ID
   * POST /{upload-id} with header Authorization: OAuth <token>, file_offset: 0 -> returns handle h
   * Needed once per template with image header; uses META_APP_ID
   */
  async uploadTemplateSample(appId: string, appToken: string, fileBuffer: Buffer, mimeType: string, fileName = 'sample.jpg') {
    // Step 4a: create upload session
    const sessionUrl = `${this.base}/${appId}/uploads?file_length=${fileBuffer.length}&file_type=${encodeURIComponent(mimeType)}&file_name=${encodeURIComponent(fileName)}`;
    const sessRes = await fetch(sessionUrl, {
      method: 'POST',
      headers: {
        Authorization: `OAuth ${appToken}`,
      },
    });

    const sessData: any = await sessRes.json();
    if (!sessRes.ok) {
      throw new Error(sessData?.error?.message || 'Failed to create upload session for template sample');
    }

    const uploadId = sessData.id;

    // Step 4b: upload file bytes
    const uploadUrl = `${this.base}/${uploadId}`;
    const uploadRes = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        Authorization: `OAuth ${appToken}`,
        file_offset: '0',
        'Content-Type': mimeType,
      },
      body: fileBuffer,
    });

    const uploadData: any = await uploadRes.json();
    if (!uploadRes.ok) {
      throw new Error(uploadData?.error?.message || 'Failed to upload template sample bytes');
    }

    return { handle: uploadData.h as string };
  }

  /**
   * 5. createTemplate
   * POST /{waba-id}/message_templates
   * Used by: Template submit
   */
  async createTemplate(wabaId: string, token: string, template: {
    name: string;
    language: string;
    category: 'MARKETING' | 'UTILITY';
    components: any[];
  }) {
    const url = `${this.base}/${wabaId}/message_templates`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(template),
    });

    const data: any = await res.json();
    if (!res.ok) {
      throw new Error(data?.error?.message || 'Template submission failed');
    }

    return data;
  }

  /**
   * 6. listTemplates
   * GET /{waba-id}/message_templates?fields=name,status,category,language,components,rejected_reason&limit=100
   * Used by: Template sync
   */
  async listTemplates(wabaId: string, token: string) {
    let url = `${this.base}/${wabaId}/message_templates?fields=name,status,category,language,components,rejected_reason&limit=100`;
    const allTemplates: any[] = [];

    while (url) {
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data: any = await res.json();
      if (!res.ok) {
        throw new Error(data?.error?.message || 'Failed to list message templates');
      }

      if (Array.isArray(data.data)) {
        allTemplates.push(...data.data);
      }

      url = data.paging?.next || null;
    }

    return allTemplates;
  }

  /**
   * 7. sendTemplate
   * POST /{phone-number-id}/messages
   * Used by: Sender worker
   * Success response holds message ID at messages[0].id -> save as wa_message_id
   */
  async sendTemplate(
    phoneNumberId: string,
    token: string,
    to: string, // E.164 without '+'
    templateName: string,
    languageCode: string,
    components: any[]
  ): Promise<{ success: boolean; wa_message_id?: string; error?: any }> {
    const cleanedTo = to.replace(/^\+/, '');
    const url = `${this.base}/${phoneNumberId}/messages`;

    const body = {
      messaging_product: 'whatsapp',
      to: cleanedTo,
      type: 'template',
      template: {
        name: templateName,
        language: { code: languageCode },
        components,
      },
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data: any = await res.json();
    if (!res.ok) {
      const code = data?.error?.code;
      const classified = classifyMetaError(code, res.status);
      return {
        success: false,
        error: {
          code,
          message: data?.error?.message || classified.message,
          severity: classified.severity,
          isRetryable: classified.isRetryable,
          isCampaignFatal: classified.isCampaignFatal,
        },
      };
    }

    return {
      success: true,
      wa_message_id: data.messages?.[0]?.id,
    };
  }

  /**
   * 8. sendFreeForm
   * POST /{phone-number-id}/messages with type text, image, video, document, or audio
   * Only if contact messaged within last 24 hours (check inbound_messages)
   */
  async sendFreeForm(
    phoneNumberId: string,
    token: string,
    to: string,
    type: 'text' | 'image' | 'video' | 'document' | 'audio',
    payload: {
      text?: string;
      mediaId?: string;
      link?: string;
      caption?: string;
      filename?: string;
    }
  ) {
    const cleanedTo = to.replace(/^\+/, '');
    const url = `${this.base}/${phoneNumberId}/messages`;

    const body: any = {
      messaging_product: 'whatsapp',
      to: cleanedTo,
      type,
    };

    if (type === 'text') {
      body.text = { body: payload.text ?? '', preview_url: false };
    } else if (type === 'image') {
      body.image = payload.mediaId
        ? { id: payload.mediaId, caption: payload.caption }
        : { link: payload.link, caption: payload.caption };
    } else if (type === 'video') {
      body.video = payload.mediaId
        ? { id: payload.mediaId, caption: payload.caption }
        : { link: payload.link, caption: payload.caption };
    } else if (type === 'document') {
      body.document = payload.mediaId
        ? { id: payload.mediaId, caption: payload.caption, filename: payload.filename || 'document.pdf' }
        : { link: payload.link, caption: payload.caption, filename: payload.filename || 'document.pdf' };
    } else if (type === 'audio') {
      body.audio = payload.mediaId
        ? { id: payload.mediaId }
        : { link: payload.link };
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data: any = await res.json();
    if (!res.ok) {
      throw new Error(data?.error?.message || 'Freeform message failed');
    }

    return {
      success: true,
      wa_message_id: data.messages?.[0]?.id,
    };
  }
}

export const defaultWhatsAppClient = new WhatsAppClient();

