import React from 'react';
import './style.css';

interface StatCardProps {
  /** Label text below the number */
  label: string;
  /** The main number to display */
  value: number | string;
  /** Icon to display */
  icon?: React.ReactNode;
  /** Color variant */
  color?: 'blue' | 'green' | 'orange' | 'purple';
  /** Click handler */
  onClick?: () => void;
  /** Loading state */
  loading?: boolean;
}

const colorMap = {
  blue: { bg: 'var(--color-primary-bg)', icon: 'var(--color-primary)' },
  green: { bg: 'var(--color-success-bg)', icon: 'var(--color-success)' },
  orange: { bg: 'var(--color-warning-bg)', icon: 'var(--color-warning)' },
  purple: { bg: 'var(--color-accent-bg)', icon: 'var(--color-accent)' },
};

const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  icon,
  color = 'blue',
  onClick,
  loading = false,
}) => {
  const colors = colorMap[color];

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (onClick && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      onClick();
    }
  };

  return (
    <div
      className={`stat-card ${onClick ? 'stat-card--clickable' : ''}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? handleKeyDown : undefined}
      aria-label={onClick ? `${label}: ${value}` : undefined}
    >
      {icon && (
        <div
          className="stat-card__icon"
          style={{ background: colors.bg, color: colors.icon }}
          aria-hidden="true"
        >
          {icon}
        </div>
      )}
      <div className="stat-card__content">
        <div className="stat-card__value">
          {loading ? <span className="stat-card__skeleton" /> : value}
        </div>
        <div className="stat-card__label">{label}</div>
      </div>
    </div>
  );
};

export default StatCard;
