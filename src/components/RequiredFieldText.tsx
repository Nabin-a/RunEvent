import React from 'react';

/** Keep translated label text intact while styling its required-field marker. */
export function RequiredFieldText({ text }: { text: string }) {
  return (
    <>
      {text.split('*').map((part, index) => (
        <React.Fragment key={index}>
          {index > 0 && <span className="required-field-marker">*</span>}
          {part}
        </React.Fragment>
      ))}
    </>
  );
}
