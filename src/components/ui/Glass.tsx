import type { HTMLAttributes, ReactNode } from 'react';

interface CardProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  title?: ReactNode;
  icon?: ReactNode;
  actions?: ReactNode;
  as?: 'section' | 'div' | 'article';
  padded?: boolean;
}

/** Cartão em vidro fosco reutilizável. */
export function GlassCard({ title, icon, actions, as: Tag = 'section', padded = true, className = '', children, ...rest }: CardProps) {
  return (
    <Tag className={`glass card ${padded ? 'card--padded' : ''} ${className}`} {...rest}>
      {(title || actions) && (
        <header className="card__header">
          {title && (
            <h2 className="card__title">
              {icon && <span className="card__icon" aria-hidden>{icon}</span>}
              {title}
            </h2>
          )}
          {actions && <div className="card__actions">{actions}</div>}
        </header>
      )}
      {children}
    </Tag>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="page-header">
      <div>
        <h1 className="page-header__title">{title}</h1>
        {subtitle && <p className="page-header__subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="page-header__actions">{actions}</div>}
    </header>
  );
}

export function EmptyState({ icon, title, children, action }: { icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty-state">
      {icon && <div className="empty-state__icon" aria-hidden>{icon}</div>}
      <p className="empty-state__title">{title}</p>
      {children && <p className="empty-state__text">{children}</p>}
      {action}
    </div>
  );
}

interface SegmentedProps<T extends string> {
  value: T;
  onChange: (v: NoInfer<T>) => void;
  options: { value: NoInfer<T>; label: ReactNode; icon?: ReactNode }[];
  label: string;
  size?: 'sm' | 'md';
}

export function Segmented<T extends string>({ value, onChange, options, label, size = 'md' }: SegmentedProps<T>) {
  return (
    <div className={`segmented segmented--${size}`} role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          className={`segmented__item${value === o.value ? ' is-active' : ''}`}
          onClick={() => onChange(o.value)}
        >
          {o.icon}
          <span>{o.label}</span>
        </button>
      ))}
    </div>
  );
}

export function Badge({ tone = 'neutral', children, icon }: { tone?: 'neutral' | 'good' | 'warning' | 'critical' | 'info'; children: ReactNode; icon?: ReactNode }) {
  return (
    <span className={`badge badge--${tone}`}>
      {icon}
      {children}
    </span>
  );
}

export function CategoryDot({ color }: { color?: string }) {
  return <span className="cat-dot" style={{ background: color ?? 'var(--text-muted)' }} aria-hidden />;
}
