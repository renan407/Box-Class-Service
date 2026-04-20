
import { Appointment, Profile, Service, AppSettings } from '../types';

const CACHE_KEYS = {
  PROFILES: 'cache_profiles',
  SERVICES: 'cache_services',
  APPOINTMENTS: 'cache_appointments',
  SETTINGS: 'cache_settings',
  LAST_UPDATE: 'cache_last_update'
};

class CacheService {
  private isOffline = false;
  private listeners: ((offline: boolean) => void)[] = [];

  constructor() {
    this.isOffline = !navigator.onLine;
    window.addEventListener('online', () => this.setOffline(false));
    window.addEventListener('offline', () => this.setOffline(true));
  }

  private setOffline(status: boolean) {
    this.isOffline = status;
    this.notify();
  }

  public setDbStatus(isError: boolean) {
    if (this.isOffline !== isError) {
      this.isOffline = isError;
      this.notify();
    }
  }

  public getIsOffline(): boolean {
    return this.isOffline;
  }

  public subscribe(callback: (offline: boolean) => void) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  private notify() {
    this.listeners.forEach(l => l(this.isOffline));
  }

  // Generic Cache Methods
  save(key: string, data: any) {
    try {
      localStorage.setItem(key, JSON.stringify(data));
      localStorage.setItem(CACHE_KEYS.LAST_UPDATE, new Date().toISOString());
    } catch (e) {
      console.warn('Failed to save to local cache', e);
    }
  }

  get<T>(key: string): T | null {
    const data = localStorage.getItem(key);
    if (!data) return null;
    try {
      return JSON.parse(data) as T;
    } catch (e) {
      return null;
    }
  }

  // Specific Cache Methods
  saveProfiles(profiles: Profile[]) { this.save(CACHE_KEYS.PROFILES, profiles); }
  getProfiles(): Profile[] | null { return this.get<Profile[]>(CACHE_KEYS.PROFILES); }

  saveServices(services: Service[]) { this.save(CACHE_KEYS.SERVICES, services); }
  getServices(): Service[] | null { return this.get<Service[]>(CACHE_KEYS.SERVICES); }

  saveAppointments(appointments: Appointment[]) { this.save(CACHE_KEYS.APPOINTMENTS, appointments); }
  getAppointments(): Appointment[] | null { return this.get<Appointment[]>(CACHE_KEYS.APPOINTMENTS); }

  saveSettings(settings: AppSettings) { this.save(CACHE_KEYS.SETTINGS, settings); }
  getSettings(): AppSettings | null { return this.get<AppSettings>(CACHE_KEYS.SETTINGS); }

  getLastUpdateTime(): string | null {
    return localStorage.getItem(CACHE_KEYS.LAST_UPDATE);
  }
}

export const cacheService = new CacheService();
