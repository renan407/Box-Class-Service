import { supabase } from '../lib/supabase';
import { Profile, Service, Appointment, AppSettings, VehicleType, Expense, Promotion, Notification } from '../types';
import { emailService } from './emailService';

const ADMIN_EMAILS = ['renanbh27@gmail.com', 'boxclasscar@gmail.com'];

export const dbService = {
  // Profiles
  async getProfile(userId: string) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (error) throw error;

    // Auto-promote to admin if email is in ADMIN_EMAILS but role is client
    if (data && data.role === 'client' && data.email && ADMIN_EMAILS.includes(data.email)) {
      const { data: updatedData, error: updateError } = await supabase
        .from('profiles')
        .update({ role: 'admin' })
        .eq('id', userId)
        .select()
        .single();
      
      if (!updateError && updatedData) {
        return updatedData as Profile;
      }
    }

    return data as Profile;
  },

  async createProfile(profile: Partial<Profile>) {
    const normalizedPhone = profile.phone ? profile.phone.replace(/\D/g, '') : '';
    const email = profile.email || (normalizedPhone ? `${normalizedPhone}@boxclasscar.com.br` : `user_${profile.id}@boxclasscar.com.br`);
    const role = email && ADMIN_EMAILS.includes(email) ? 'admin' : 'client';
    
    let washCount = profile.washCount || 0;

    // Merge logic: if a profile with the same phone exists, "adopt" its history
    if (normalizedPhone) {
      // Try both tables for existing profile
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('phone', normalizedPhone)
        .neq('id', profile.id!)
        .maybeSingle();

      const { data: existingCustomer } = await supabase
        .from('customers')
        .select('*')
        .eq('phone', normalizedPhone)
        .neq('id', profile.id!)
        .maybeSingle();

      const existing = existingProfile || existingCustomer;

      if (existing) {
        // Transfer appointments
        await Promise.all([
          supabase
            .from('appointments')
            .update({ userId: profile.id })
            .eq('userId', existing.id),
          supabase
            .from('appointments')
            .update({ userId: profile.id })
            .eq('customerPhone', normalizedPhone)
            .is('userId', null)
        ]);

        // Transfer notifications
        await supabase
          .from('notifications')
          .update({ userId: profile.id })
          .eq('userId', existing.id);

        // Inherit washCount
        washCount = existing.washCount || 0;

        // Delete the old placeholder
        if (existingProfile) {
          await supabase.from('profiles').delete().eq('id', existing.id);
        } else {
          await supabase.from('customers').delete().eq('id', existing.id);
        }
      }
    }

    const profileData = { ...profile, email, role, washCount, phone: normalizedPhone };
    
    // Try profiles first
    let result = await supabase
      .from('profiles')
      .upsert(profileData)
      .select()
      .single();
    
    if (result.error && result.error.code === '23503') { // Foreign key violation
      console.log('Profiles table has FK constraint. Trying customers table for manual entry.');
      // Try customers table
      result = await supabase
        .from('customers')
        .upsert(profileData)
        .select()
        .single();
    }
    
    const { data, error } = result;
    
    if (error) {
      console.error('Profile/Customer creation error:', error);
      throw error;
    }
    return data as Profile;
  },

  async updateProfile(userId: string, profile: Partial<Profile>) {
    // Try profiles first
    let { data, error } = await supabase
      .from('profiles')
      .update(profile)
      .eq('id', userId)
      .select()
      .single();
    
    if (error && error.code === 'PGRST116') { // Not found in profiles
      // Try customers table
      const result = await supabase
        .from('customers')
        .update(profile)
        .eq('id', userId)
        .select()
        .single();
      data = result.data;
      error = result.error;
    }
    
    if (error) throw error;
    return data as Profile;
  },

  async getProfiles() {
    const [profilesRes, customersRes] = await Promise.all([
      supabase.from('profiles').select('*').order('displayName'),
      supabase.from('customers').select('*').order('displayName')
    ]);

    const allProfiles = [
      ...(profilesRes.data || []),
      ...(customersRes.data || [])
    ];

    return allProfiles as Profile[];
  },

  // Services
  async getServices() {
    const { data, error } = await supabase
      .from('services')
      .select('*')
      .eq('active', true)
      .order('name');
    
    if (error) throw error;
    return data as Service[];
  },

  async getAllServices() {
    const { data, error } = await supabase
      .from('services')
      .select('*')
      .order('name');
    
    if (error) throw error;
    return data as Service[];
  },

  async saveService(service: Partial<Service>) {
    const { data, error } = await supabase
      .from('services')
      .upsert(service)
      .select()
      .single();
    
    if (error) throw error;
    return data as Service;
  },

  async deleteService(id: string) {
    const { error } = await supabase
      .from('services')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  },

  // Appointments
  async getAppointments(userId?: string) {
    let query = supabase.from('appointments').select('*').order('date', { ascending: false }).order('time', { ascending: false });
    
    if (userId) {
      query = query.eq('userId', userId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data as Appointment[];
  },

  async getAppointmentsByDate(date: string) {
    const { data, error } = await supabase
      .from('appointments')
      .select('*')
      .eq('date', date)
      .not('status', 'eq', 'cancelled');
    
    if (error) throw error;
    return data as Appointment[];
  },

  async createAppointment(appointment: Partial<Appointment>) {
    const normalizedPhone = appointment.customerPhone ? appointment.customerPhone.replace(/\D/g, '') : '';
    
    // Attempt to create the appointment
    let { data, error } = await supabase
      .from('appointments')
      .insert({ ...appointment, customerPhone: normalizedPhone })
      .select()
      .single();
    
    // If it fails with a foreign key violation on userId, try again without the userId
    // or with a fallback if we can determine one. 
    // Usually this happens when userId is from the 'customers' table but the FK points to 'profiles'.
    if (error && error.code === '23503' && appointment.userId) {
      console.warn('FK violation on appointments.userId. Retrying with userId = null');
      const { data: retryData, error: retryError } = await supabase
        .from('appointments')
        .insert({ ...appointment, userId: null, customerPhone: normalizedPhone })
        .select()
        .single();
      
      data = retryData;
      error = retryError;
    }
    
    if (error) throw error;

    // Send email notification to ADMIN for new appointment request
    try {
      const vehicleLabel: Record<string, string> = {
        hatch: 'Hatch',
        sedan: 'Sedan',
        suv: 'SUV',
        pickup: 'Pickup'
      };
      const v = vehicleLabel[data.vehicleType] || 'veículo';
      
      emailService.sendAdminNotification(
        data.customerName || 'Cliente',
        v,
        data.time,
        data.date,
        'Serviços selecionados'
      ).catch(err => console.error('Erro ao enviar e-mail ao admin:', err));
    } catch (err) {
      console.warn('Erro ao processar notificação para o admin:', err);
    }

    return data as Appointment;
  },

  async updateAppointment(id: string, updates: Partial<Appointment>) {
    const { data, error } = await supabase
      .from('appointments')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data as Appointment;
  },

  async updateAppointmentStatus(id: string, status: Appointment['status'], photos?: { photoBefore?: string, photoAfter?: string }) {
    const updateData: any = { status };
    if (photos) {
      if (photos.photoBefore) updateData.photoBefore = photos.photoBefore;
      if (photos.photoAfter) updateData.photoAfter = photos.photoAfter;
    }

    const { data, error } = await supabase
      .from('appointments')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;

    // If completed, increment wash count for the user
    if (status === 'completed') {
      const phone = data.customerPhone;
      const userId = data.userId;

      // 1. Try to find by phone first (most reliable for both profiles and customers)
      if (phone) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('id, washCount')
          .eq('phone', phone)
          .maybeSingle();
        
        if (profile) {
          await supabase
            .from('profiles')
            .update({ washCount: (profile.washCount || 0) + 1 })
            .eq('id', profile.id);
        } else {
          const { data: customer } = await supabase
            .from('customers')
            .select('id, washCount')
            .eq('phone', phone)
            .maybeSingle();
          
          if (customer) {
            await supabase
              .from('customers')
              .update({ washCount: (customer.washCount || 0) + 1 })
              .eq('id', customer.id);
          } else if (userId) {
            // 2. Fallback to userId if phone search failed and userId exists
            const { data: profileById } = await supabase
              .from('profiles')
              .select('id, washCount')
              .eq('id', userId)
              .maybeSingle();
            
            if (profileById) {
              await supabase
                .from('profiles')
                .update({ washCount: (profileById.washCount || 0) + 1 })
                .eq('id', userId);
            } else {
              const { data: customerById } = await supabase
                .from('customers')
                .select('id, washCount')
                .eq('id', userId)
                .maybeSingle();
              
              if (customerById) {
                await supabase
                  .from('customers')
                  .update({ washCount: (customerById.washCount || 0) + 1 })
                  .eq('id', userId);
              }
            }
          }
        }
      }
    }

    // Create notification for the user (non-blocking)
    if (data.userId) {
      const vehicleLabel: Record<string, string> = {
        hatch: 'Hatch',
        sedan: 'Sedan',
        suv: 'SUV',
        pickup: 'Pickup'
      };

      const v = vehicleLabel[data.vehicleType] || 'veículo';

      const statusMessages: Record<string, string> = {
        confirmed: `Seu agendamento para o ${v} foi confirmado para às ${data.time}!`,
        washing: `Iniciamos a lavagem do seu ${v} agora mesmo!`,
        completed: `Seu ${v} está brilhando e pronto para retirada! ✨`,
        cancelled: `O agendamento do seu ${v} foi cancelado.`
      };

      if (statusMessages[status]) {
        try {
          // Fetch user profile for email sending
          let { data: profile } = await supabase
            .from('profiles')
            .select('displayName, email')
            .eq('id', data.userId)
            .single();

          if (!profile) {
            const { data: customer } = await supabase
              .from('customers')
              .select('displayName, email')
              .eq('id', data.userId)
              .single();
            profile = customer;
          }

          // Only send email confirmation when status is 'confirmed'
          if (profile && profile.email && status === 'confirmed') {
            emailService.sendNewAppointment(
              profile.displayName || 'Cliente',
              profile.email,
              v,
              data.time,
              data.date,
              'Serviços confirmados'
            ).catch(err => console.error('Erro ao enviar e-mail de confirmação:', err));
          }

          // Usando aspas duplas para bater exatamente com o SQL que criamos
          const { error: notifError } = await supabase
            .from('notifications')
            .insert({
              userId: data.userId,
              appointmentId: id,
              title: 'Atualização de Status',
              message: statusMessages[status],
              type: 'status_change',
              read: false
            });
          
          if (notifError) {
            console.error('Erro do Supabase ao criar notificação:', notifError);
          } else {
            console.log('Notificação criada com sucesso para o usuário:', data.userId);
          }
        } catch (err) {
          console.warn('Erro ao processar notificação:', err);
        }
      }
    } else {
      console.log('Agendamento sem userId vinculado. Nenhuma notificação enviada.');
    }

    return data as Appointment;
  },

  async deleteAppointment(id: string) {
    const { error } = await supabase
      .from('appointments')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  },

  // Settings
  async getSettings() {
    const { data, error } = await supabase
      .from('settings')
      .select('*')
      .single();
    
    if (error && error.code !== 'PGRST116') throw error;
    
    // Default settings if none exist
    const defaultLogo = 'https://lh3.googleusercontent.com/d/1cKe9DW0MFwXLqTrRaV9bemKXVda1nFi8';
    
    if (!data) {
      return {
        id: 'default',
        businessHours: ['08:00', '09:30', '11:00', '12:30', '14:00', '15:30'],
        capacity: 1,
        loyaltyEnabled: true,
        loyaltyGoal: 5,
        loyaltyReward: 'enceramento com cera de carnaúba líquida',
        loyaltyMessageTemplate: 'Faltam {remaining} lavagens para você ganhar um {reward} por nossa conta!',
        logoUrl: defaultLogo,
        updatedAt: new Date().toISOString()
      } as AppSettings;
    }

    return {
      ...data,
      loyaltyEnabled: data.loyaltyEnabled ?? true,
      loyaltyGoal: data.loyaltyGoal ?? 5,
      loyaltyReward: data.loyaltyReward ?? 'enceramento com cera de carnaúba líquida',
      loyaltyMessageTemplate: data.loyaltyMessageTemplate || 'Faltam {remaining} lavagens para você ganhar um {reward} por nossa conta!',
      logoUrl: data.logoUrl || defaultLogo
    } as AppSettings;
  },

  async saveSettings(settings: Partial<AppSettings>) {
    try {
      const { data, error } = await supabase
        .from('settings')
        .upsert({ id: 'default', ...settings })
        .select()
        .single();
      
      if (error) {
        console.error('Erro Supabase ao salvar configurações:', error);
        throw error;
      }
      return data as AppSettings;
    } catch (err: any) {
      console.error('Erro capturado em saveSettings:', err);
      throw err;
    }
  },

  // Seed Data
  async seedInitialServices() {
    try {
      const { count } = await supabase.from('services').select('*', { count: 'exact', head: true });
      
      if (count === 0) {
        const initialServices = [
          {
            name: 'Lavagem Prata',
            description: 'Lavagem externa e limpeza interna completa com secagem, limpeza de vidros, rodas e caixa de rodas, hidratação painel + pretinho pneu',
            category: 'lavagem',
            prices: { suv: 70, hatch: 60, sedan: 65, pickup: 95 },
            duration: 90,
            active: true
          },
          {
            name: 'Lavagem Ouro',
            description: 'Lavagem externa e limpeza interna completa com secagem, limpeza de vidros, rodas e caixa de rodas, hidratação painel + pretinho pneu + cera líquida',
            category: 'lavagem',
            prices: { suv: 90, hatch: 80, sedan: 85, pickup: 120 },
            duration: 120,
            active: true
          },
          {
            name: 'Lavagem Platinum',
            description: 'Lavagem externa e limpeza interna completa com secagem, limpeza de vidros, rodas e caixa de rodas, hidratação painel + pretinho pneu + cera em pasta',
            category: 'lavagem',
            prices: { suv: 140, hatch: 120, sedan: 130, pickup: 150 },
            duration: 120,
            active: true
          },
          {
            name: 'Polimento',
            description: 'O Polimento Comercial Completo em Uma Etapa é um procedimento eficiente e otimizado para restaurar o brilho intenso da pintura automotiva e eliminar defeitos superficiais do verniz',
            category: 'polimento',
            prices: { suv: 550, hatch: 350, sedan: 450, pickup: 650 },
            duration: 360,
            active: true
          },
          {
            name: 'Polimento de Faróis',
            description: 'Polimento e Restauração de Faróis é um tratamento especializado que remove a oxidação, amarelamento e opacidade das lentes dos faróis, restaurando sua transparência original, melhorando a segurança veicular e a estética do automóvel.',
            category: 'polimento',
            prices: { suv: 120, hatch: 120, sedan: 120, pickup: 120 },
            duration: 120,
            active: true
          },
          {
            name: 'Higienização Interna a Seco Completa',
            description: 'Higienização completa interna a seco inclui (bancos, teto, colunas,forro de portas, painel, console e carpete).',
            category: 'higienizacao',
            prices: { suv: 480, hatch: 450, sedan: 460, pickup: 550 },
            duration: 360,
            active: true
          },
          {
            name: 'Lavagem de Bancos Tecido',
            description: 'Lavagem específica dos bancos do veículo',
            category: 'higienizacao',
            prices: { suv: 250, hatch: 250, sedan: 250, pickup: 250 },
            duration: 240,
            active: true
          },
          {
            name: 'Lavagem Banco Couro + Hidratação',
            description: 'Limpeza e hidratação de bancos de couro',
            category: 'higienizacao',
            prices: { suv: 280, hatch: 280, sedan: 280, pickup: 280 },
            duration: 240,
            active: true
          },
          {
            name: 'Lavagem Carpete',
            description: 'Limpeza profunda do carpete',
            category: 'higienizacao',
            prices: { suv: 100, hatch: 90, sedan: 95, pickup: 110 },
            duration: 90,
            active: true
          },
          {
            name: 'Lavagem Teto e Colunas',
            description: 'Limpeza do teto e colunas internas',
            category: 'higienizacao',
            prices: { suv: 80, hatch: 70, sedan: 75, pickup: 85 },
            duration: 120,
            active: true
          },
          {
            name: 'Lavagem de Painel',
            description: 'Limpeza completa do painel do veículo, incluindo console, instrumentos, telas, botões e todas as superfícies plásticas. Uso de produtos específicos que não danificam os materiais.',
            category: 'higienizacao',
            prices: { suv: 80, hatch: 70, sedan: 75, pickup: 90 },
            duration: 30,
            active: true
          },
          {
            name: 'Lavagem Forro de Portas',
            description: 'Limpeza dos forros internos das portas',
            category: 'higienizacao',
            prices: { suv: 60, hatch: 50, sedan: 55, pickup: 70 },
            duration: 30,
            active: true
          },
          {
            name: 'Lavagem de Motor',
            description: 'Limpeza completa do motor utilizando produtos específicos que removem graxa, óleo e sujeira sem danificar os componentes elétricos. Inclui secagem e aplicação de proteção anticorrosiva.',
            category: 'lavagem_motor',
            prices: { suv: 100, hatch: 90, sedan: 95, pickup: 120 },
            duration: 120,
            active: true
          }
        ];

        const { error } = await supabase.from('services').insert(initialServices);
        if (error) console.error('Error seeding services:', error);
      }
    } catch (e) {
      console.warn('Tabela de serviços pode não existir ainda.');
    }

    // Seed initial promotion
    try {
      const { count } = await supabase.from('promotions').select('*', { count: 'exact', head: true });
      if (count === 0) {
        await supabase.from('promotions').insert([
          {
            title: 'Promoção de Inauguração',
            description: 'Ganhe 20% de desconto na sua primeira Lavagem Ouro! Use o código BOX20 no checkout presencial.',
            active: true,
            imageUrl: 'https://images.unsplash.com/photo-1520340356584-f9917d1eea6f?auto=format&fit=crop&q=80&w=800'
          }
        ]);
      }
    } catch (e) {
      console.warn('Tabela de promoções pode não existir ainda.');
    }
  },

  // Expenses
  async getExpenses() {
    const { data, error } = await supabase
      .from('expenses')
      .select('*')
      .order('date', { ascending: false });
    
    if (error) throw error;
    return data as Expense[];
  },

  async saveExpense(expense: Partial<Expense>) {
    const { data, error } = await supabase
      .from('expenses')
      .upsert(expense)
      .select()
      .single();
    
    if (error) throw error;
    return data as Expense;
  },

  async deleteExpense(id: string) {
    const { error } = await supabase
      .from('expenses')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  },

  // Promotions
  async getPromotions() {
    const { data, error } = await supabase
      .from('promotions')
      .select('*')
      .order('createdAt', { ascending: false });
    
    if (error) throw error;
    return data as Promotion[];
  },

  async getActivePromotions() {
    const { data, error } = await supabase
      .from('promotions')
      .select('*')
      .eq('active', true)
      .order('createdAt', { ascending: false });
    
    if (error) throw error;
    return data as Promotion[];
  },

  async savePromotion(promotion: Partial<Promotion>) {
    const { data, error } = await supabase
      .from('promotions')
      .upsert(promotion)
      .select()
      .single();
    
    if (error) throw error;
    return data as Promotion;
  },

  async deletePromotion(id: string) {
    const { error } = await supabase
      .from('promotions')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  },

  // Notifications
  async getNotifications(userId: string) {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('userId', userId)
      .order('createdAt', { ascending: false });
    
    if (error) throw error;
    return data as Notification[];
  },

  async createNotification(notification: Partial<Notification>) {
    const { data, error } = await supabase
      .from('notifications')
      .insert(notification)
      .select()
      .single();
    
    if (error) throw error;
    return data as Notification;
  },

  async markNotificationAsRead(id: string) {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', id);
    
    if (error) throw error;
  },

  async deleteNotification(id: string) {
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  }
};
