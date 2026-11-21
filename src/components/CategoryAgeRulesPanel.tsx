import React, { useMemo, useState } from 'react';
import type { AgeBasis, AgeGroupDef, AgeGroupGender, RaceCategory, RaceEvent, RegistrationRecord } from '../types';
import {
  ageBasisDate,
  buildStandardAgeGroups,
  findAgeGroupGaps,
  formatAgeBasis,
  formatAgeGroupLabel,
  formatAgeLimit,
  formatBasisDate,
  resolveAgeBasis,
  validateAgeConfig,
  type AgeConfigValid,
} from '../utils/age';
import { IconAlert, IconClose, IconPlus } from './Icons';
import { tx, txf } from '../i18n';

interface Props {
  event: RaceEvent;
  registrations: RegistrationRecord[];
  canEdit: boolean;
  onSave: (categoryId: string, config: AgeConfigValid) => Promise<{ ok: boolean; error?: string }>;
}

interface DraftRow {
  key: string;
  gender: AgeGroupGender;
  minAge: string;
  maxAge: string;
}

interface Draft {
  ageBasis: AgeBasis;
  minAge: string;
  maxAge: string;
  rows: DraftRow[];
}

let rowSeq = 0;
const nextKey = () => `ag-${(rowSeq += 1)}`;

function toRows(groups: AgeGroupDef[] | undefined): DraftRow[] {
  return (groups ?? []).map((g) => ({
    key: nextKey(),
    gender: g.gender,
    minAge: String(g.minAge),
    maxAge: g.maxAge === null ? '' : String(g.maxAge),
  }));
}

function draftFromCategory(cat: RaceCategory): Draft {
  return {
    ageBasis: resolveAgeBasis(cat),
    minAge: typeof cat.minAge === 'number' ? String(cat.minAge) : '',
    maxAge: typeof cat.maxAge === 'number' ? String(cat.maxAge) : '',
    rows: toRows(cat.ageGroups),
  };
}

function draftToInput(d: Draft) {
  return {
    ageBasis: d.ageBasis,
    minAge: d.minAge.trim(),
    maxAge: d.maxAge.trim(),
    ageGroups: d.rows.map((r) => ({ gender: r.gender, minAge: r.minAge.trim(), maxAge: r.maxAge.trim() })),
  };
}

const ACTIVE_STATUSES = new Set(['confirmed', 'pending_payment']);

export const CategoryAgeRulesPanel: React.FC<Props> = ({ event, registrations, canEdit, onSave }) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);

  const activeRegs = useMemo(
    () => registrations.filter((r) => r.eventId === event.id && ACTIVE_STATUSES.has(r.registrationStatus)),
    [registrations, event.id]
  );

  const checked = useMemo(() => (draft ? validateAgeConfig(draftToInput(draft)) : null), [draft]);
  const gaps = checked?.ok ? findAgeGroupGaps(checked.value) : [];

  const startEdit = (cat: RaceCategory) => {
    setEditingId(cat.id);
    setDraft(draftFromCategory(cat));
    setServerError(null);
    setSavedId(null);
  };
  const cancelEdit = () => {
    setEditingId(null);
    setDraft(null);
    setServerError(null);
  };
  const patchDraft = (p: Partial<Draft>) => setDraft((prev) => (prev ? { ...prev, ...p } : prev));
  const patchRow = (key: string, p: Partial<DraftRow>) =>
    setDraft((prev) => (prev ? { ...prev, rows: prev.rows.map((r) => (r.key === key ? { ...r, ...p } : r)) } : prev));

  const handleSave = async (catId: string) => {
    if (!checked?.ok) return;
    setSaving(true);
    setServerError(null);
    const res = await onSave(catId, checked.value);
    setSaving(false);
    if (!res.ok) {
      setServerError(res.error ?? tx('บันทึกไม่สำเร็จ กรุณาลองใหม่'));
      return;
    }
    setSavedId(catId);
    setEditingId(null);
    setDraft(null);
  };

  return (
    <section className="clean-panel age-rules-panel">
      <div className="section-title-bar">
        <h2>{tx('เกณฑ์อายุและรุ่นอายุ')}</h2>
      </div>
      <p className="muted-block">
        {tx('กำหนดอายุที่รับสมัครและรุ่นอายุของแต่ละระยะ ระบบคำนวณอายุจากวันเกิดของผู้เข้าแข่งขันตอนสมัคร แล้วบันทึกอายุและรุ่นไว้ในใบสมัคร หากแก้เกณฑ์ภายหลัง ใบสมัครเดิมยังคงรุ่นเดิม')}
      </p>

      <div className="age-rules-list">
        {event.categories.map((cat) => {
          const basis = resolveAgeBasis(cat);
          const basisDate = ageBasisDate(event.eventDate, basis);
          const limit = formatAgeLimit(cat);
          const groups = cat.ageGroups ?? [];
          const catRegs = activeRegs.filter((r) => r.categoryId === cat.id);
          const noDob = catRegs.filter((r) => !r.ageSnapshot).length;
          const noGroup = catRegs.filter((r) => r.ageSnapshot && !r.ageSnapshot.groupId).length;
          const isEditing = editingId === cat.id && draft;

          return (
            <article key={cat.id} className="age-rule-card" aria-labelledby={`age-cat-${cat.id}`}>
              <header className="age-rule-head">
                <div className="age-rule-title">
                  <span className={`category-bib-chip tone-${cat.colorTag}`}>{tx(cat.code)}</span>
                  <h3 id={`age-cat-${cat.id}`}>{tx(cat.name)}</h3>
                </div>
                {canEdit && !isEditing && (
                  <button type="button" className="btn-ghost-sm" onClick={() => startEdit(cat)}>
                    {tx('แก้ไขเกณฑ์อายุ')}
                  </button>
                )}
              </header>

              {!isEditing && (
                <>
                  <dl className="age-rule-facts">
                    <div>
                      <dt>{tx('วันที่นับอายุ')}</dt>
                      <dd>
                        {formatAgeBasis(basis)}{' '}
                        <span className="muted-inline mono-num">({formatBasisDate(basisDate)})</span>
                      </dd>
                    </div>
                    <div>
                      <dt>{tx('อายุที่รับสมัคร')}</dt>
                      <dd>{limit ?? tx('ไม่จำกัดอายุ')}</dd>
                    </div>
                    <div>
                      <dt>{tx('รุ่นอายุ')}</dt>
                      <dd>{groups.length ? txf('{0} รุ่น', groups.length) : tx('ยังไม่ได้กำหนด')}</dd>
                    </div>
                  </dl>

                  {groups.length > 0 && (
                    <div className="table-scroll">
                      <table className="ops-table age-group-table">
                        <thead>
                          <tr>
                            <th>{tx('รุ่น')}</th>
                            <th className="num-col">{tx('ผู้สมัคร (ยืนยัน + รอชำระ)')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {groups.map((g) => (
                            <tr key={g.id}>
                              <td>{formatAgeGroupLabel(g)}</td>
                              <td className="num-col mono-num">
                                {catRegs.filter((r) => r.ageSnapshot?.groupId === g.id).length}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {(noDob > 0 || noGroup > 0) && (
                    <p className="age-rule-note">
                      <IconAlert size={14} />
                      <span>
                        {noDob > 0 && txf('{0} ใบสมัครไม่มีวันเกิด', noDob)}
                        {noDob > 0 && noGroup > 0 && ' · '}
                        {noGroup > 0 && txf('{0} ใบสมัครไม่เข้ารุ่นใด (เช่น ไม่ระบุเพศ หรืออายุอยู่นอกช่วงรุ่น)', noGroup)}
                      </span>
                    </p>
                  )}
                  {savedId === cat.id && (
                    <p className="age-rule-saved" role="status">
                      {tx('บันทึกเกณฑ์อายุแล้ว ใช้กับใบสมัครใหม่ตั้งแต่ตอนนี้')}
                    </p>
                  )}
                </>
              )}

              {isEditing && draft && (
                <div className="age-rule-editor">
                  <fieldset className="age-basis-field">
                    <legend>{tx('วันที่นับอายุ')}</legend>
                    {(['race_day', 'year_end'] as const).map((b) => (
                      <label key={b} className="age-basis-option">
                        <input
                          type="radio"
                          name={`age-basis-${cat.id}`}
                          checked={draft.ageBasis === b}
                          onChange={() => patchDraft({ ageBasis: b })}
                        />
                        <span>
                          {formatAgeBasis(b)}{' '}
                          <span className="muted-inline mono-num">
                            ({formatBasisDate(ageBasisDate(event.eventDate, b))})
                          </span>
                        </span>
                      </label>
                    ))}
                  </fieldset>

                  <div className="form-grid-2 age-limit-grid">
                    <div className="form-row">
                      <label htmlFor={`age-min-${cat.id}`}>{tx('อายุต่ำสุด (ปี)')}</label>
                      <input
                        id={`age-min-${cat.id}`}
                        type="number"
                        inputMode="numeric"
                        min={0}
                        max={120}
                        placeholder={tx('ไม่จำกัด')}
                        value={draft.minAge}
                        onChange={(e) => patchDraft({ minAge: e.target.value })}
                      />
                    </div>
                    <div className="form-row">
                      <label htmlFor={`age-max-${cat.id}`}>{tx('อายุสูงสุด (ปี)')}</label>
                      <input
                        id={`age-max-${cat.id}`}
                        type="number"
                        inputMode="numeric"
                        min={0}
                        max={120}
                        placeholder={tx('ไม่จำกัด')}
                        value={draft.maxAge}
                        onChange={(e) => patchDraft({ maxAge: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="age-groups-editor">
                    <div className="age-groups-editor-head">
                      <h4>{tx('รุ่นอายุ')}</h4>
                      <div className="age-groups-tools">
                        <button
                          type="button"
                          className="btn-ghost-sm"
                          onClick={() => {
                            const min = draft.minAge.trim() === '' ? null : Number(draft.minAge);
                            const max = draft.maxAge.trim() === '' ? null : Number(draft.maxAge);
                            patchDraft({
                              rows: toRows(
                                buildStandardAgeGroups(
                                  Number.isInteger(min) ? min : null,
                                  Number.isInteger(max) ? max : null
                                )
                              ),
                            });
                          }}
                        >
                          {tx('ใช้ชุดเริ่มต้น (ชาย/หญิง ช่วงละ 10 ปี)')}
                        </button>
                        {draft.rows.length > 0 && (
                          <button type="button" className="btn-ghost-sm" onClick={() => patchDraft({ rows: [] })}>
                            {tx('ล้างรุ่นทั้งหมด')}
                          </button>
                        )}
                      </div>
                    </div>

                    {draft.rows.length === 0 ? (
                      <p className="muted-block">
                        {tx('ยังไม่มีรุ่น ผู้สมัครยังสมัครได้ตามเกณฑ์อายุ แต่จะไม่ถูกจัดเข้ารุ่น')}
                      </p>
                    ) : (
                      <div className="table-scroll">
                        <table className="ops-table age-group-edit-table">
                          <thead>
                            <tr>
                              <th>{tx('เพศ')}</th>
                              <th>{tx('อายุตั้งแต่')}</th>
                              <th>{tx('ถึงอายุ')}</th>
                              <th>
                                <span className="sr-only">{tx('ลบ')}</span>
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {draft.rows.map((r, i) => (
                              <tr key={r.key}>
                                <td>
                                  <select
                                    aria-label={txf('เพศของรุ่นที่ {0}', i + 1)}
                                    value={r.gender}
                                    onChange={(e) => patchRow(r.key, { gender: e.target.value as AgeGroupGender })}
                                  >
                                    <option value="ชาย">{tx('ชาย')}</option>
                                    <option value="หญิง">{tx('หญิง')}</option>
                                    <option value="all">{tx('ทุกเพศ')}</option>
                                  </select>
                                </td>
                                <td>
                                  <input
                                    type="number"
                                    inputMode="numeric"
                                    min={0}
                                    max={120}
                                    aria-label={txf('อายุเริ่มของรุ่นที่ {0}', i + 1)}
                                    value={r.minAge}
                                    onChange={(e) => patchRow(r.key, { minAge: e.target.value })}
                                  />
                                </td>
                                <td>
                                  <input
                                    type="number"
                                    inputMode="numeric"
                                    min={0}
                                    max={120}
                                    placeholder={tx('ขึ้นไป')}
                                    aria-label={txf('อายุสิ้นสุดของรุ่นที่ {0}', i + 1)}
                                    value={r.maxAge}
                                    onChange={(e) => patchRow(r.key, { maxAge: e.target.value })}
                                  />
                                </td>
                                <td>
                                  <button
                                    type="button"
                                    className="age-row-remove"
                                    aria-label={txf('ลบรุ่นที่ {0}', i + 1)}
                                    onClick={() =>
                                      patchDraft({ rows: draft.rows.filter((x) => x.key !== r.key) })
                                    }
                                  >
                                    <IconClose size={14} />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                    <button
                      type="button"
                      className="btn-ghost-sm age-add-row"
                      onClick={() =>
                        patchDraft({
                          rows: [...draft.rows, { key: nextKey(), gender: 'ชาย', minAge: '', maxAge: '' }],
                        })
                      }
                    >
                      <IconPlus size={14} /> {tx('เพิ่มรุ่น')}
                    </button>
                  </div>

                  {checked && !checked.ok && (
                    <p className="field-error" role="alert">
                      {checked.message}
                    </p>
                  )}
                  {gaps.length > 0 && (
                    <p className="age-rule-note">
                      <IconAlert size={14} />
                      <span>
                        {txf('ช่วงอายุที่ยังไม่มีรุ่นรองรับ: {0} ผู้สมัครในช่วงนี้สมัครได้แต่ไม่เข้ารุ่น', gaps.join(', '))}
                      </span>
                    </p>
                  )}
                  {serverError && (
                    <p className="field-error" role="alert">
                      {serverError}
                    </p>
                  )}

                  <div className="age-rule-actions">
                    <button type="button" className="btn-secondary" onClick={cancelEdit} disabled={saving}>
                      {tx('ยกเลิก')}
                    </button>
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={() => handleSave(cat.id)}
                      disabled={saving || !checked?.ok}
                    >
                      {saving ? tx('กำลังบันทึก…') : tx('บันทึกเกณฑ์อายุ')}
                    </button>
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
};
