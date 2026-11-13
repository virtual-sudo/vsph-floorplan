import { useLayoutEffect, useRef } from 'react';
import { Icon } from './icons';

// Segmented control (Bare/Dressed, Day/Night...). The dark highlight glides to the chosen option.
export function Seg<T extends string>({ value, options, onChange, label, small }: { value: T; options: { v: T; label: string; icon?: string }[]; onChange: (v: T) => void; label: string; small?: boolean }) {
  const box = useRef<HTMLDivElement>(null);
  const pill = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const b = box.current, p = pill.current;
    if (!b || !p) return;
    const place = () => {
      const on = b.querySelector<HTMLButtonElement>('button[aria-checked="true"]');
      if (!on) return;
      p.style.setProperty('--x', on.offsetLeft + 'px');
      p.style.setProperty('--w', on.offsetWidth + 'px');
    };
    place();
    // glide only after the first placement, so the page doesn't open with the highlight sliding in
    requestAnimationFrame(() => p.setAttribute('data-ready', ''));
    const ro = new ResizeObserver(place);
    ro.observe(b);
    return () => ro.disconnect();
  }, [value]);
  return (
    <div className={'seg' + (small ? ' small' : '')} role="radiogroup" aria-label={label} ref={box}>
      <span className="seg-pill" ref={pill} aria-hidden="true" />
      {options.map((o) => (
        <button key={o.v} role="radio" aria-checked={value === o.v} className={value === o.v ? 'on' : ''} onClick={() => onChange(o.v)} title={o.label}>
          {o.icon && <Icon name={o.icon} size={16} />}
          <span>{o.label}</span>
        </button>
      ))}
    </div>
  );
}
