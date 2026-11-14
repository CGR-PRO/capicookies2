import { useId } from 'react';

interface ToggleProps {
  checked: boolean;
  onChange(checked: boolean): void;
  label: string;
  description?: string;
  disabled?: boolean;
  hideLabel?: boolean;
}

/** Toggle switch arredondado em vidro fosco com gradiente laranja/creme. */
export function Toggle({ checked, onChange, label, description, disabled, hideLabel }: ToggleProps) {
  const id = useId();
  return (
    <div className={`toggle-row${disabled ? ' is-disabled' : ''}`}>
      {!hideLabel && (
        <div className="toggle-row__text">
          <label htmlFor={id} className="toggle-row__label">
            {label}
          </label>
          {description && <span className="toggle-row__desc">{description}</span>}
        </div>
      )}
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={hideLabel ? label : undefined}
        disabled={disabled}
        className={`toggle${checked ? ' is-on' : ''}`}
        onClick={() => onChange(!checked)}
      >
        <span className="toggle__thumb" />
      </button>
    </div>
  );
}
