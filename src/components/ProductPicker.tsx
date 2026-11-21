import { tx, txf } from '../i18n';
import { NoteTag, SeatTag } from './RegTags';
import { ProductArt, type ProductArtKind } from './ProductArt';

/**
 * Three linked frames for picking a product in the registration form:
 *   1. a preview of the chosen type,
 *   2. the type (e.g. short sleeve / sleeveless / tank, or medal / shirt / accessory),
 *   3. the sizes or variants of that type, with what is left in stock.
 * Choosing a type swaps the preview and the option list.
 */
export interface PickerOption {
  value: string;
  label: string;
  sub?: string;
  left: number;
  total: number;
  unit: string;
}

export interface PickerType {
  id: string;
  name: string;
  /** null = "nothing" choice, e.g. no souvenir */
  art: ProductArtKind | null;
  /** demo data: shown with a tag, and only the size is saved */
  demo?: boolean;
  optionLegend: string;
  options: PickerOption[];
}

export function ProductPicker({
  idPrefix,
  typeLegend,
  types,
  typeId,
  onTypeChange,
  optionValue,
  onOptionChange,
  emptyNote,
}: {
  idPrefix: string;
  typeLegend: string;
  types: PickerType[];
  typeId: string;
  onTypeChange: (id: string) => void;
  optionValue: string;
  onOptionChange: (value: string) => void;
  /** shown in place of the options when the chosen type has none */
  emptyNote?: string;
}) {
  const current = types.find((t) => t.id === typeId) ?? types[0];
  if (!current) return null;

  return (
    <div className="pp">
      <figure className="pp-preview">
        <div className="pp-preview-frame">
          {current.art ? (
            <ProductArt kind={current.art} className="pp-art" />
          ) : (
            <span className="pp-preview-empty">{tx('ไม่ได้เลือกสินค้า')}</span>
          )}
        </div>
        <figcaption>
          {current.art ? txf('ภาพตัวอย่าง · {0}', tx(current.name)) : tx(current.name)}
        </figcaption>
      </figure>

      <div className="pp-controls">
        <fieldset className="pp-group">
          <legend>{tx(typeLegend)}</legend>
          <div className="pp-types">
            {types.map((t) => (
              <label key={t.id} className={`pp-type ${t.id === current.id ? 'is-selected' : ''}`}>
                <input
                  type="radio"
                  name={`${idPrefix}-type`}
                  checked={t.id === current.id}
                  onChange={() => onTypeChange(t.id)}
                />
                <span>{tx(t.name)}</span>
              </label>
            ))}
          </div>
        </fieldset>

        {current.options.length > 0 ? (
          <fieldset className="pp-group">
            <legend>{tx(current.optionLegend)}</legend>
            <div className="pp-options">
              {current.options.map((o) => {
                const isSel = optionValue === o.value;
                const out = o.left <= 0;
                return (
                  <label
                    key={o.value}
                    className={`pp-option ${isSel ? 'is-selected' : ''} ${out ? 'is-disabled' : ''}`}
                  >
                    <input
                      type="radio"
                      name={`${idPrefix}-option`}
                      checked={isSel}
                      disabled={out}
                      onChange={() => onOptionChange(o.value)}
                    />
                    <strong className="pp-option-label">{tx(o.label)}</strong>
                    {o.sub && <span className="pp-option-sub mono-num">{tx(o.sub)}</span>}
                    <SeatTag left={o.left} total={o.total} unit={o.unit} />
                  </label>
                );
              })}
            </div>
            {current.demo && (
              <p className="pp-demo-note">
                <NoteTag>{tx('ข้อมูลจำลอง')}</NoteTag>
                <span>{tx('ทรงนี้ยังเป็นข้อมูลตัวอย่าง ระบบบันทึกเฉพาะไซส์ที่เลือก')}</span>
              </p>
            )}
          </fieldset>
        ) : (
          emptyNote && <p className="pp-empty-note">{tx(emptyNote)}</p>
        )}
      </div>
    </div>
  );
}
