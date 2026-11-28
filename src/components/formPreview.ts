import { useEffect, useRef, useState } from 'react';
import type { CustomRegistrationField, FormStepDef, OrganizerFormStep } from '../types';

/**
 * Live preview channel between the organizer's registration-form editor and the runner's real
 * sign-up page shown inside its iframe (`/events/<id>/register?preview=form`). Same-origin
 * postMessage only. Nothing is sent to the server from the preview: the final submit is blocked.
 *
 * editor -> page : { type: 'kr-form-preview', form: { fields, steps }, step }   (unsaved form + the step open in the editor)
 * page -> editor : { type: 'kr-form-ready' }
 *                  { type: 'kr-form-step', step }   (the runner moved to another step inside the preview)
 *
 * Step keys are step ids ('start' | 'core' | <own step id> | 'shop' | 'souvenir' | 'address' | 'review' by default) or 'pay'.
 */
export const FORM_PREVIEW_PARAM = 'form';

export const isFormPreviewUrl = (): boolean =>
  typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('preview') === FORM_PREVIEW_PARAM;

/** the unsaved form; `flow` (27 Nov 2026) is the whole step order from the combined editor */
export type PreviewForm = { fields: CustomRegistrationField[]; steps: OrganizerFormStep[]; flow?: FormStepDef[] };

export interface FormPreviewState {
  /** true inside the editor's iframe */
  active: boolean;
  /** the unsaved form the editor sent, if any */
  form: PreviewForm | null;
  /** the step open in the editor, and a counter that changes with each message that names one */
  step: { key: string; n: number } | null;
  /** tell the editor the runner moved to another step */
  report: (key: string) => void;
}

const post = (msg: unknown) => window.parent?.postMessage(msg, window.location.origin);

export function useFormPreview(): FormPreviewState {
  const active = isFormPreviewUrl();
  const [form, setForm] = useState<PreviewForm | null>(null);
  const [step, setStep] = useState<{ key: string; n: number } | null>(null);
  // the page reports its step only once the editor has named one (else its first step would pull the editor back)
  const heard = useRef(false);

  useEffect(() => {
    if (!active) return;
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || e.source !== window.parent) return;
      const data = e.data as { type?: string; form?: PreviewForm; step?: string };
      if (data?.type !== 'kr-form-preview') return;
      if (data.form && Array.isArray(data.form.fields) && Array.isArray(data.form.steps)) setForm(data.form);
      if (typeof data.step === 'string') {
        const key = data.step;
        heard.current = true;
        setStep((s) => (s && s.key === key ? s : { key, n: (s?.n ?? 0) + 1 }));
      }
    };
    window.addEventListener('message', onMessage);
    post({ type: 'kr-form-ready' });
    return () => window.removeEventListener('message', onMessage);
  }, [active]);

  return {
    active,
    form,
    step,
    report: (key: string) => {
      if (active && heard.current) post({ type: 'kr-form-step', step: key });
    },
  };
}
