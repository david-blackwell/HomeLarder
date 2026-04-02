import React, { useState, useEffect, useCallback, useRef } from 'react';
import ReactDOM from 'react-dom';

const API = window.location.hostname === 'localhost' ? 'http://localhost:3001' : '';

async function api(path, opts = {}) {
  const res = await fetch(`${API}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

const TODAY = new Date().toISOString().split('T')[0];

// ── Responsive hook ───────────────────────────────────────────────────────
function useIsMobile() {
  const [mobile, setMobile] = useState(() => window.innerWidth <= 600);
  useEffect(() => {
    const h = () => setMobile(window.innerWidth <= 600);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);
  return mobile;
}

// ── Helpers ───────────────────────────────────────────────────────────────
function Spinner({ size = 18 }) {
  return <div style={{ width: size, height: size, border: '2px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block', flexShrink: 0 }} />;
}

const IS = { // inputStyle factory
  base: { width: '100%', padding: '9px 12px', border: '1.5px solid var(--border)', borderRadius: 8, fontSize: 14, background: 'var(--bg)', color: 'var(--text)', outline: 'none', transition: 'border-color 0.15s' },
  sm: { padding: '7px 10px', fontSize: 13 },
};
const inputStyle = IS.base;
const focusInput = e => e.target.style.borderColor = 'var(--accent)';
const blurInput = e => e.target.style.borderColor = 'var(--border)';

function Field({ label, children, hint, half }) {
  return (
    <div style={{ marginBottom: 14, ...(half ? { flex: 1, minWidth: 0 } : {}) }}>
      <label style={{ display: 'block', fontWeight: 500, fontSize: 11, color: 'var(--text-muted)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</label>
      {children}
      {hint && <p style={{ fontSize: 11, color: 'var(--text-light)', marginTop: 3 }}>{hint}</p>}
    </div>
  );
}

// ── QuantityInput — numeric stepper + free text label, both optional ────────
// Stores two values: quantityNum (number|null) and quantityText (string)
// Displayed together as e.g. "3 bags" or just "500ml" or just "3"
function QuantityInput({ quantityNum, quantityText, onChangeNum, onChangeText, small }) {
  const sz = small ? { padding: '7px 10px', fontSize: 13 } : {};
  const numVal = quantityNum != null ? quantityNum : '';

  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'stretch' }}>
      {/* Numeric stepper */}
      <div style={{ display: 'flex', border: '1.5px solid var(--border)', borderRadius: 8, overflow: 'hidden', background: 'var(--bg)', transition: 'border-color 0.15s', flexShrink: 0 }}
        onFocusCapture={e => e.currentTarget.style.borderColor = 'var(--accent)'}
        onBlurCapture={e => e.currentTarget.style.borderColor = 'var(--border)'}>
        <button type="button"
          onClick={() => {
            const n = parseFloat(numVal);
            onChangeNum(isNaN(n) || n <= 1 ? null : n - 1);
          }}
          style={{ padding: small ? '0 8px' : '0 10px', fontSize: 16, color: 'var(--text-muted)', background: 'var(--bg-subtle)', borderRight: '1px solid var(--border)', flexShrink: 0 }}>−</button>
        <input
          type="number"
          min="0"
          step="1"
          value={numVal}
          placeholder="qty"
          onChange={e => onChangeNum(e.target.value === '' ? null : parseFloat(e.target.value))}
          style={{ width: small ? 44 : 52, border: 'none', outline: 'none', background: 'transparent', color: 'var(--text)', textAlign: 'center', fontFamily: 'inherit', fontWeight: 600, minWidth: 0, ...sz, fontSize: small ? 13 : 14 }}
        />
        <button type="button"
          onClick={() => {
            const n = parseFloat(numVal);
            onChangeNum(isNaN(n) ? 1 : n + 1);
          }}
          style={{ padding: small ? '0 8px' : '0 10px', fontSize: 16, color: 'var(--text-muted)', background: 'var(--bg-subtle)', borderLeft: '1px solid var(--border)', flexShrink: 0 }}>+</button>
      </div>
      {/* Free text label */}
      <input
        type="text"
        value={quantityText}
        onChange={e => onChangeText(e.target.value)}
        placeholder="unit / note"
        style={{ ...IS.base, ...sz, flex: 1, minWidth: 0 }}
        onFocus={focusInput} onBlur={blurInput}
      />
    </div>
  );
}

// Helper: format quantity for display
function fmtQty(num, text) {
  if (num != null && text) return `${num} ${text}`;
  if (num != null) return String(num);
  if (text) return text;
  return null;
}

// ── EmojiSelect ───────────────────────────────────────────────────────────
// Custom select that shows emoji + name in a styled dropdown.
// Keyboard nav: each letter press jumps to the next matching item (fresh match,
// no accumulation), cycling from current position. Arrow keys, Enter, Escape, Tab all work.
function EmojiSelect({ items, value, onChange, placeholder = '— None —', half }) {
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const containerRef = useRef(null);
  const listRef = useRef(null);

  const selected = items.find(i => String(i.id) === String(value)) || null;

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = e => { if (!containerRef.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Scroll highlighted item into view when open
  useEffect(() => {
    if (!open || !listRef.current) return;
    const highlighted = listRef.current.querySelector('[data-highlighted="true"]');
    if (highlighted) highlighted.scrollIntoView({ block: 'nearest' });
  }, [open, value]);

  const selectItem = (id) => { onChange(String(id)); setOpen(false); containerRef.current?.focus(); };
  const clearItem = () => { onChange(''); setOpen(false); containerRef.current?.focus(); };

  const handleKeyDown = e => {
    if (e.key === 'Escape') { setOpen(false); return; }
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(o => !o); return; }
    if (e.key === 'Tab') { setOpen(false); return; }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!open) { setOpen(true); return; }
      const idx = items.findIndex(i => String(i.id) === String(value));
      const next = items[idx + 1] || items[0];
      onChange(String(next.id));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!open) { setOpen(true); return; }
      const idx = items.findIndex(i => String(i.id) === String(value));
      const prev = items[idx - 1] || items[items.length - 1];
      onChange(String(prev.id));
      return;
    }

    // Letter key: find next item whose name starts with letter, cycling from current
    if (/^[a-zA-Z]$/.test(e.key)) {
      e.preventDefault();
      if (!open) setOpen(true);
      const letter = e.key.toLowerCase();
      const curIdx = items.findIndex(i => String(i.id) === String(value));
      const after = [...items.slice(curIdx + 1), ...items.slice(0, curIdx + 1)];
      const match = after.find(i => i.name.toLowerCase().startsWith(letter));
      if (match) onChange(String(match.id));
    }
  };

  const triggerStyle = {
    ...IS.base,
    display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer',
    userSelect: 'none', position: 'relative',
    borderColor: focused ? 'var(--accent)' : 'var(--border)',
  };

  return (
    <div ref={containerRef} tabIndex={0} onKeyDown={handleKeyDown}
      onFocus={() => setFocused(true)} onBlur={e => { if (!containerRef.current?.contains(e.relatedTarget)) { setFocused(false); setOpen(false); } }}
      style={{ position: 'relative', outline: 'none', ...(half ? { flex: 1, minWidth: 0 } : { width: '100%' }) }}>
      {/* Trigger */}
      <div onClick={() => setOpen(o => !o)} style={triggerStyle}>
        {selected ? (
          <>
            <span style={{ fontSize: 16, lineHeight: 1, flexShrink: 0 }}>{selected.icon}</span>
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selected.name}</span>
          </>
        ) : (
          <span style={{ flex: 1, color: 'var(--text-muted)' }}>{placeholder}</span>
        )}
        <span style={{ fontSize: 10, color: 'var(--text-light)', flexShrink: 0, transition: 'transform 0.15s', transform: open ? 'rotate(180deg)' : 'none' }}>▼</span>
      </div>

      {/* Dropdown */}
      {open && (
        <div ref={listRef} style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 3000,
          background: 'var(--bg-card)', border: '1.5px solid var(--accent)', borderRadius: 9,
          boxShadow: 'var(--shadow-lg)', maxHeight: 320, overflowY: 'auto',
          animation: 'fadeIn 0.12s ease',
        }}>
          {/* None option */}
          <div onClick={clearItem} data-highlighted={!value}
            style={{ display: 'flex', alignItems: 'center', padding: '8px 12px', cursor: 'pointer', fontSize: 13, // padding: '5px 10px' is tighter
              color: !value ? 'var(--accent)' : 'var(--text-muted)',
              background: !value ? 'var(--accent-light)' : 'transparent', fontStyle: 'italic',
              borderBottom: '1px solid var(--border)',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-subtle)'}
            onMouseLeave={e => e.currentTarget.style.background = !value ? 'var(--accent-light)' : 'transparent'}>
            {placeholder}
          </div>
          {items.map(item => {
            const isSelected = String(item.id) === String(value);
            return (
              <div key={item.id} onClick={() => selectItem(item.id)} data-highlighted={isSelected}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 10px', cursor: 'pointer',
                  background: isSelected ? 'var(--accent-light)' : 'transparent',
                  color: isSelected ? 'var(--accent)' : 'var(--text)',
                  fontWeight: isSelected ? 600 : 400,
                }}
                onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'var(--bg-subtle)'; }}
                onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}>
                <span style={{ fontSize: 18, lineHeight: 1, flexShrink: 0 }}>{item.icon}</span> 
                <span style={{ flex: 1, fontSize: 14 }}>{item.name}</span> 
                {isSelected && <span style={{ fontSize: 12, color: 'var(--accent)' }}>✓</span>}
              </div>
			  // in the above spans
			  // emoji size -- item.icon, fontSize: 15 for smaller
			  // text size -- item.name, fontSize: 13 for smaller
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── ConfirmDialog ─────────────────────────────────────────────────────────
// A small in-app confirmation dialog — replaces window.confirm everywhere.
// Usage: <ConfirmDialog message="..." onConfirm={fn} onCancel={fn} confirmLabel="Delete" danger />
function ConfirmDialog({ message, detail, onConfirm, onCancel, confirmLabel = 'Confirm', danger = true }) {
  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onCancel(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onCancel]);

  return ReactDOM.createPortal(
    <div onClick={onCancel}
      style={{ position: 'fixed', inset: 0, background: 'var(--overlay)', backdropFilter: 'blur(3px)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div onClick={e => e.stopPropagation()}
        style={{ background: 'var(--bg-card)', borderRadius: 14, boxShadow: 'var(--shadow-lg)', width: '100%', maxWidth: 380, padding: '24px 24px 20px', border: `1px solid ${danger ? 'var(--red-text)' : 'var(--border)'}`, animation: 'fadeIn 0.15s ease' }}>
        <div style={{ fontSize: 28, marginBottom: 10, textAlign: 'center' }}>{danger ? '🗑️' : '❓'}</div>
        <p style={{ fontWeight: 600, fontSize: 15, textAlign: 'center', marginBottom: detail ? 6 : 18, lineHeight: 1.4 }}>{message}</p>
        {detail && <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', marginBottom: 18, lineHeight: 1.5 }}>{detail}</p>}
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onCancel}
            style={{ flex: 1, padding: '10px', borderRadius: 9, border: '1.5px solid var(--border)', color: 'var(--text-muted)', background: 'var(--bg-subtle)', fontWeight: 500, fontSize: 14 }}>
            Cancel
          </button>
          <button onClick={onConfirm} autoFocus
            style={{ flex: 1, padding: '10px', borderRadius: 9, background: danger ? 'var(--red-text)' : 'var(--accent)', color: '#fff', fontWeight: 600, fontSize: 14, border: 'none' }}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// A hook to imperatively trigger a ConfirmDialog and await the result.
// Returns [confirmFn, dialogElement]
// Usage: const [confirm, ConfirmUI] = useConfirm();
//        const yes = await confirm({ message: '...' });
function useConfirm() {
  const [state, setState] = useState(null); // {message, detail, confirmLabel, danger, resolve}
  const confirm = useCallback((opts) => new Promise(resolve => {
    setState({ ...opts, resolve });
  }), []);
  const handleConfirm = () => { state.resolve(true); setState(null); };
  const handleCancel = () => { state.resolve(false); setState(null); };
  const dialog = state ? (
    <ConfirmDialog
      message={state.message}
      detail={state.detail}
      confirmLabel={state.confirmLabel || 'Confirm'}
      danger={state.danger !== false}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
    />
  ) : null;
  return [confirm, dialog];
}

// ── Modal — full-screen on mobile ─────────────────────────────────────────
function Modal({ title, onClose, children, wide }) {
  const isMobile = useIsMobile();
  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', h); document.body.style.overflow = ''; };
  }, [onClose]);

  const sheetStyle = isMobile ? {
    position: 'fixed', inset: 0, background: 'var(--bg-card)', display: 'flex', flexDirection: 'column',
    animation: 'slideUp 0.25s ease',
  } : {
    background: 'var(--bg-card)', borderRadius: 16, boxShadow: 'var(--shadow-lg)',
    width: '100%', maxWidth: wide ? 700 : 520, maxHeight: '90vh', overflowY: 'auto',
    animation: 'fadeIn 0.2s ease', border: '1px solid var(--border)',
  };

  return ReactDOM.createPortal(
    <div onClick={isMobile ? undefined : onClose}
      style={{ position: 'fixed', inset: 0, background: isMobile ? 'transparent' : 'var(--overlay)', backdropFilter: isMobile ? 'none' : 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: isMobile ? 'stretch' : 'center', justifyContent: 'center', padding: isMobile ? 0 : 16 }}>
      <div onClick={e => e.stopPropagation()} style={sheetStyle}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0, background: 'var(--bg-card)', ...(isMobile ? {} : { position: 'sticky', top: 0, zIndex: 1, borderRadius: '16px 16px 0 0' }) }}>
          <h2 style={{ fontFamily: 'Fraunces, Georgia, serif', fontWeight: 600, fontSize: isMobile ? 18 : 20 }}>{title}</h2>
          <button onClick={onClose} style={{ width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-subtle)', color: 'var(--text-muted)', fontSize: 20, flexShrink: 0 }}>×</button>
        </div>
        <div style={{ padding: '18px 20px 32px', ...(isMobile ? { flex: 1, overflowY: 'auto' } : {}) }}>
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}

// ── Badges ────────────────────────────────────────────────────────────────
function Badge({ icon, name, color }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 500, background: color + '22', color, border: `1px solid ${color}35`, whiteSpace: 'nowrap' }}>
      {icon} {name}
    </span>
  );
}

// ── Logo ──────────────────────────────────────────────────────────────────
function HomeLarderLogo({ size = 32 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="16" y="26" width="32" height="28" rx="5" fill="#c85a2a" opacity="0.9"/>
      <rect x="13" y="20" width="38" height="9" rx="4" fill="#a84820"/>
      <rect x="13" y="25" width="38" height="4" rx="0" fill="#8a3a18" opacity="0.5"/>
      <rect x="20" y="31" width="24" height="18" rx="3" fill="#e8784a" opacity="0.5"/>
      <rect x="22" y="33" width="6" height="12" rx="3" fill="white" opacity="0.18"/>
      <path d="M10 24 L32 8 L54 24" stroke="#faf7f2" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.85"/>
    </svg>
  );
}

// ── SimilarSuggestions ────────────────────────────────────────────────────
function SimilarSuggestions({ items, onSelect }) {
  if (!items.length) return null;
  return (
    <div style={{ border: '1.5px solid var(--accent)', borderRadius: 10, background: 'var(--accent-light)', padding: 12, marginBottom: 14 }}>
      <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)', marginBottom: 8 }}>🔍 Similar items — add to one instead?</p>
      {items.map(item => (
        <button key={item.id} onClick={() => onSelect(item)}
          style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '8px 10px', borderRadius: 8, background: 'var(--bg-card)', border: '1px solid var(--border)', marginBottom: 6, cursor: 'pointer', textAlign: 'left', transition: 'background 0.1s' }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-subtle)'}
          onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-card)'}>
          <span style={{ fontSize: 20 }}>{item.category_icon || '📦'}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 14 }}>{item.name}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {item.location_name ? `${item.location_icon} ${item.location_name}` : item.category_name ? '' : 'Unassigned'} · {item.sub_entry_count} entr{item.sub_entry_count === 1 ? 'y' : 'ies'}
            </div>
          </div>
          <span style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600, flexShrink: 0 }}>+ Add →</span>
        </button>
      ))}
    </div>
  );
}

// ── AddItemModal ──────────────────────────────────────────────────────────
function AddItemModal({ categories, locations, onClose, onSaved, prefillItem, defaultLocationId, defaultCategoryId }) {
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState(String(defaultCategoryId || ''));
  const [locationId, setLocationId] = useState(String(defaultLocationId || ''));
  const [notes, setNotes] = useState('');
  const [itemQtyNum, setItemQtyNum] = useState(null);
  const [itemQtyText, setItemQtyText] = useState('');
  const [dateAdded, setDateAdded] = useState(TODAY);
  const [similar, setSimilar] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [mode, setMode] = useState('new');
  const [targetItem, setTargetItem] = useState(null);
  const [subDesc, setSubDesc] = useState('');
  const [subQtyNum, setSubQtyNum] = useState(null);
  const [subQtyText, setSubQtyText] = useState('');
  const searchTimer = useRef(null);

  useEffect(() => { if (prefillItem) { setTargetItem(prefillItem); setMode('sub-entry'); } }, [prefillItem]);

  const handleNameChange = val => {
    setName(val);
    clearTimeout(searchTimer.current);
    if (val.length < 2) { setSimilar([]); return; }
    searchTimer.current = setTimeout(async () => {
      try { setSimilar(await api(`/api/items/similar?name=${encodeURIComponent(val)}`)); } catch {}
    }, 350);
  };


  const handleSave = async () => {
    setSaving(true); setError('');
    try {
      if (mode === 'sub-entry' && targetItem) {
        if (!subDesc.trim()) { setError('Description is required'); setSaving(false); return; }
        await api(`/api/items/${targetItem.id}/sub-entries`, { method: 'POST', body: { description: subDesc, quantity: subQtyText, quantity_num: subQtyNum, date_added: dateAdded } });
      } else {
        if (!name.trim()) { setError('Name is required'); setSaving(false); return; }
        await api('/api/items', { method: 'POST', body: { name: name.trim(), category_id: categoryId || null, location_id: locationId || null, notes, quantity: itemQtyText, quantity_num: itemQtyNum, date_added: dateAdded } });
      }
      onSaved(); onClose();
    } catch (e) { setError(e.message); }
    setSaving(false);
  };



  return (
    <Modal title={mode === 'sub-entry' ? `Add to: ${targetItem?.name}` : 'Add Item'} onClose={onClose}>
      {mode === 'sub-entry' && targetItem ? (
        <>
          <div style={{ background: 'var(--bg-subtle)', borderRadius: 10, padding: 12, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 24 }}>{targetItem.category_icon || '📦'}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600 }}>{targetItem.name}</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{targetItem.location_name ? `${targetItem.location_icon} ${targetItem.location_name}` : targetItem.category_name || 'No location/category'}</div>
            </div>
            <button onClick={() => { setMode('new'); setTargetItem(null); }} style={{ fontSize: 13, color: 'var(--accent)', fontWeight: 600, whiteSpace: 'nowrap' }}>Change</button>
          </div>
          <Field label="Description" hint="e.g. breast 250g, thigh 400g cut up">
            <input style={inputStyle} value={subDesc} onChange={e => setSubDesc(e.target.value)} placeholder="e.g. breast 250g" autoFocus onFocus={focusInput} onBlur={blurInput} />
          </Field>
          <Field label="Quantity (optional)">
            <QuantityInput quantityNum={subQtyNum} quantityText={subQtyText} onChangeNum={setSubQtyNum} onChangeText={setSubQtyText} />
          </Field>
        </>
      ) : (
        <>
          <Field label="Item name">
            <input style={inputStyle} value={name} onChange={e => handleNameChange(e.target.value)} placeholder="e.g. Chicken, Leftover pasta, Cumin…" autoFocus onFocus={focusInput} onBlur={blurInput} />
          </Field>
          <SimilarSuggestions items={similar} onSelect={item => { setTargetItem(item); setMode('sub-entry'); setSimilar([]); }} />
          <div style={{ display: 'flex', gap: 10 }}>
            <Field label="Location" half>
              <EmojiSelect items={locations} value={locationId} onChange={setLocationId} half />
            </Field>
            <Field label="Category" half>
              <EmojiSelect items={categories} value={categoryId} onChange={setCategoryId} half />
            </Field>
          </div>
          <Field label="Notes (optional)">
            <input style={inputStyle} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any notes…" onFocus={focusInput} onBlur={blurInput} />
          </Field>
          <Field label="Quantity (optional)" hint="e.g. 1x serve, 2 portions — use sub-entries for multiple cuts/portions">
            <QuantityInput quantityNum={itemQtyNum} quantityText={itemQtyText} onChangeNum={setItemQtyNum} onChangeText={setItemQtyText} />
          </Field>
        </>
      )}
      <Field label="Date added">
        <input type="date" style={inputStyle} value={dateAdded} onChange={e => setDateAdded(e.target.value)} onFocus={focusInput} onBlur={blurInput} />
      </Field>
      {error && <p style={{ color: 'var(--red-text)', fontSize: 13, marginBottom: 12, fontWeight: 500 }}>⚠ {error}</p>}
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
        <button onClick={onClose} style={{ flex: 1, padding: '11px 18px', borderRadius: 9, border: '1.5px solid var(--border)', color: 'var(--text-muted)', background: 'var(--bg-subtle)', fontWeight: 500 }}>Cancel</button>
        <button onClick={handleSave} disabled={saving} style={{ flex: 2, padding: '11px 20px', borderRadius: 9, background: 'var(--accent)', color: '#fff', fontWeight: 600, opacity: saving ? 0.7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          {saving && <Spinner />} {mode === 'sub-entry' ? 'Add Entry' : 'Add Item'}
        </button>
      </div>
    </Modal>
  );
}

// ── EditItemModal ─────────────────────────────────────────────────────────
function EditItemModal({ item, categories, locations, onClose, onSaved }) {
  const [name, setName] = useState(item.name);
  const [categoryId, setCategoryId] = useState(String(item.category_id || ''));
  const [locationId, setLocationId] = useState(String(item.location_id || ''));
  const [notes, setNotes] = useState(item.notes || '');
  const [itemQtyNum, setItemQtyNum] = useState(item.quantity_num ?? null);
  const [itemQtyText, setItemQtyText] = useState(item.quantity || '');
  const [dateAdded, setDateAdded] = useState(item.date_added);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    setSaving(true); setError('');
    try {
      await api(`/api/items/${item.id}`, { method: 'PUT', body: { name, category_id: categoryId || null, location_id: locationId || null, notes, quantity: itemQtyText, quantity_num: itemQtyNum, date_added: dateAdded } });
      onSaved(); onClose();
    } catch (e) { setError(e.message); }
    setSaving(false);
  };

  return (
    <Modal title="Edit Item" onClose={onClose}>
      <Field label="Item name">
        <input style={inputStyle} value={name} onChange={e => setName(e.target.value)} onFocus={focusInput} onBlur={blurInput} />
      </Field>
      <div style={{ display: 'flex', gap: 10 }}>
        <Field label="Location" half>
          <EmojiSelect items={locations} value={locationId} onChange={setLocationId} half />
        </Field>
        <Field label="Category" half>
          <EmojiSelect items={categories} value={categoryId} onChange={setCategoryId} half />
        </Field>
      </div>
      <Field label="Notes (optional)">
        <input style={inputStyle} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any notes…" onFocus={focusInput} onBlur={blurInput} />
      </Field>
      <Field label="Quantity (optional)" hint="e.g. 1x serve, 2 portions">
        <QuantityInput quantityNum={itemQtyNum} quantityText={itemQtyText} onChangeNum={setItemQtyNum} onChangeText={setItemQtyText} />
      </Field>
      <Field label="Date added">
        <input type="date" style={inputStyle} value={dateAdded} onChange={e => setDateAdded(e.target.value)} />
      </Field>
      {error && <p style={{ color: 'var(--red-text)', fontSize: 13, marginBottom: 12 }}>⚠ {error}</p>}
      <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
        <button onClick={onClose} style={{ flex: 1, padding: '11px', borderRadius: 9, border: '1.5px solid var(--border)', color: 'var(--text-muted)', background: 'var(--bg-subtle)', fontWeight: 500 }}>Cancel</button>
        <button onClick={handleSave} disabled={saving} style={{ flex: 2, padding: '11px', borderRadius: 9, background: 'var(--accent)', color: '#fff', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          {saving ? <Spinner /> : 'Save Changes'}
        </button>
      </div>
    </Modal>
  );
}

// ── SubEntryRow ───────────────────────────────────────────────────────────
// onStepNum(entry, newNum) — called when +/- tapped inline; parent decides if delete needed
function SubEntryRow({ entry, onDelete, onUpdate, onStepNum, compact }) {
  const [editing, setEditing] = useState(false);
  const [desc, setDesc] = useState(entry.description);
  const [qtyNum, setQtyNum] = useState(entry.quantity_num ?? null);
  const [qtyText, setQtyText] = useState(entry.quantity || '');
  const [date, setDate] = useState(entry.date_added);
  const [saving, setSaving] = useState(false);

  // Keep local state in sync if entry prop changes (e.g. after a step save)
  useEffect(() => {
    setQtyNum(entry.quantity_num ?? null);
    setQtyText(entry.quantity || '');
    setDesc(entry.description);
    setDate(entry.date_added);
  }, [entry.quantity_num, entry.quantity, entry.description, entry.date_added]);

  const handleSave = async () => {
    setSaving(true);
    await onUpdate(entry.id, { description: desc, quantity: qtyText, quantity_num: qtyNum, date_added: date });
    setEditing(false); setSaving(false);
  };

  const handleStep = delta => {
    const current = entry.quantity_num ?? 0;
    const next = Math.max(0, current + delta);
    onStepNum(entry, next);
  };

  // Inline stepper — only shown when entry has a numeric quantity
  const hasNum = entry.quantity_num != null;
  const InlineStepper = hasNum ? (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden', flexShrink: 0 }}>
      <button onClick={() => handleStep(-1)}
        style={{ padding: compact ? '1px 7px' : '2px 8px', fontSize: 15, color: 'var(--text-muted)', background: 'var(--bg-subtle)', borderRight: '1px solid var(--border)', lineHeight: 1 }}>−</button>
      <span style={{ padding: compact ? '1px 7px' : '2px 8px', fontSize: compact ? 12 : 13, fontWeight: 600, minWidth: 24, textAlign: 'center', background: 'var(--bg)' }}>
        {entry.quantity_num}
      </span>
      <button onClick={() => handleStep(1)}
        style={{ padding: compact ? '1px 7px' : '2px 8px', fontSize: 15, color: 'var(--text-muted)', background: 'var(--bg-subtle)', borderLeft: '1px solid var(--border)', lineHeight: 1 }}>+</button>
    </div>
  ) : null;

  if (editing) {
    return (
      <>
        <Modal title="Edit Sub-entry" onClose={() => setEditing(false)}>
          <Field label="Description">
            <input style={inputStyle} value={desc} onChange={e => setDesc(e.target.value)} autoFocus onFocus={focusInput} onBlur={blurInput} />
          </Field>
          <Field label="Quantity">
            <QuantityInput quantityNum={qtyNum} quantityText={qtyText} onChangeNum={setQtyNum} onChangeText={setQtyText} />
          </Field>
          <Field label="Date added">
            <input type="date" style={inputStyle} value={date} onChange={e => setDate(e.target.value)} />
          </Field>
          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <button onClick={() => setEditing(false)} style={{ flex: 1, padding: '11px', borderRadius: 9, border: '1.5px solid var(--border)', color: 'var(--text-muted)', background: 'var(--bg-subtle)', fontWeight: 500 }}>Cancel</button>
            <button onClick={handleSave} disabled={saving} style={{ flex: 2, padding: '11px', borderRadius: 9, background: 'var(--accent)', color: '#fff', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              {saving && <Spinner />} Save Changes
            </button>
          </div>
        </Modal>
        {compact
          ? <tr><td colSpan={5} style={{ padding: 0 }} /></tr>
          : <div style={{ marginBottom: 5 }} />}
      </>
    );
  }

  if (compact) {
    return (
      <tr>
        <td style={{ padding: '5px 8px 5px 16px', fontSize: 13, color: 'var(--text-muted)', width: 16 }}>↳</td>
        <td style={{ padding: '5px 8px', fontSize: 14, fontWeight: 500 }}>{entry.description}</td>
        <td style={{ padding: '4px 8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {InlineStepper}
            {entry.quantity && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{entry.quantity}</span>}
            {!hasNum && !entry.quantity && <span style={{ fontSize: 12, color: 'var(--text-light)' }}>—</span>}
          </div>
        </td>
        <td style={{ padding: '5px 8px', fontSize: 12, color: 'var(--text-light)', whiteSpace: 'nowrap' }}>{entry.date_added}</td>
        <td style={{ padding: '5px 8px 5px 4px', whiteSpace: 'nowrap' }}>
          <button onClick={() => setEditing(true)} style={{ padding: '2px 7px', borderRadius: 4, border: '1px solid var(--border)', fontSize: 11, color: 'var(--text-muted)', marginRight: 4 }}>Edit</button>
          <button onClick={() => onDelete(entry.id)} style={{ padding: '2px 7px', borderRadius: 4, background: 'var(--red-bg)', color: 'var(--red-text)', fontSize: 11 }}>✕</button>
        </td>
      </tr>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 8, background: 'var(--bg-subtle)', marginBottom: 5, border: '1px solid var(--border)' }}>
      <span style={{ fontSize: 12, color: 'var(--text-muted)', flexShrink: 0 }}>↳</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{ fontWeight: 500, fontSize: 14 }}>{entry.description}</span>
        {entry.quantity && <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 6 }}>{entry.quantity}</span>}
      </div>
      {InlineStepper}
      <span style={{ fontSize: 11, color: 'var(--text-light)', whiteSpace: 'nowrap', flexShrink: 0 }}>{entry.date_added}</span>
      <button onClick={() => setEditing(true)} style={{ padding: '3px 8px', borderRadius: 5, border: '1px solid var(--border)', fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap', flexShrink: 0 }}>Edit</button>
      <button onClick={() => onDelete(entry.id)} style={{ padding: '3px 8px', borderRadius: 5, background: 'var(--red-bg)', color: 'var(--red-text)', fontSize: 12, flexShrink: 0 }}>✕</button>
    </div>
  );
}

function AddSubEntryInline({ itemId, onAdded }) {
  const [desc, setDesc] = useState('');
  const [qtyNum, setQtyNum] = useState(null);
  const [qtyText, setQtyText] = useState('');
  const [date, setDate] = useState(TODAY);
  const [saving, setSaving] = useState(false);

  const handleAdd = async () => {
    if (!desc.trim()) return;
    setSaving(true);
    await api(`/api/items/${itemId}/sub-entries`, { method: 'POST', body: { description: desc, quantity: qtyText, quantity_num: qtyNum, date_added: date } });
    setDesc(''); setQtyNum(null); setQtyText(''); setDate(TODAY);
    onAdded(); setSaving(false);
  };

  return (
    <div style={{ marginTop: 8, padding: 10, background: 'var(--green-light)', borderRadius: 8, border: '1px solid var(--green)', borderOpacity: 0.3 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--green)', marginBottom: 8 }}>+ New sub-entry</div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <input style={{ ...inputStyle, ...IS.sm, flex: 2 }} value={desc} onChange={e => setDesc(e.target.value)} placeholder="Description" onFocus={e => e.target.style.borderColor = 'var(--green)'} onBlur={blurInput} />
        <QuantityInput quantityNum={qtyNum} quantityText={qtyText} onChangeNum={setQtyNum} onChangeText={setQtyText} small />
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input type="date" style={{ ...inputStyle, ...IS.sm, flex: 1 }} value={date} onChange={e => setDate(e.target.value)} />
        <button onClick={handleAdd} disabled={saving || !desc.trim()} style={{ padding: '7px 16px', borderRadius: 7, background: 'var(--green)', color: '#fff', fontWeight: 600, fontSize: 13, opacity: !desc.trim() ? 0.5 : 1, whiteSpace: 'nowrap' }}>
          {saving ? '…' : 'Add'}
        </button>
      </div>
    </div>
  );
}

// ── ItemCard ──────────────────────────────────────────────────────────────
function ItemCard({ item, categories, locations, onRefresh, onAddSubEntry, alwaysExpanded }) {
  const [expanded, setExpanded] = useState(false);
  const [subEntries, setSubEntries] = useState([]);
  const [loadingSubs, setLoadingSubs] = useState(false);
  const [showAddSub, setShowAddSub] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirm, ConfirmUI] = useConfirm();

  const loadSubs = useCallback(async () => {
    setLoadingSubs(true);
    setSubEntries(await api(`/api/items/${item.id}/sub-entries`));
    setLoadingSubs(false);
  }, [item.id]);

  const isExpanded = alwaysExpanded || expanded;
  useEffect(() => { if (isExpanded) loadSubs(); }, [isExpanded]); // eslint-disable-line

  const handleDeleteSub = async id => {
    await api(`/api/sub-entries/${id}`, { method: 'DELETE' });
    const remaining = subEntries.filter(e => e.id !== id);
    setSubEntries(remaining);
    if (remaining.length === 0) {
      const yes = await confirm({ message: `Delete "${item.name}"?`, detail: 'All sub-entries have been removed.', confirmLabel: 'Delete item' });
      if (yes) {
        await api(`/api/items/${item.id}`, { method: 'DELETE' });
      }
      onRefresh();
    } else {
      onRefresh();
    }
  };
  const handleUpdateSub = async (id, data) => { await api(`/api/sub-entries/${id}`, { method: 'PUT', body: data }); loadSubs(); };
  const handleDeleteItem = async () => {
    const yes = await confirm({ message: `Delete "${item.name}"?`, detail: 'This will remove the item and all its sub-entries.', confirmLabel: 'Delete' });
    if (yes) { await api(`/api/items/${item.id}`, { method: 'DELETE' }); onRefresh(); }
  };
  const handleStepItemNum = async delta => {
    const current = item.quantity_num ?? 0;
    const next = Math.max(0, current + delta);
    if (next === 0) {
      const yes = await confirm({ message: `Delete "${item.name}"?`, detail: 'Quantity reached 0.', confirmLabel: 'Delete' });
      if (yes) { await api(`/api/items/${item.id}`, { method: 'DELETE' }); onRefresh(); return; }
    }
    await api(`/api/items/${item.id}`, { method: 'PUT', body: { name: item.name, category_id: item.category_id, location_id: item.location_id, notes: item.notes, quantity: item.quantity, quantity_num: next, date_added: item.date_added } });
    onRefresh();
  };
  const handleStepNum = async (entry, newNum) => {
    if (newNum === 0) {
      const yes = await confirm({ message: `Delete "${entry.description}"?`, detail: 'Quantity reached 0.', confirmLabel: 'Delete' });
      if (yes) {
        await handleDeleteSub(entry.id);
      } else {
        await api(`/api/sub-entries/${entry.id}`, { method: 'PUT', body: { description: entry.description, quantity: entry.quantity, quantity_num: 0, date_added: entry.date_added } });
        loadSubs();
      }
    } else {
      await api(`/api/sub-entries/${entry.id}`, { method: 'PUT', body: { description: entry.description, quantity: entry.quantity, quantity_num: newNum, date_added: entry.date_added } });
      loadSubs();
    }
  };
  const subCount = item.sub_entry_count;

  return (
    <>
      {editing && <EditItemModal item={item} categories={categories} locations={locations} onClose={() => setEditing(false)} onSaved={onRefresh} />}
      {ConfirmUI}
      <div className="fade-in" style={{ background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border)', boxShadow: 'var(--shadow)', overflow: 'hidden', transition: 'box-shadow 0.15s' }}
        onMouseEnter={e => e.currentTarget.style.boxShadow = 'var(--shadow-hover)'}
        onMouseLeave={e => e.currentTarget.style.boxShadow = 'var(--shadow)'}>
        <div style={{ padding: '14px 14px 12px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <span style={{ fontSize: 24, lineHeight: 1, flexShrink: 0, marginTop: 2 }}>{item.category_icon || '📦'}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h3 style={{ fontFamily: 'Fraunces, Georgia, serif', fontWeight: 600, fontSize: 16, lineHeight: 1.25, marginBottom: 5 }}>{item.name}</h3>
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
                {item.category_name && <Badge icon="" name={item.category_name} color={item.category_color || '#6366f1'} />}
                {item.location_name
                  ? <Badge icon={item.location_icon || ''} name={item.location_name} color={item.location_color || '#6366f1'} />
                  : !item.category_name && <span style={{ fontSize: 11, color: 'var(--text-light)', fontStyle: 'italic' }}>Unassigned</span>}
              </div>
              <div style={{ marginTop: 4, fontSize: 12, color: 'var(--text-light)' }}>Added {item.date_added}</div>
              {(item.notes || item.quantity || item.quantity_num != null) && (
                <div style={{ marginTop: 4, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {item.notes && <span style={{ fontSize: 13, color: 'var(--text-muted)', background: 'var(--bg-subtle)', borderRadius: 6, padding: '3px 8px' }}>{item.notes}</span>}
                  {item.quantity_num != null ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 0, border: '1.5px solid var(--accent)', borderRadius: 7, overflow: 'hidden', background: 'var(--accent-light)' }}>
                      <button onClick={() => handleStepItemNum(-1)} style={{ padding: '2px 8px', fontSize: 15, color: 'var(--accent)', background: 'transparent', lineHeight: 1 }}>−</button>
                      <span style={{ padding: '2px 6px', fontSize: 13, fontWeight: 600, color: 'var(--accent)', background: 'transparent', minWidth: 20, textAlign: 'center' }}>
                        {item.quantity_num}{item.quantity ? ' ' + item.quantity : ''}
                      </span>
                      <button onClick={() => handleStepItemNum(1)} style={{ padding: '2px 8px', fontSize: 15, color: 'var(--accent)', background: 'transparent', lineHeight: 1 }}>+</button>
                    </div>
                  ) : item.quantity ? (
                    <span style={{ fontSize: 13, color: 'var(--accent)', background: 'var(--accent-light)', borderRadius: 6, padding: '3px 8px', fontWeight: 500 }}>{item.quantity}</span>
                  ) : null}
                </div>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <button onClick={() => onAddSubEntry(item)} style={{ padding: '5px 10px', borderRadius: 6, background: 'var(--green-light)', color: 'var(--green)', fontWeight: 600, fontSize: 12, border: '1px solid var(--green)', whiteSpace: 'nowrap' }}>+ Entry</button>
            <button onClick={() => setEditing(true)} style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: 12 }}>Edit</button>
            <button onClick={handleDeleteItem} style={{ padding: '5px 10px', borderRadius: 6, background: 'var(--red-bg)', color: 'var(--red-text)', fontSize: 12 }}>Delete</button>
            {subCount > 0 && !alwaysExpanded && (
              <button onClick={() => setExpanded(e => !e)} style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--accent)', fontWeight: 500, background: 'var(--accent-light)', padding: '5px 10px', borderRadius: 6 }}>
                <span style={{ transform: expanded ? 'rotate(90deg)' : 'rotate(0)', display: 'inline-block', transition: 'transform 0.2s', fontSize: 9 }}>▶</span>
                {subCount} entr{subCount === 1 ? 'y' : 'ies'}
              </button>
            )}
            {subCount > 0 && alwaysExpanded && (
              <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-light)' }}>{subCount} entr{subCount === 1 ? 'y' : 'ies'}</span>
            )}
          </div>
        </div>
        {isExpanded && (
          <div style={{ borderTop: '1px solid var(--border)', padding: '10px 14px 12px', background: 'var(--bg-subtle)' }}>
            {loadingSubs ? <div style={{ padding: 8 }}><Spinner /></div> : subEntries.map(e => (
              <SubEntryRow key={e.id} entry={e} onDelete={handleDeleteSub} onUpdate={handleUpdateSub} onStepNum={handleStepNum} />
            ))}
            {showAddSub
              ? <AddSubEntryInline itemId={item.id} onAdded={() => { loadSubs(); onRefresh(); setShowAddSub(false); }} />
              : <button onClick={() => setShowAddSub(true)} style={{ marginTop: 6, padding: '6px 14px', borderRadius: 7, border: '1.5px dashed var(--border-strong)', color: 'var(--text-muted)', fontSize: 13, width: '100%' }}>+ Add another sub-entry</button>}
          </div>
        )}
      </div>
    </>
  );
}

// ── ItemRow (horizontal/list view) ────────────────────────────────────────
function ItemRow({ item, categories, locations, onRefresh, onAddSubEntry }) {
  const [subEntries, setSubEntries] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [showAddSub, setShowAddSub] = useState(false);
  const [editing, setEditing] = useState(false);

  const load = useCallback(async () => {
    if (loaded) return;
    setSubEntries(await api(`/api/items/${item.id}/sub-entries`));
    setLoaded(true);
  }, [item.id, loaded]);

  useEffect(() => { load(); }, [load]);

  const [confirm, ConfirmUI] = useConfirm();
  const handleDeleteSub = async id => {
    await api(`/api/sub-entries/${id}`, { method: 'DELETE' });
    const remaining = subEntries.filter(e => e.id !== id);
    setSubEntries(remaining);
    if (remaining.length === 0) {
      const yes = await confirm({ message: `Delete "${item.name}"?`, detail: 'All sub-entries have been removed.', confirmLabel: 'Delete item' });
      if (yes) {
        await api(`/api/items/${item.id}`, { method: 'DELETE' });
      }
      onRefresh();
    } else {
      onRefresh();
    }
  };
  const handleUpdateSub = async (id, data) => { await api(`/api/sub-entries/${id}`, { method: 'PUT', body: data }); const r = await api(`/api/items/${item.id}/sub-entries`); setSubEntries(r); };
  const handleDeleteItem = async () => {
    const yes = await confirm({ message: `Delete "${item.name}"?`, detail: 'This will remove the item and all its sub-entries.', confirmLabel: 'Delete' });
    if (yes) { await api(`/api/items/${item.id}`, { method: 'DELETE' }); onRefresh(); }
  };
  const handleStepItemNum = async delta => {
    const current = item.quantity_num ?? 0;
    const next = Math.max(0, current + delta);
    if (next === 0) {
      const yes = await confirm({ message: `Delete "${item.name}"?`, detail: 'Quantity reached 0.', confirmLabel: 'Delete' });
      if (yes) { await api(`/api/items/${item.id}`, { method: 'DELETE' }); onRefresh(); return; }
    }
    await api(`/api/items/${item.id}`, { method: 'PUT', body: { name: item.name, category_id: item.category_id, location_id: item.location_id, notes: item.notes, quantity: item.quantity, quantity_num: next, date_added: item.date_added } });
    onRefresh();
  };
  const handleStepNum = async (entry, newNum) => {
    if (newNum === 0) {
      const yes = await confirm({ message: `Delete "${entry.description}"?`, detail: 'Quantity reached 0.', confirmLabel: 'Delete' });
      if (yes) {
        await handleDeleteSub(entry.id);
      } else {
        await api(`/api/sub-entries/${entry.id}`, { method: 'PUT', body: { description: entry.description, quantity: entry.quantity, quantity_num: 0, date_added: entry.date_added } });
        const r = await api(`/api/items/${item.id}/sub-entries`); setSubEntries(r);
      }
    } else {
      await api(`/api/sub-entries/${entry.id}`, { method: 'PUT', body: { description: entry.description, quantity: entry.quantity, quantity_num: newNum, date_added: entry.date_added } });
      const r = await api(`/api/items/${item.id}/sub-entries`); setSubEntries(r);
    }
  };

  return (
    <>
      {editing && <EditItemModal item={item} categories={categories} locations={locations} onClose={() => setEditing(false)} onSaved={onRefresh} />}
      {ConfirmUI}
      <div className="fade-in" style={{ background: 'var(--bg-card)', borderRadius: 10, border: '1px solid var(--border)', boxShadow: 'var(--shadow)', overflow: 'hidden', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', flexWrap: 'wrap', borderBottom: (subEntries.length > 0 || showAddSub) ? '1px solid var(--border)' : 'none' }}>
          <span style={{ fontSize: 22, flexShrink: 0 }}>{item.category_icon || '📦'}</span>
          <div style={{ minWidth: 130, flex: '0 1 180px' }}>
            <div style={{ fontFamily: 'Fraunces, Georgia, serif', fontWeight: 600, fontSize: 15 }}>{item.name}</div>
            <div style={{ fontSize: 11, color: 'var(--text-light)' }}>Added {item.date_added}</div>
          </div>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', flex: '1 1 auto' }}>
            {item.category_name && <Badge icon="" name={item.category_name} color={item.category_color || '#6366f1'} />}
            {item.location_name && <Badge icon={item.location_icon || ''} name={item.location_name} color={item.location_color || '#6366f1'} />}
            {item.notes && <span style={{ fontSize: 13, color: 'var(--text-muted)', background: 'var(--bg-subtle)', borderRadius: 6, padding: '2px 8px' }}>{item.notes}</span>}
            {item.quantity_num != null ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 0, border: '1.5px solid var(--accent)', borderRadius: 7, overflow: 'hidden', background: 'var(--accent-light)' }}>
                <button onClick={() => handleStepItemNum(-1)} style={{ padding: '1px 7px', fontSize: 14, color: 'var(--accent)', background: 'transparent', lineHeight: 1 }}>−</button>
                <span style={{ padding: '1px 6px', fontSize: 12, fontWeight: 600, color: 'var(--accent)', minWidth: 18, textAlign: 'center' }}>
                  {item.quantity_num}{item.quantity ? ' ' + item.quantity : ''}
                </span>
                <button onClick={() => handleStepItemNum(1)} style={{ padding: '1px 7px', fontSize: 14, color: 'var(--accent)', background: 'transparent', lineHeight: 1 }}>+</button>
              </div>
            ) : item.quantity ? (
              <span style={{ fontSize: 13, color: 'var(--accent)', background: 'var(--accent-light)', borderRadius: 6, padding: '2px 8px', fontWeight: 500 }}>{item.quantity}</span>
            ) : null}
          </div>
          <div style={{ display: 'flex', gap: 5, flexShrink: 0, marginLeft: 'auto', flexWrap: 'wrap' }}>
            <button onClick={() => onAddSubEntry(item)} style={{ padding: '4px 9px', borderRadius: 6, background: 'var(--green-light)', color: 'var(--green)', fontWeight: 600, fontSize: 12, border: '1px solid var(--green)', whiteSpace: 'nowrap' }}>+ Entry</button>
            <button onClick={() => setEditing(true)} style={{ padding: '4px 9px', borderRadius: 6, border: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: 12 }}>Edit</button>
            <button onClick={handleDeleteItem} style={{ padding: '4px 9px', borderRadius: 6, background: 'var(--red-bg)', color: 'var(--red-text)', fontSize: 12 }}>Delete</button>
          </div>
        </div>
        {subEntries.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 400 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-subtle)' }}>
                  <th style={{ width: 16 }}></th>
                  <th style={{ padding: '4px 8px', fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'left' }}>Description</th>
                  <th style={{ padding: '4px 8px', fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'left', width: 110 }}>Qty</th>
                  <th style={{ padding: '4px 8px', fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'left', width: 100 }}>Date</th>
                  <th style={{ width: 110 }}></th>
                </tr>
              </thead>
              <tbody>
                {subEntries.map(e => <SubEntryRow key={e.id} entry={e} onDelete={handleDeleteSub} onUpdate={handleUpdateSub} onStepNum={handleStepNum} compact />)}
              </tbody>
            </table>
          </div>
        )}
        <div style={{ padding: '6px 14px 8px', background: 'var(--bg-subtle)' }}>
          {showAddSub
            ? <AddSubEntryInline itemId={item.id} onAdded={async () => { const r = await api(`/api/items/${item.id}/sub-entries`); setSubEntries(r); onRefresh(); setShowAddSub(false); }} />
            : <button onClick={() => setShowAddSub(true)} style={{ padding: '4px 12px', borderRadius: 6, border: '1.5px dashed var(--border-strong)', color: 'var(--text-muted)', fontSize: 12 }}>+ Add sub-entry</button>}
        </div>
      </div>
    </>
  );
}

// ── Tab preset manager ────────────────────────────────────────────────────
// ── DraggableTabList — reorderable list of selected tabs ──────────────────
function DraggableTabList({ tabs, locations, categories, onReorder, onRemove }) {
  const dragIdx = useRef(null);
  const [dragOver, setDragOver] = useState(null);
  const isMobile = useIsMobile();

  const resolve = key => {
    if (key.startsWith('loc:')) { const l = locations.find(x => `loc:${x.id}` === key); return l ? { label: l.name, icon: l.icon, color: l.color } : null; }
    if (key.startsWith('cat:')) { const c = categories.find(x => `cat:${x.id}` === key); return c ? { label: c.name, icon: c.icon, color: c.color } : null; }
    return null;
  };

  const move = (idx, dir) => {
    const arr = [...tabs];
    const target = idx + dir;
    if (target < 0 || target >= arr.length) return;
    [arr[idx], arr[target]] = [arr[target], arr[idx]];
    onReorder(arr);
  };

  if (tabs.length === 0) return (
    <div style={{ padding: '12px 14px', borderRadius: 8, border: '1.5px dashed var(--border)', color: 'var(--text-light)', fontSize: 13, textAlign: 'center', marginBottom: 14 }}>
      No tabs selected yet — pick some below
    </div>
  );

  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 7 }}>
        Tab order <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, color: 'var(--text-light)' }}>
          {isMobile ? '— tap arrows to reorder' : '— drag to reorder'}
        </span>
      </div>
      {tabs.map((key, idx) => {
        const info = resolve(key);
        if (!info) return null;
        return (
          <div key={key}
            draggable={!isMobile}
            onDragStart={() => { dragIdx.current = idx; }}
            onDragOver={e => { e.preventDefault(); setDragOver(idx); }}
            onDrop={e => {
              e.preventDefault();
              if (dragIdx.current === null || dragIdx.current === idx) { setDragOver(null); return; }
              const arr = [...tabs];
              const [moved] = arr.splice(dragIdx.current, 1);
              arr.splice(idx, 0, moved);
              dragIdx.current = null; setDragOver(null);
              onReorder(arr);
            }}
            onDragEnd={() => { dragIdx.current = null; setDragOver(null); }}
            onDragLeave={() => setDragOver(null)}
            style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '8px 11px', borderRadius: 8, border: `1.5px solid ${dragOver === idx ? 'var(--accent)' : 'var(--border)'}`, background: dragOver === idx ? 'var(--accent-light)' : 'var(--bg)', marginBottom: 6, cursor: isMobile ? 'default' : 'grab', userSelect: 'none', transition: 'border-color 0.1s, background 0.1s' }}>
            {!isMobile && <span style={{ color: 'var(--text-light)', fontSize: 14, flexShrink: 0 }}>⠿</span>}
            {isMobile && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flexShrink: 0 }}>
                <button onClick={() => move(idx, -1)} disabled={idx === 0}
                  style={{ width: 24, height: 22, borderRadius: 4, border: '1px solid var(--border)', background: 'var(--bg-subtle)', color: idx === 0 ? 'var(--text-light)' : 'var(--text-muted)', fontSize: 11, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>▲</button>
                <button onClick={() => move(idx, 1)} disabled={idx === tabs.length - 1}
                  style={{ width: 24, height: 22, borderRadius: 4, border: '1px solid var(--border)', background: 'var(--bg-subtle)', color: idx === tabs.length - 1 ? 'var(--text-light)' : 'var(--text-muted)', fontSize: 11, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>▼</button>
              </div>
            )}
            <span style={{ fontSize: 16 }}>{info.icon}</span>
            <span style={{ flex: 1, fontWeight: 500, fontSize: 14 }}>{info.label}</span>
            <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: info.color + '22', color: info.color, border: `1px solid ${info.color}35` }}>
              {key.startsWith('loc:') ? 'location' : 'category'}
            </span>
            <button onClick={() => onRemove(key)} style={{ padding: '2px 7px', borderRadius: 5, background: 'var(--red-bg)', color: 'var(--red-text)', fontSize: 12, flexShrink: 0 }}>✕</button>
          </div>
        );
      })}
    </div>
  );
}

function TabPresetsModal({ locations, categories, presets, onRefresh, onClose, onActivate }) {
  const [editId, setEditId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editTabs, setEditTabs] = useState([]);
  const [editDefault, setEditDefault] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [view, setView] = useState('list'); // 'list' | 'edit'

  const startNew = () => { setEditId(null); setEditName(''); setEditTabs([]); setEditDefault(false); setError(''); setView('edit'); };
  const startEdit = p => { setEditId(p.id); setEditName(p.name); setEditTabs([...p.tabs]); setEditDefault(p.is_default); setError(''); setView('edit'); };

  const toggleTab = key => setEditTabs(t => t.includes(key) ? t.filter(k => k !== key) : [...t, key]);

  const handleSave = async () => {
    if (!editName.trim()) { setError('Name required'); return; }
    setSaving(true); setError('');
    try {
      if (editId) {
        await api(`/api/tab-presets/${editId}`, { method: 'PUT', body: { name: editName, tabs: editTabs, is_default: editDefault } });
      } else {
        await api('/api/tab-presets', { method: 'POST', body: { name: editName, tabs: editTabs, is_default: editDefault } });
      }
      await onRefresh();
      setView('list');
    } catch { setError('Name already exists'); }
    setSaving(false);
  };

  const [confirm, ConfirmUI] = useConfirm();
  const handleDelete = async id => {
    const yes = await confirm({ message: 'Delete this preset?', confirmLabel: 'Delete' });
    if (!yes) return;
    await api(`/api/tab-presets/${id}`, { method: 'DELETE' });
    await onRefresh();
  };

  const handleSetDefault = async id => {
    await api(`/api/tab-presets/${id}/set-default`, { method: 'POST' });
    await onRefresh();
  };

  if (view === 'edit') {
    const allItems = [
      ...locations.map(l => ({ key: `loc:${l.id}`, icon: l.icon, name: l.name, color: l.color, type: 'location' })),
      ...categories.map(c => ({ key: `cat:${c.id}`, icon: c.icon, name: c.name, color: c.color, type: 'category' })),
    ];
    return (
      <Modal title={editId ? 'Edit Preset' : 'New Preset'} onClose={onClose} wide>
        <Field label="Preset name">
          <input style={inputStyle} value={editName} onChange={e => setEditName(e.target.value)} placeholder="e.g. By Location, Daily Check…" autoFocus onFocus={focusInput} onBlur={blurInput} />
        </Field>

        {/* Draggable selected tabs */}
        <DraggableTabList
          tabs={editTabs}
          locations={locations}
          categories={categories}
          onReorder={setEditTabs}
          onRemove={key => setEditTabs(t => t.filter(k => k !== key))}
        />

        {/* Picker — split into two rows */}
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 7 }}>Add tabs</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
          {allItems.map(({ key, icon, name, color, type }) => {
            const on = editTabs.includes(key);
            return (
              <button key={key} onClick={() => toggleTab(key)}
                style={{ padding: '5px 12px', borderRadius: 20, fontSize: 13, fontWeight: 500, border: `1.5px solid ${on ? color : 'var(--border)'}`, background: on ? color + '22' : 'var(--bg)', color: on ? color : 'var(--text-muted)', cursor: 'pointer', transition: 'all 0.12s', display: 'flex', alignItems: 'center', gap: 5 }}>
                <span>{icon}</span>
                <span>{name}</span>
                <span style={{ fontSize: 10, opacity: 0.6 }}>{type === 'location' ? '📍' : '🏷'}</span>
                {on && <span style={{ fontSize: 10 }}>✓</span>}
              </button>
            );
          })}
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, cursor: 'pointer', fontSize: 14 }}>
          <input type="checkbox" checked={editDefault} onChange={e => setEditDefault(e.target.checked)} style={{ width: 17, height: 17, accentColor: 'var(--accent)' }} />
          <span>Set as default (loaded on startup)</span>
        </label>
        {error && <p style={{ color: 'var(--red-text)', fontSize: 13, marginBottom: 10 }}>⚠ {error}</p>}
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => setView('list')} style={{ flex: 1, padding: '11px', borderRadius: 9, border: '1.5px solid var(--border)', color: 'var(--text-muted)', background: 'var(--bg-subtle)', fontWeight: 500 }}>Back</button>
          <button onClick={handleSave} disabled={saving} style={{ flex: 2, padding: '11px', borderRadius: 9, background: 'var(--accent)', color: '#fff', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            {saving && <Spinner />} Save Preset
          </button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="Tab Presets" onClose={onClose}>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>Presets are stored on the server — the same on every device. Set a default to load it automatically on startup.</p>
      {presets.length === 0 && (
        <div style={{ textAlign: 'center', padding: '20px 0 24px', color: 'var(--text-muted)', fontSize: 14 }}>No presets yet — create one below.</div>
      )}
      {presets.map(p => (
        <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 13px', borderRadius: 10, border: `1.5px solid ${p.is_default ? 'var(--accent)' : 'var(--border)'}`, background: p.is_default ? 'var(--accent-light)' : 'var(--bg)', marginBottom: 8, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 160 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 600, fontSize: 15 }}>{p.name}</span>
              {p.is_default && <span style={{ fontSize: 11, background: 'var(--accent)', color: '#fff', padding: '1px 7px', borderRadius: 10, fontWeight: 600 }}>default</span>}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
              {p.tabs.length === 0 ? 'No tabs' : p.tabs.map(k => {
                if (k.startsWith('loc:')) { const l = locations.find(x => `loc:${x.id}` === k); return l ? `${l.icon} ${l.name}` : null; }
                if (k.startsWith('cat:')) { const c = categories.find(x => `cat:${x.id}` === k); return c ? `${c.icon} ${c.name}` : null; }
                return null;
              }).filter(Boolean).join(' · ')}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, flexShrink: 0, flexWrap: 'wrap' }}>
            <button onClick={() => { onActivate(p.tabs); onClose(); }} style={{ padding: '5px 11px', borderRadius: 7, background: 'var(--accent)', color: '#fff', fontWeight: 600, fontSize: 12, whiteSpace: 'nowrap' }}>Use</button>
            <button onClick={() => startEdit(p)} style={{ padding: '5px 11px', borderRadius: 7, border: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: 12 }}>Edit</button>
            {!p.is_default && <button onClick={() => handleSetDefault(p.id)} style={{ padding: '5px 11px', borderRadius: 7, border: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: 12, whiteSpace: 'nowrap' }}>Set default</button>}
            <button onClick={() => handleDelete(p.id)} style={{ padding: '5px 9px', borderRadius: 7, background: 'var(--red-bg)', color: 'var(--red-text)', fontSize: 12 }}>✕</button>
          </div>
        </div>
      ))}
      <button onClick={startNew} style={{ width: '100%', marginTop: 8, padding: '11px', borderRadius: 9, background: 'var(--accent)', color: '#fff', fontWeight: 600, fontSize: 14 }}>+ New Preset</button>
      {ConfirmUI}
    </Modal>
  );
}

// ── BackupRestoreModal ────────────────────────────────────────────────────
function BackupRestoreModal({ onClose, onRestored }) {
  const [restoring, setRestoring] = useState(false);
  const [result, setResult] = useState(null);
  const [confirmRestore, setConfirmRestore] = useState(false);
  const [pendingData, setPendingData] = useState(null);
  const fileRef = useRef(null);

  const handleDownload = async () => {
    const res = await fetch(`${API}/api/backup`);
    const blob = await res.blob();
    const cd = res.headers.get('Content-Disposition') || '';
    const match = cd.match(/filename="([^"]+)"/);
    const filename = match ? match[1] : 'homelarder-backup.json';
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileChange = async e => {
    const file = e.target.files?.[0]; if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (data.version !== 2) { setResult({ error: 'Incompatible backup version.' }); return; }
      setPendingData(data); setConfirmRestore(true); setResult(null);
    } catch { setResult({ error: 'Could not read file — must be a valid HomeLarder backup.' }); }
    e.target.value = '';
  };

  const handleRestore = async () => {
    if (!pendingData) return;
    setRestoring(true); setResult(null);
    try {
      const res = await api('/api/restore', { method: 'POST', body: pendingData });
      setResult({ ok: true, counts: res.counts });
      setConfirmRestore(false); setPendingData(null);
      onRestored();
    } catch (e) { setResult({ error: e.message }); }
    setRestoring(false);
  };

  return (
    <Modal title="Backup & Restore" onClose={onClose}>
      <div style={{ background: 'var(--bg-subtle)', borderRadius: 10, padding: 16, marginBottom: 14, border: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <span style={{ fontSize: 28, lineHeight: 1, flexShrink: 0 }}>{"\u{1F4E5}"}</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>Download backup</div>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12, lineHeight: 1.5 }}>
              Exports all items, sub-entries, locations, categories, and tab presets as a JSON file.
            </p>
            <button onClick={handleDownload} style={{ padding: '9px 18px', borderRadius: 8, background: 'var(--accent)', color: '#fff', fontWeight: 600, fontSize: 14 }}>
              Download backup
            </button>
          </div>
        </div>
      </div>
      <div style={{ background: 'var(--bg-subtle)', borderRadius: 10, padding: 16, border: `1.5px solid ${confirmRestore ? 'var(--red-text)' : 'var(--border)'}` }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <span style={{ fontSize: 28, lineHeight: 1, flexShrink: 0 }}>{"\u{1F4E4}"}</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>Restore from backup</div>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12, lineHeight: 1.5 }}>
              Replaces <strong>all current data</strong> with a backup file. Cannot be undone.
            </p>
            {!confirmRestore ? (
              <>
                <input ref={fileRef} type="file" accept=".json" onChange={handleFileChange} style={{ display: 'none' }} />
                <button onClick={() => fileRef.current?.click()} style={{ padding: '9px 18px', borderRadius: 8, border: '1.5px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text)', fontWeight: 500, fontSize: 14 }}>
                  Choose backup file…
                </button>
              </>
            ) : (
              <div style={{ background: 'var(--red-bg)', borderRadius: 8, padding: 12 }}>
                <p style={{ fontWeight: 600, color: 'var(--red-text)', fontSize: 14, marginBottom: 4 }}>⚠ This will overwrite everything</p>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>
                  Backup from <strong>{pendingData?.exported_at?.slice(0,10)}</strong> — {pendingData?.items?.length || 0} items, {pendingData?.sub_entries?.length || 0} sub-entries.
                </p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => { setConfirmRestore(false); setPendingData(null); }} style={{ flex: 1, padding: '9px', borderRadius: 8, border: '1px solid var(--border)', color: 'var(--text-muted)', background: 'var(--bg-card)', fontWeight: 500 }}>Cancel</button>
                  <button onClick={handleRestore} disabled={restoring} style={{ flex: 2, padding: '9px', borderRadius: 8, background: 'var(--red-text)', color: '#fff', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    {restoring && React.createElement(Spinner)} Yes, restore now
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      {result?.ok && (
        <div style={{ marginTop: 14, padding: 12, borderRadius: 8, background: 'var(--green-light)', border: '1px solid var(--green)', color: 'var(--green)', fontSize: 13 }}>
          ✓ Restore complete — {result.counts.items} items, {result.counts.sub_entries} sub-entries, {result.counts.locations} locations, {result.counts.categories} categories, {result.counts.tab_presets} presets.
        </div>
      )}
      {result?.error && (
        <div style={{ marginTop: 14, padding: 12, borderRadius: 8, background: 'var(--red-bg)', color: 'var(--red-text)', fontSize: 13 }}>
          ⚠ {result.error}
        </div>
      )}
    </Modal>
  );
}

// ── LocationManager ───────────────────────────────────────────────────────
function LocationManager({ locations, onRefresh, onClose }) {
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('📦');
  const [color, setColor] = useState('#6366f1');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editIcon, setEditIcon] = useState('');
  const [editColor, setEditColor] = useState('');
  const [dragOver, setDragOver] = useState(null);
  const [localLocs, setLocalLocs] = useState(locations);
  const dragItem = useRef(null);

  useEffect(() => { setLocalLocs(locations); }, [locations]);

  const handleAdd = async () => {
    if (!name.trim()) return;
    setSaving(true); setError('');
    try {
      await api('/api/locations', { method: 'POST', body: { name: name.trim(), icon, color } });
      setName(''); setIcon('📦'); setColor('#6366f1'); onRefresh();
    } catch { setError('Name already exists'); }
    setSaving(false);
  };

  const handleSaveEdit = async id => {
    try {
      const loc = localLocs.find(l => l.id === id);
      await api(`/api/locations/${id}`, { method: 'PUT', body: { name: editName, icon: editIcon, color: editColor, sort_order: loc.sort_order } });
      setEditingId(null); onRefresh();
    } catch { setError('Name already exists'); }
  };

  const [confirm, ConfirmUI] = useConfirm();
  const handleDelete = async id => {
    const loc = localLocs.find(l => l.id === id);
    const yes = await confirm({ message: `Delete "${loc?.name}"?`, detail: 'Items in this location will become unassigned.', confirmLabel: 'Delete' });
    if (!yes) return;
    await api(`/api/locations/${id}`, { method: 'DELETE' }); onRefresh();
  };

  const handleDragStart = (e, idx) => { dragItem.current = idx; e.dataTransfer.effectAllowed = 'move'; };
  const handleDragOver = (e, idx) => { e.preventDefault(); setDragOver(idx); };
  const handleDrop = async (e, idx) => {
    e.preventDefault();
    if (dragItem.current === null || dragItem.current === idx) { setDragOver(null); return; }
    const arr = [...localLocs]; const [m] = arr.splice(dragItem.current, 1); arr.splice(idx, 0, m);
    const reordered = arr.map((l, i) => ({ ...l, sort_order: i }));
    setLocalLocs(reordered); setDragOver(null); dragItem.current = null;
    await api('/api/locations/reorder', { method: 'POST', body: reordered.map(l => ({ id: l.id, sort_order: l.sort_order })) });
    onRefresh();
  };

  return (
    <Modal title="Manage Locations" onClose={onClose} wide>
      <div style={{ background: 'var(--bg-subtle)', borderRadius: 10, padding: 14, marginBottom: 18, border: '1px solid var(--border)' }}>
        <div style={{ fontWeight: 600, fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Add new location</div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
          <input style={{ ...inputStyle, flex: 1, minWidth: 120 }} value={name} onChange={e => setName(e.target.value)} placeholder="Name…" onKeyDown={e => e.key === 'Enter' && handleAdd()} onFocus={focusInput} onBlur={blurInput} />
          <input style={{ ...inputStyle, width: 52, textAlign: 'center', fontSize: 20, padding: '8px 4px', flex: '0 0 52px' }} value={icon} onChange={e => setIcon(e.target.value)} title="Emoji" />
          <input type="color" value={color} onChange={e => setColor(e.target.value)} style={{ width: 44, height: 40, border: '1.5px solid var(--border)', borderRadius: 8, cursor: 'pointer', padding: 2, flex: '0 0 44px' }} />
        </div>
        {error && <p style={{ color: 'var(--red-text)', fontSize: 13, marginBottom: 8 }}>⚠ {error}</p>}
        <button onClick={handleAdd} disabled={saving || !name.trim()} style={{ padding: '8px 18px', borderRadius: 8, background: 'var(--accent)', color: '#fff', fontWeight: 600, fontSize: 14, opacity: !name.trim() ? 0.5 : 1 }}>
          {saving ? <Spinner /> : '+ Add'}
        </button>
      </div>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Your locations <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, color: 'var(--text-light)' }}>— drag to reorder</span></div>
      {localLocs.map((loc, idx) => (
        <div key={loc.id} draggable onDragStart={e => handleDragStart(e, idx)} onDragOver={e => handleDragOver(e, idx)} onDrop={e => handleDrop(e, idx)} onDragLeave={() => setDragOver(null)}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', borderRadius: 10, border: `1.5px solid ${dragOver === idx ? 'var(--accent)' : 'var(--border)'}`, background: dragOver === idx ? 'var(--accent-light)' : 'var(--bg)', marginBottom: 7, cursor: 'grab', transition: 'all 0.12s' }}>
          <span style={{ color: 'var(--text-light)', fontSize: 16, flexShrink: 0 }}>⠿</span>
          {editingId === loc.id ? (
            <>
              <input style={{ ...inputStyle, flex: 1, fontSize: 13, ...IS.sm }} value={editName} onChange={e => setEditName(e.target.value)} onFocus={focusInput} onBlur={blurInput} />
              <input style={{ ...inputStyle, width: 44, textAlign: 'center', fontSize: 18, padding: '5px 4px' }} value={editIcon} onChange={e => setEditIcon(e.target.value)} />
              <input type="color" value={editColor} onChange={e => setEditColor(e.target.value)} style={{ width: 38, height: 34, border: '1.5px solid var(--border)', borderRadius: 6, cursor: 'pointer', padding: 2, flexShrink: 0 }} />
              <button onClick={() => handleSaveEdit(loc.id)} style={{ padding: '5px 11px', borderRadius: 6, background: 'var(--accent)', color: '#fff', fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap' }}>Save</button>
              <button onClick={() => setEditingId(null)} style={{ padding: '5px 9px', borderRadius: 6, border: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: 13 }}>✕</button>
            </>
          ) : (
            <>
              <span style={{ fontSize: 20, flexShrink: 0 }}>{loc.icon}</span>
              <div style={{ flex: 1 }}><span style={{ fontWeight: 600 }}>{loc.name}</span><div style={{ width: 28, height: 3, borderRadius: 2, background: loc.color, marginTop: 3 }} /></div>
              <button onClick={() => { setEditingId(loc.id); setEditName(loc.name); setEditIcon(loc.icon); setEditColor(loc.color); }} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 12, color: 'var(--text-muted)' }}>Edit</button>
              <button onClick={() => handleDelete(loc.id)} style={{ padding: '4px 9px', borderRadius: 6, background: 'var(--red-bg)', color: 'var(--red-text)', fontSize: 12 }}>✕</button>
            </>
          )}
        </div>
      ))}
      {ConfirmUI}
    </Modal>
  );
}

// ── CategoryManager ───────────────────────────────────────────────────────
function CategoryManager({ categories, onRefresh, onClose }) {
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('📦');
  const [color, setColor] = useState('#6366f1');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [catToDelete, setCatToDelete] = useState(null);
  const [confirm, ConfirmUI] = useConfirm();

  // Handle category delete via confirm dialog
  useEffect(() => {
    if (!catToDelete) return;
    const cat = categories.find(c => c.id === catToDelete);
    confirm({ message: `Delete "${cat?.name}"?`, detail: 'Items will be uncategorised.', confirmLabel: 'Delete' }).then(yes => {
      setCatToDelete(null);
      if (yes) api(`/api/categories/${catToDelete}`, { method: 'DELETE' }).then(onRefresh);
    });
  }, [catToDelete]); // eslint-disable-line

  const handleAdd = async () => {
    if (!name.trim()) return;
    setSaving(true); setError('');
    try {
      await api('/api/categories', { method: 'POST', body: { name: name.trim(), icon, color } });
      setName(''); setIcon('📦'); setColor('#6366f1'); onRefresh();
    } catch { setError('Name already exists'); }
    setSaving(false);
  };

  return (
    <Modal title="Manage Categories" onClose={onClose} wide>
      <div style={{ background: 'var(--bg-subtle)', borderRadius: 10, padding: 14, marginBottom: 18, border: '1px solid var(--border)' }}>
        <div style={{ fontWeight: 600, fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Add new category</div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
          <input style={{ ...inputStyle, flex: 1, minWidth: 120 }} value={name} onChange={e => setName(e.target.value)} placeholder="Name…" onKeyDown={e => e.key === 'Enter' && handleAdd()} onFocus={focusInput} onBlur={blurInput} />
          <input style={{ ...inputStyle, width: 52, textAlign: 'center', fontSize: 20, padding: '8px 4px', flex: '0 0 52px' }} value={icon} onChange={e => setIcon(e.target.value)} />
          <input type="color" value={color} onChange={e => setColor(e.target.value)} style={{ width: 44, height: 40, border: '1.5px solid var(--border)', borderRadius: 8, cursor: 'pointer', padding: 2, flex: '0 0 44px' }} />
        </div>
        {error && <p style={{ color: 'var(--red-text)', fontSize: 13, marginBottom: 8 }}>⚠ {error}</p>}
        <button onClick={handleAdd} disabled={saving || !name.trim()} style={{ padding: '8px 18px', borderRadius: 8, background: 'var(--accent)', color: '#fff', fontWeight: 600, opacity: !name.trim() ? 0.5 : 1 }}>
          {saving ? <Spinner /> : '+ Add'}
        </button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 9 }}>
        {categories.map(c => (
          <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '9px 12px', borderRadius: 9, border: '1.5px solid var(--border)', background: 'var(--bg)' }}>
            <span style={{ fontSize: 20 }}>{c.icon}</span>
            <div style={{ flex: 1 }}><div style={{ fontWeight: 600, fontSize: 14 }}>{c.name}</div><div style={{ width: 28, height: 3, borderRadius: 2, background: c.color, marginTop: 3 }} /></div>
            <button onClick={() => setCatToDelete(c.id)} style={{ padding: '4px 8px', borderRadius: 5, background: 'var(--red-bg)', color: 'var(--red-text)', fontSize: 12 }}>✕</button>
          </div>
        ))}
      </div>
      {ConfirmUI}
    </Modal>
  );
}

// ── Mobile nav drawer ─────────────────────────────────────────────────────
function MobileMenu({ onClose, onLocations, onCategories, onPresets, onBackup, darkMode, onToggleDark, totalItems }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'var(--overlay)', zIndex: 200, display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-card)', width: 240, height: '100%', boxShadow: '-4px 0 20px rgba(0,0,0,0.25)', padding: '20px 0', display: 'flex', flexDirection: 'column', gap: 2 }}>
        <div style={{ padding: '0 16px 16px', borderBottom: '1px solid var(--border)', marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <HomeLarderLogo size={26} />
            <span style={{ fontFamily: 'Fraunces, Georgia, serif', fontWeight: 700, fontSize: 18 }}>HomeLarder</span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{totalItems} item{totalItems !== 1 ? 's' : ''} stored</div>
        </div>
        {[
          ['📍', 'Locations', onLocations],
          ['🏷', 'Categories', onCategories],
          ['⚙', 'Tab Presets', onPresets],
          ['💾', 'Backup & Restore', onBackup],
        ].map(([icon, label, action]) => (
          <button key={label} onClick={() => { action(); onClose(); }} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', fontSize: 15, color: 'var(--text)', fontWeight: 500, textAlign: 'left', transition: 'background 0.1s', borderRadius: 0 }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-subtle)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
            <span style={{ fontSize: 18 }}>{icon}</span> {label}
          </button>
        ))}
        <div style={{ marginTop: 'auto', padding: '16px 20px', borderTop: '1px solid var(--border)' }}>
          <button onClick={onToggleDark} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: 'var(--text-muted)', fontWeight: 500, width: '100%' }}>
            <span style={{ fontSize: 18 }}>{darkMode ? '☀️' : '🌙'}</span>
            {darkMode ? 'Light mode' : 'Dark mode'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── App ───────────────────────────────────────────────────────────────────
export default function App() {
  const isMobile = useIsMobile();
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [locations, setLocations] = useState([]);
  const [presets, setPresets] = useState([]);
  const [stats, setStats] = useState(null);
  const [activeTab, setActiveTab] = useState(null);
  const [pinnedTabs, setPinnedTabs] = useState([]);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [viewMode, setViewMode] = useState('card');
  const [alwaysExpanded, setAlwaysExpanded] = useState(false);
  const [darkMode, setDarkMode] = useState(() => { try { return localStorage.getItem('hl_dark') === '1'; } catch { return false; } });
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [showCats, setShowCats] = useState(false);
  const [showLocs, setShowLocs] = useState(false);
  const [showPresets, setShowPresets] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showBackup, setShowBackup] = useState(false);
  const [addSubTarget, setAddSubTarget] = useState(null);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
    try { localStorage.setItem('hl_dark', darkMode ? '1' : '0'); } catch {}
  }, [darkMode]);

  const loadPresetsAndApplyDefault = useCallback(async (locs, cats) => {
    try {
      const ps = await api('/api/tab-presets');
      setPresets(ps);
      // Only apply default if nothing pinned yet
      const def = ps.find(p => p.is_default);
      if (def) setPinnedTabs(def.tabs);
    } catch {}
  }, []);

  const loadAll = useCallback(async () => {
    try {
      const [locsRes, catsRes, statsRes] = await Promise.all([
        api('/api/locations'), api('/api/categories'), api('/api/stats'),
      ]);
      setLocations(locsRes); setCategories(catsRes); setStats(statsRes);
      setReady(true);
      return { locsRes, catsRes };
    } catch (e) { console.error(e); }
  }, []);

  const loadItems = useCallback(async () => {
    if (!ready) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (activeTab === 'unassigned') params.set('location_id', 'unassigned');
      else if (activeTab?.startsWith('loc:')) params.set('location_id', activeTab.slice(4));
      else if (activeTab?.startsWith('cat:')) params.set('category_id', activeTab.slice(4));
      if (search) params.set('search', search);
      const res = await api(`/api/items?${params}`);
      const sorted = [...res].sort((a, b) => {
        if (sortBy === 'name') return a.name.localeCompare(b.name);
        if (sortBy === 'date_asc') return a.date_added.localeCompare(b.date_added);
        return b.date_added.localeCompare(a.date_added);
      });
      setItems(sorted);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [activeTab, search, sortBy, ready]);

  useEffect(() => { loadAll().then(r => r && loadPresetsAndApplyDefault(r.locsRes, r.catsRes)); }, [loadAll, loadPresetsAndApplyDefault]);
  useEffect(() => { loadItems(); }, [loadItems]);

  const handleRefresh = () => { loadAll(); loadItems(); };
  const refreshPresets = async () => { const ps = await api('/api/tab-presets'); setPresets(ps); };

  const locCounts = stats?.by_location?.reduce((acc, r) => ({ ...acc, [`loc:${r.id}`]: r.count }), {}) || {};
  const catCounts = stats?.by_category?.reduce((acc, r) => ({ ...acc, [`cat:${r.id}`]: r.count }), {}) || {};
  const unassignedCount = stats?.unassigned_count || 0;
  const totalCount = stats?.total_items || 0;
  const defaultLocId = activeTab?.startsWith('loc:') ? parseInt(activeTab.slice(4)) : null;
  const defaultCatId = activeTab?.startsWith('cat:') ? parseInt(activeTab.slice(4)) : null;

  const tabItems = pinnedTabs.map(key => {
    if (key.startsWith('loc:')) {
      const loc = locations.find(l => `loc:${l.id}` === key); if (!loc) return null;
      return { key, label: loc.name, icon: loc.icon, color: loc.color, count: locCounts[key] || 0 };
    } else if (key.startsWith('cat:')) {
      const cat = categories.find(c => `cat:${c.id}` === key); if (!cat) return null;
      return { key, label: cat.name, icon: cat.icon, color: cat.color, count: catCounts[key] || 0 };
    }
    return null;
  }).filter(Boolean);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* ── Header ── */}
      <header style={{ background: 'var(--header-bg)', color: 'var(--header-text)', padding: '0 16px', position: 'sticky', top: 0, zIndex: 100, boxShadow: '0 2px 16px rgba(0,0,0,0.25)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 10, height: 54 }}>
          <HomeLarderLogo size={30} />
          <span style={{ fontFamily: 'Fraunces, Georgia, serif', fontWeight: 700, fontSize: 19, letterSpacing: '-0.02em' }}>HomeLarder</span>
          <div style={{ flex: 1 }} />

          {/* Desktop nav */}
          {!isMobile && <>
            {stats && <span style={{ fontSize: 12, color: 'var(--header-muted)' }}>{totalCount} items</span>}
            <button onClick={() => setShowLocs(true)} style={{ padding: '6px 12px', borderRadius: 7, border: `1px solid var(--header-border)`, color: 'var(--header-btn)', fontSize: 12, fontWeight: 500, background: 'transparent' }}>📍 Locations</button>
            <button onClick={() => setShowCats(true)} style={{ padding: '6px 12px', borderRadius: 7, border: `1px solid var(--header-border)`, color: 'var(--header-btn)', fontSize: 12, fontWeight: 500, background: 'transparent' }}>🏷 Categories</button>
            <button onClick={() => setDarkMode(d => !d)} style={{ width: 32, height: 32, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid var(--header-border)`, color: 'var(--header-btn)', fontSize: 15, background: 'transparent' }}>{darkMode ? '☀️' : '🌙'}</button>
            <button onClick={() => setShowBackup(true)} style={{ padding: '6px 12px', borderRadius: 7, border: `1px solid var(--header-border)`, color: 'var(--header-btn)', fontSize: 12, fontWeight: 500, background: 'transparent' }}>💾 Backup</button>
          </>}

          <button onClick={() => setShowAdd(true)} style={{ padding: isMobile ? '8px 14px' : '7px 16px', borderRadius: 8, background: 'var(--accent)', color: '#fff', fontWeight: 600, fontSize: 13 }}>+ Add</button>

          {/* Mobile hamburger */}
          {isMobile && <button onClick={() => setShowMobileMenu(true)} style={{ width: 36, height: 36, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid var(--header-border)`, color: 'var(--header-btn)', fontSize: 20, background: 'transparent' }}>☰</button>}
        </div>
      </header>

      {/* ── Tab bar ── */}
      <div style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border)', padding: '8px 16px', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', gap: 6, alignItems: 'center', minWidth: 'max-content' }}>
          {/* All */}
          <button onClick={() => setActiveTab(null)} style={{ padding: '6px 13px', borderRadius: 30, fontWeight: 500, fontSize: 13, whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 5, border: `1.5px solid ${activeTab === null ? '#1c1712' : 'var(--border)'}`, background: activeTab === null ? '#1c1712' : 'var(--bg-card)', color: activeTab === null ? '#fff' : 'var(--text-muted)', cursor: 'pointer', transition: 'all 0.12s' }}>
            All <span style={{ background: activeTab === null ? 'rgba(255,255,255,0.2)' : 'var(--bg-subtle)', borderRadius: 10, padding: '0 5px', fontSize: 11 }}>{totalCount}</span>
          </button>

          {tabItems.map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key)} style={{ padding: '6px 13px', borderRadius: 30, fontWeight: 500, fontSize: 13, whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 5, border: `1.5px solid ${activeTab === t.key ? t.color : 'var(--border)'}`, background: activeTab === t.key ? t.color : 'var(--bg-card)', color: activeTab === t.key ? '#fff' : 'var(--text-muted)', cursor: 'pointer', transition: 'all 0.12s' }}>
              {t.icon && <span>{t.icon}</span>} {t.label}
              {t.count !== null && <span style={{ background: activeTab === t.key ? 'rgba(255,255,255,0.25)' : 'var(--bg-subtle)', borderRadius: 10, padding: '0 5px', fontSize: 11 }}>{t.count}</span>}
            </button>
          ))}

          {unassignedCount > 0 && (
            <button onClick={() => setActiveTab('unassigned')} style={{ padding: '6px 13px', borderRadius: 30, fontWeight: 500, fontSize: 13, whiteSpace: 'nowrap', border: `1.5px solid ${activeTab === 'unassigned' ? '#7a6f62' : 'var(--border)'}`, background: activeTab === 'unassigned' ? '#7a6f62' : 'var(--bg-card)', color: activeTab === 'unassigned' ? '#fff' : 'var(--text-light)', fontStyle: 'italic', cursor: 'pointer' }}>
              Unassigned <span style={{ background: 'rgba(255,255,255,0.2)', borderRadius: 10, padding: '0 5px', fontSize: 11 }}>{unassignedCount}</span>
            </button>
          )}

          <div style={{ width: 1, height: 22, background: 'var(--border)', margin: '0 2px', flexShrink: 0 }} />
          <button onClick={() => setShowPresets(true)} style={{ padding: '6px 11px', borderRadius: 20, fontSize: 12, color: 'var(--text-light)', border: '1.5px dashed var(--border)', whiteSpace: 'nowrap', cursor: 'pointer' }}>⚙ Presets</button>
        </div>
      </div>

      {/* ── Toolbar ── */}
      <div style={{ background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border)', padding: '8px 16px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Search */}
          <div style={{ position: 'relative', flex: '1 1 160px', minWidth: 0 }}>
            <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light)', fontSize: 13, pointerEvents: 'none' }}>🔍</span>
            <input style={{ ...inputStyle, paddingLeft: 30 }} value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…" onFocus={focusInput} onBlur={blurInput} />
          </div>
          {search && <button onClick={() => setSearch('')} style={{ padding: '8px 11px', borderRadius: 8, border: '1px solid var(--border)', color: 'var(--accent)', fontSize: 13, background: 'var(--accent-light)' }}>✕</button>}

          {/* Sort — scrollable row on mobile */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0, overflowX: 'auto' }}>
            {!isMobile && <span style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Sort:</span>}
            {[['name', 'A–Z'], ['date_asc', 'Oldest'], ['date_desc', 'Newest']].map(([val, label]) => (
              <button key={val} onClick={() => setSortBy(val)} style={{ padding: '5px 10px', borderRadius: 6, fontSize: 12, fontWeight: sortBy === val ? 600 : 400, border: `1.5px solid ${sortBy === val ? 'var(--accent)' : 'var(--border)'}`, background: sortBy === val ? 'var(--accent-light)' : 'var(--bg-card)', color: sortBy === val ? 'var(--accent)' : 'var(--text-muted)', whiteSpace: 'nowrap', cursor: 'pointer' }}>
                {label}
              </button>
            ))}
          </div>

          <div style={{ width: 1, height: 20, background: 'var(--border)', flexShrink: 0 }} />

          {/* View mode */}
          <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
            <button onClick={() => setViewMode('card')} title="Card view" style={{ width: 30, height: 30, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1.5px solid ${viewMode === 'card' ? 'var(--accent)' : 'var(--border)'}`, background: viewMode === 'card' ? 'var(--accent-light)' : 'var(--bg-card)', fontSize: 14, cursor: 'pointer' }}>⊞</button>
            <button onClick={() => setViewMode('row')} title="List view" style={{ width: 30, height: 30, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1.5px solid ${viewMode === 'row' ? 'var(--accent)' : 'var(--border)'}`, background: viewMode === 'row' ? 'var(--accent-light)' : 'var(--bg-card)', fontSize: 14, cursor: 'pointer' }}>☰</button>
          </div>

          {viewMode === 'card' && (
            <button onClick={() => setAlwaysExpanded(e => !e)} style={{ padding: '5px 10px', borderRadius: 6, fontSize: 12, fontWeight: alwaysExpanded ? 600 : 400, border: `1.5px solid ${alwaysExpanded ? 'var(--accent)' : 'var(--border)'}`, background: alwaysExpanded ? 'var(--accent-light)' : 'var(--bg-card)', color: alwaysExpanded ? 'var(--accent)' : 'var(--text-muted)', whiteSpace: 'nowrap', cursor: 'pointer' }}>
              {alwaysExpanded ? '▼ Collapse' : '▶ Expand all'}
            </button>
          )}
        </div>
      </div>

      {/* ── Content ── */}
      <main style={{ flex: 1, padding: '16px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}><Spinner size={28} /></div>
          ) : items.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px' }}>
              <div style={{ fontSize: 48, marginBottom: 14 }}>🥘</div>
              <h3 style={{ fontFamily: 'Fraunces, Georgia, serif', fontSize: 20, fontWeight: 600, marginBottom: 8 }}>Nothing here yet</h3>
              <p style={{ color: 'var(--text-muted)', marginBottom: 20, fontSize: 14 }}>Add your first item to get started.</p>
              <button onClick={() => setShowAdd(true)} style={{ padding: '10px 22px', borderRadius: 10, background: 'var(--accent)', color: '#fff', fontWeight: 600 }}>+ Add Item</button>
            </div>
          ) : viewMode === 'card' ? (
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
              {items.map(item => <ItemCard key={item.id} item={item} categories={categories} locations={locations} onRefresh={handleRefresh} onAddSubEntry={i => { setAddSubTarget(i); setShowAdd(true); }} alwaysExpanded={alwaysExpanded} />)}
            </div>
          ) : (
            <div>{items.map(item => <ItemRow key={item.id} item={item} categories={categories} locations={locations} onRefresh={handleRefresh} onAddSubEntry={i => { setAddSubTarget(i); setShowAdd(true); }} />)}</div>
          )}
        </div>
      </main>

      {/* ── Modals ── */}
      {showAdd && <AddItemModal categories={categories} locations={locations} onClose={() => { setShowAdd(false); setAddSubTarget(null); }} onSaved={handleRefresh} prefillItem={addSubTarget} defaultLocationId={defaultLocId} defaultCategoryId={defaultCatId} />}
      {showLocs && <LocationManager locations={locations} onRefresh={loadAll} onClose={() => setShowLocs(false)} />}
      {showCats && <CategoryManager categories={categories} onRefresh={loadAll} onClose={() => setShowCats(false)} />}
      {showPresets && <TabPresetsModal locations={locations} categories={categories} presets={presets} onRefresh={refreshPresets} onClose={() => setShowPresets(false)} onActivate={tabs => setPinnedTabs(tabs)} />}
      {showBackup && <BackupRestoreModal onClose={() => setShowBackup(false)} onRestored={handleRefresh} />}
      {showMobileMenu && <MobileMenu onClose={() => setShowMobileMenu(false)} onLocations={() => setShowLocs(true)} onCategories={() => setShowCats(true)} onPresets={() => setShowPresets(true)} onBackup={() => setShowBackup(true)} darkMode={darkMode} onToggleDark={() => setDarkMode(d => !d)} totalItems={totalCount} />}
    </div>
  );
}
