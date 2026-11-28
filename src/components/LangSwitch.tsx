import React from 'react';

type Lang = 'th' | 'en';

/* TH / EN slide switch (26 Nov 2026, user pick "ก", look modelled on a neumorphic
   CodePen toggle the user linked; our own code). A raised round knob slides in a
   sunken pill track to the chosen language. Each side is a real button; pressing
   the side that is already chosen flips to the other one, like the toggle it
   is modelled on. */
export const LangSwitch: React.FC<{
  lang: Lang;
  setLang: (lang: Lang) => void;
  className?: string;
}> = ({ lang, setLang, className }) => {
  const pick = (next: Lang) => setLang(next === lang ? (lang === 'th' ? 'en' : 'th') : next);
  return (
    <div
      className={`lang-slide${className ? ` ${className}` : ''}`}
      role="group"
      aria-label={lang === 'th' ? 'เลือกภาษา' : 'Choose language'}
      data-lang={lang}
    >
      <span className="lang-slide-knob" aria-hidden="true" />
      <button type="button" aria-pressed={lang === 'th'} lang="th" onClick={() => pick('th')}>
        TH
      </button>
      <button type="button" aria-pressed={lang === 'en'} lang="en" onClick={() => pick('en')}>
        EN
      </button>
    </div>
  );
};
