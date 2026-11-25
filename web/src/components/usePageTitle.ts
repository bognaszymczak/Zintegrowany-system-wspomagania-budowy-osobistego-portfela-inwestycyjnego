import { useEffect } from 'react';

/** Ustawia tytuł karty przeglądarki — czytnik ekranu ogłasza go przy zmianie ekranu. */
export function usePageTitle(title: string) {
  useEffect(() => {
    document.title = `${title} — Horyzont`;
  }, [title]);
}
