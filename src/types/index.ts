export type VehicleType = 'hatch' | 'sedan' | 'suv' | 'pickup';

export type UserRole = 'admin' | 'client';

export interface Profile {
  id: string;
  email: string;
  displayName: string;
  phone: string;
  role: UserRole;
  carModel?: string;
  licensePlate?: string;
  preferredVehicleType?: VehicleType;
  washCount: number;
  createdAt: string;
}

export interface Service {
  id: string;
  name: string;
  description: string;
  category: string;
  prices: Record<VehicleType, number>;
  duration: number;
  active: boolean;
  createdAt: string;
}

export interface Appointment {
  id: string;
  userId: string;
  customerName: string;
  customerPhone: string;
  vehicleType: VehicleType;
  serviceIds: string[];
  serviceNames: string[];
  date: string;
  time: string;
  status: 'pending' | 'confirmed' | 'washing' | 'completed' | 'cancelled';
  totalPrice: number;
  photoBefore?: string;
  photoAfter?: string;
  notes?: string;
  createdAt: string;
}

export interface AppSettings {
  id: string;
  businessHours: string[];
  capacity: number;
  loyaltyEnabled: boolean;
  loyaltyGoal: number;
  loyaltyReward: string;
  logoUrl?: string;
  whatsappNumber?: string;
  updatedAt: string;
}

export interface Expense {
  id: string;
  description: string;
  amount: number;
  category: 'products' | 'rent' | 'electricity' | 'water' | 'other';
  date: string;
  createdAt: string;
}

export interface Promotion {
  id: string;
  title: string;
  description: string;
  active: boolean;
  imageUrl?: string;
  discountType: 'percentage' | 'fixed' | 'bundle';
  discountValue?: number;
  fixedPrice?: number;
  serviceIds?: string[];
  createdAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  appointmentId: string;
  title: string;
  message: string;
  type: 'status_change' | 'promotion' | 'reminder';
  read: boolean;
  createdAt: string;
}
