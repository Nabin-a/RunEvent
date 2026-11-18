import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { EN_DICT } from './en';

export type Lang = 'th' | 'en';

const LANG_STORAGE_KEY = 'runevent_v2_lang';

function readInitialLang(): Lang {
  try {
    const saved = window.localStorage.getItem(LANG_STORAGE_KEY);
    if (saved === 'th' || saved === 'en') return saved;
  } catch {
    // ignore
  }
  return 'th';
}

// ภาษาปัจจุบันระดับโมดูล — ให้ tx() เรียกใช้ได้ทุกที่โดยไม่ต้องส่ง context ลงไปทุกชั้น
let currentLang: Lang = readInitialLang();

const normalizeKey = (s: string) => s.replace(/\s+/g, ' ').trim();

interface CompiledTemplate {
  re: RegExp;
  enTemplate: string;
}

let compiledTemplates: CompiledTemplate[] | null = null;
const dynamicMissCache = new Map<string, string>();

function getCompiledTemplates(): CompiledTemplate[] {
  if (compiledTemplates) return compiledTemplates;
  const list: { thLen: number; item: CompiledTemplate }[] = [];
  for (const [k, v] of Object.entries(EN_DICT)) {
    if (!k.includes('{0}')) continue;
    const staticText = k.replace(/\{\d+\}/g, '').trim();
    if (staticText.length < 3) continue;
    const escaped = k
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      .replace(/\\\{(\d+)\\\}/g, '(.+?)');
    list.push({
      thLen: staticText.length,
      item: { re: new RegExp(`^${escaped}$`), enTemplate: v },
    });
  }
  // เรียงจากข้อความคงที่ยาวสุดก่อน เพื่อจับ pattern ที่เฉพาะเจาะจงที่สุดก่อน
  list.sort((a, b) => b.thLen - a.thLen);
  compiledTemplates = list.map((x) => x.item);
  return compiledTemplates;
}

function lookup(th: string, depth = 0): string {
  if (currentLang === 'th' || !th) return th;
  const direct = EN_DICT[th];
  if (direct !== undefined) return direct;
  const norm = normalizeKey(th);
  const hit = EN_DICT[norm];
  if (hit !== undefined) {
    const lead = th.match(/^\s*/)?.[0] ?? '';
    const trail = th.match(/\s*$/)?.[0] ?? '';
    return `${lead}${hit}${trail}`;
  }
  if (depth > 2 || !/[\u0E00-\u0E7F]/.test(norm)) return th;
  const cached = dynamicMissCache.get(norm);
  if (cached !== undefined) return cached;

  for (const tpl of getCompiledTemplates()) {
    const m = norm.match(tpl.re);
    if (m) {
      const translated = tpl.enTemplate.replace(/\{(\d+)\}/g, (_, idxStr: string) => {
        const captured = m[Number(idxStr) + 1] ?? '';
        return lookup(captured, depth + 1);
      });
      if (dynamicMissCache.size < 1000) dynamicMissCache.set(norm, translated);
      const lead = th.match(/^\s*/)?.[0] ?? '';
      const trail = th.match(/\s*$/)?.[0] ?? '';
      return `${lead}${translated}${trail}`;
    }
  }
  return th;
}

/**
 * แปลข้อความที่แสดงผล: รับค่าอะไรก็ได้ ถ้าเป็น string และมีคำแปลจะคืนภาษาอังกฤษ
 * ค่าอื่น (ตัวเลข, React element, null) คืนค่าเดิม — จึงห่อ {expr} ใน JSX ได้อย่างปลอดภัย
 */
export function tx<T>(value: T): T {
  if (typeof value !== 'string' || currentLang === 'th') return value;
  return lookup(value) as unknown as T;
}

/** แปลข้อความที่มีตัวแปร: template ใช้ {0} {1} … เป็นตำแหน่งตัวแปร */
export function txf(template: string, ...args: unknown[]): string {
  const base = currentLang === 'th' ? template : lookup(template);
  return base.replace(/\{(\d+)\}/g, (_, i: string) => {
    const v = args[Number(i)];
    return v === undefined || v === null ? '' : String(tx(v as string));
  });
}

export function getLang(): Lang {
  return currentLang;
}

interface I18nContextValue {
  lang: Lang;
  setLang: (next: Lang) => void;
  tx: typeof tx;
  txf: typeof txf;
}

const I18nContext = createContext<I18nContextValue>({
  lang: currentLang,
  setLang: () => undefined,
  tx,
  txf,
});

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLangState] = useState<Lang>(currentLang);

  const setLang = useCallback((next: Lang) => {
    currentLang = next;
    try {
      window.localStorage.setItem(LANG_STORAGE_KEY, next);
    } catch {
      // ignore
    }
    setLangState(next);
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const value = useMemo(() => ({ lang, setLang, tx, txf }), [lang, setLang]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

/** ใช้ใน component ที่ต้อง re-render เมื่อเปลี่ยนภาษา (App ใช้ตัวนี้ จึงทำให้ทั้ง tree re-render) */
export function useI18n(): I18nContextValue {
  return useContext(I18nContext);
}
