import { useState, useEffect } from 'react';
import { dbService } from '../services/dbService';

const LOGO_CACHE_KEY = 'boxclass_cached_logo';

export function useLogo() {
  const [logoUrl, setLogoUrl] = useState<string | null>(() => {
    // Try to get from localStorage on initial load
    try {
      return localStorage.getItem(LOGO_CACHE_KEY);
    } catch (e) {
      return null;
    }
  });

  useEffect(() => {
    async function fetchLatestLogo() {
      try {
        const settings = await dbService.getSettings();
        if (settings.logoUrl && settings.logoUrl !== logoUrl) {
          setLogoUrl(settings.logoUrl);
          localStorage.setItem(LOGO_CACHE_KEY, settings.logoUrl);
        }
      } catch (error) {
        console.error('Error fetching latest logo:', error);
      }
    }

    fetchLatestLogo();
  }, [logoUrl]);

  return logoUrl;
}
