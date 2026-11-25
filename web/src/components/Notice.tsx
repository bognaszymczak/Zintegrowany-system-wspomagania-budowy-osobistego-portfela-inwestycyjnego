import type { ReactNode } from 'react';
import { Icon, type IconName } from './Icon';

interface NoticeProps {
  /** info = wskazówka (zielonkawa), warn = uwaga (bursztynowa), error = błąd (czerwona) */
  tone?: 'info' | 'warn' | 'error';
  icon?: IconName;
  /** error ogłaszamy czytnikom ekranu od razu (role="alert") */
  children: ReactNode;
}

/** Ramka z krótką informacją. Treść zawsze po polsku i zawsze mówi, co dalej. */
export function Notice({ tone = 'info', icon, children }: NoticeProps) {
  const iconName: IconName = icon ?? (tone === 'info' ? 'info' : 'alert');
  return (
    <div className={`notice notice--${tone}`} role={tone === 'error' ? 'alert' : undefined}>
      <Icon name={iconName} size={20} className="notice__icon" />
      <div>{children}</div>
    </div>
  );
}
