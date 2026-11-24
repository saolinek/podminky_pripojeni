import { FEEDBACK_CATEGORIES, type FeedbackCategory } from '../types';

const FORMSUBMIT_ENDPOINT = 'https://formsubmit.co/ajax/42992a4356098d8f44dea0a9df4a6f90';
const CATEGORY_LABEL_MAP = new Map(FEEDBACK_CATEGORIES.map((c) => [c.id, c.label]));

interface FormSubmitResponse {
  success?: boolean | string;
  message?: string;
}

export async function sendFeedbackEmailNotification(input: {
  category: FeedbackCategory;
  rating: number;
  message: string;
  authorName: string;
}): Promise<{ ok: boolean; message?: string }> {
  const categoryLabel = CATEGORY_LABEL_MAP.get(input.category) ?? 'Obecná zpráva';
  const ratingText = input.rating > 0 ? `${input.rating} / 5` : 'Nevyplněno';
  const authorText = input.authorName.trim() || 'Anonymní';

  const payload = {
    _subject: `Nová zpětná vazba (${categoryLabel}) · Připojení zdroje ČEZ`,
    _template: 'table',
    _captcha: 'false',
    Typ: categoryLabel,
    Hodnoceni: ratingText,
    Autor: authorText,
    Zprava: input.message.trim(),
  };

  try {
    const res = await fetch(FORMSUBMIT_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = (await res.json().catch(() => ({}))) as FormSubmitResponse;
    const isOk = res.ok && (data.success === true || data.success === 'true');
    return {
      ok: isOk,
      message: data.message,
    };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : String(err),
    };
  }
}
