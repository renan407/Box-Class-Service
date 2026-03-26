import React, { useState, useEffect } from 'react';
import { dbService } from '../services/dbService';
import { supabase } from '../lib/supabase';
import { Service, VehicleType, Appointment, Promotion, AppSettings, Notification } from '../types';
import { useAuth } from '../hooks/useAuth';
import { useLogo } from '../hooks/useLogo';
import { Calendar, Clock, Car, CheckCircle2, ChevronRight, ChevronLeft, History, X, Phone, Tag, Gift, Sparkles, Trash2, Bell, BellOff, LogOut, Plus, MessageCircle } from 'lucide-react';
import { format, addDays, isSameDay, parseISO, isAfter, startOfToday, isSunday, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isToday, addMonths, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'motion/react';
import Background from '../components/Background';

const VEHICLE_TYPES: { id: VehicleType; label: string; icon: string }[] = [
  { id: 'hatch', label: 'Hatch', icon: '🚗' },
  { id: 'sedan', label: 'Sedan', icon: '🚘' },
  { id: 'suv', label: 'SUV', icon: '🚙' },
  { id: 'pickup', label: 'Pickup', icon: '🛻' },
];

const TIME_SLOTS = ['08:00', '09:30', '11:00', '12:30', '14:00', '15:30'];

const CATEGORIES: Record<string, string> = {
  lavagem: 'Lavagens Essenciais',
  higienizacao: 'Limpeza Profunda & Higienização',
  polimento: 'Estética & Proteção',
  lavagem_motor: 'Serviços Especiais',
};

const DEFAULT_LOGO = 'https://images.unsplash.com/photo-1520340356584-f9917d1eea6f?q=80&w=200&auto=format&fit=crop';

export default function ClientDashboard() {
  const { profile, signOut, refreshProfile } = useAuth();
  const cachedLogo = useLogo();
  const [step, setStep] = useState(1);
  const [services, setServices] = useState<Service[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<VehicleType | null>(null);
  const [selectedServices, setSelectedServices] = useState<Service[]>([]);
  const getInitialDate = () => {
    const today = startOfToday();
    return isSunday(today) ? addDays(today, 1) : today;
  };

  const [selectedDate, setSelectedDate] = useState<Date>(getInitialDate());
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [occupiedSlots, setOccupiedSlots] = useState<string[]>([]);
  const [history, setHistory] = useState<Appointment[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [loading, setLoading] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [appliedPromotion, setAppliedPromotion] = useState<Promotion | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const unreadCount = notifications.filter(n => !n.read).length;

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Bom dia';
    if (hour < 18) return 'Boa tarde';
    return 'Boa noite';
  };

  const getInitials = (name: string) => {
    if (!name) return '?';
    const names = name.split(' ');
    if (names.length === 1) return names[0].substring(0, 2).toUpperCase();
    return (names[0][0] + (names[names.length - 1]?.[0] || '')).toUpperCase();
  };

  // Profile fields
  const [carModel, setCarModel] = useState(profile?.carModel || '');
  const [licensePlate, setLicensePlate] = useState(profile?.licensePlate || '');
  const [preferredVehicleType, setPreferredVehicleType] = useState<VehicleType | null>(profile?.preferredVehicleType || null);
  const [phone, setPhone] = useState(profile?.phone || '');

  useEffect(() => {
    if (profile) {
      setCarModel(profile.carModel || '');
      setLicensePlate(profile.licensePlate || '');
      setPreferredVehicleType(profile.preferredVehicleType || null);
      setPhone(profile.phone || '');
      
      // Auto-select vehicle if preferred exists
      if (profile.preferredVehicleType && !selectedVehicle) {
        setSelectedVehicle(profile.preferredVehicleType);
      }

      // Show profile modal if phone is missing (mandatory for booking)
      if (!profile.phone) {
        setShowProfile(true);
        toast('Por favor, complete seu perfil com um telefone para realizar agendamentos.', {
          icon: '📱',
          duration: 6000
        });
      }
    }
  }, [profile]);

  useEffect(() => {
    loadServices();
    loadHistory();
    loadPromotions();
    loadSettings();
    loadNotifications();
    dbService.seedInitialServices();

    // Inscrição em tempo real para mudanças nos agendamentos
    const appointmentsSubscription = supabase
      .channel('appointments-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'appointments',
          filter: profile ? `userId=eq.${profile.id}` : undefined
        },
        () => {
          loadHistory();
          if (selectedDate) loadOccupiedSlots();
        }
      )
      .subscribe();

    // Inscrição em tempo real para notificações
    const notificationsSubscription = supabase
      .channel('notifications-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: profile ? `userId=eq.${profile.id}` : undefined
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newNotif = payload.new as Notification;
            setNotifications(prev => [newNotif, ...prev]);
            toast.success(newNotif.message, {
              icon: '🔔',
              duration: 5000,
            });
          } else {
            loadNotifications();
          }
        }
      )
      .subscribe();

    return () => {
      appointmentsSubscription.unsubscribe();
      notificationsSubscription.unsubscribe();
    };
  }, [profile?.id, selectedDate]);

  useEffect(() => {
    if (selectedDate) {
      loadOccupiedSlots();
    }
  }, [selectedDate]);

  const loadServices = async () => {
    try {
      const data = await dbService.getServices();
      setServices(data);
    } catch (error) {
      toast.error('Erro ao carregar serviços');
    }
  };

  const loadHistory = async () => {
    if (!profile) return;
    try {
      const data = await dbService.getAppointments(profile.id);
      setHistory(data);
    } catch (error) {
      console.error('Erro ao carregar histórico:', error);
    }
  };

  const loadPromotions = async () => {
    try {
      const data = await dbService.getActivePromotions();
      setPromotions(data);
    } catch (error) {
      console.warn('Tabela de promoções pode não existir ainda.');
    }
  };

  const loadSettings = async () => {
    try {
      const data = await dbService.getSettings();
      setSettings(data);
    } catch (error) {
      console.error('Erro ao carregar configurações:', error);
    }
  };

  const loadOccupiedSlots = async () => {
    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const appointments = await dbService.getAppointmentsByDate(dateStr);
      
      // Contar agendamentos por horário
      const counts: Record<string, number> = {};
      appointments.forEach(a => {
        counts[a.time] = (counts[a.time] || 0) + 1;
      });
      
      // Um horário está ocupado se atingir a capacidade máxima
      const capacity = settings?.capacity || 1;
      const fullSlots = Object.keys(counts).filter(time => counts[time] >= capacity);
      
      setOccupiedSlots(fullSlots);
    } catch (error) {
      console.error('Erro ao carregar horários ocupados:', error);
    }
  };

  const loadNotifications = async () => {
    if (!profile) return;
    try {
      const data = await dbService.getNotifications(profile.id);
      setNotifications(data);
    } catch (error) {
      console.error('Erro ao carregar notificações:', error);
    }
  };

  const markAsRead = async (id: string) => {
    try {
      await dbService.markNotificationAsRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    } catch (error) {
      console.error('Erro ao marcar como lida:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const unread = notifications.filter(n => !n.read);
      await Promise.all(unread.map(n => dbService.markNotificationAsRead(n.id)));
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      toast.success('Todas as notificações marcadas como lidas');
    } catch (error) {
      console.error('Erro ao marcar todas como lidas:', error);
    }
  };

  const deleteNotification = async (id: string) => {
    try {
      await dbService.deleteNotification(id);
      setNotifications(prev => prev.filter(n => n.id !== id));
    } catch (error) {
      toast.error('Erro ao excluir notificação');
    }
  };

  const toggleService = (service: Service) => {
    setSelectedServices(prev => {
      const exists = prev.find(s => s.id === service.id);
      if (exists) {
        return prev.filter(s => s.id !== service.id);
      }
      return [...prev, service];
    });
  };

  const calculateTotalPrice = () => {
    if (!selectedVehicle || selectedServices.length === 0) return 0;
    
    let total = selectedServices.reduce((sum, s) => sum + s.prices[selectedVehicle!], 0);
    
    if (appliedPromotion) {
      if (appliedPromotion.discountType === 'percentage') {
        total = total * (1 - (appliedPromotion.discountValue || 0) / 100);
      } else if (appliedPromotion.discountType === 'fixed') {
        total = Math.max(0, total - (appliedPromotion.discountValue || 0));
      } else if (appliedPromotion.discountType === 'bundle') {
        // Only use fixed price if it's a bundle and we have the services selected
        // or if it's a general bundle price
        total = appliedPromotion.fixedPrice || total;
      }
    }
    
    return total;
  };

  const handleApplyPromotion = (promo: Promotion) => {
    setAppliedPromotion(promo);
    
    // If promo has specific services, select them
    if (promo.serviceIds && promo.serviceIds.length > 0) {
      const promoServices = services.filter(s => promo.serviceIds!.includes(s.id));
      setSelectedServices(promoServices);
    }
    
    toast.success(`Promoção "${promo.title}" aplicada!`, {
      icon: '🎁',
      duration: 4000
    });
    
    // Scroll to booking section
    const bookingSection = document.getElementById('booking-section');
    if (bookingSection) {
      bookingSection.scrollIntoView({ behavior: 'smooth' });
    }
    
    // Move to step 2 if vehicle is already selected
    if (selectedVehicle) {
      setStep(2);
    }
  };

  const handleBooking = async () => {
    if (!profile || !selectedVehicle || selectedServices.length === 0 || !selectedTime) return;

    if (!phone && !profile.phone) {
      toast.error('O telefone é obrigatório para realizar agendamentos.');
      setShowProfile(true);
      return;
    }

    setLoading(true);
    try {
      const totalPrice = calculateTotalPrice();
      
      await dbService.createAppointment({
        userId: profile.id,
        customerName: profile.displayName,
        customerPhone: phone || profile.phone || '',
        vehicleType: selectedVehicle,
        serviceIds: selectedServices.map(s => s.id),
        serviceNames: selectedServices.map(s => s.name),
        date: format(selectedDate, 'yyyy-MM-dd'),
        time: selectedTime,
        status: 'pending',
        totalPrice,
        notes: notes || (appliedPromotion ? `Promoção aplicada: ${appliedPromotion.title}` : undefined),
      });
      toast.success('Agendamento realizado com sucesso!');
      setStep(1);
      setNotes('');
      setAppliedPromotion(null);
      // Don't reset vehicle if user has a preference
      if (!profile.preferredVehicleType) {
        setSelectedVehicle(null);
      }
      setSelectedServices([]);
      setSelectedTime(null);
      loadHistory();
    } catch (error: any) {
      toast.error('Erro ao realizar agendamento: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const saveProfile = async () => {
    if (!profile) return;
    
    if (!phone) {
      toast.error('O telefone é obrigatório!');
      return;
    }

    setLoading(true);
    try {
      await dbService.updateProfile(profile.id, {
        carModel,
        licensePlate,
        preferredVehicleType: preferredVehicleType || undefined,
        phone
      });
      
      // Update local state immediately
      if (preferredVehicleType) {
        setSelectedVehicle(preferredVehicleType);
      }
      
      // Refresh global profile state
      await refreshProfile();
      
      toast.success('Perfil atualizado!');
      setShowProfile(false);
    } catch (error) {
      toast.error('Erro ao salvar perfil');
    } finally {
      setLoading(false);
    }
  };

  const cancelAppointment = async (id: string) => {
    setLoading(true);
    try {
      await dbService.updateAppointmentStatus(id, 'cancelled');
      toast.success('Agendamento cancelado');
      setCancellingId(null);
      loadHistory();
    } catch (error) {
      toast.error('Erro ao cancelar agendamento');
    } finally {
      setLoading(false);
    }
  };

  const deleteAppointment = async (id: string) => {
    setLoading(true);
    try {
      await dbService.deleteAppointment(id);
      toast.success('Agendamento removido do histórico');
      setDeletingId(null);
      loadHistory();
    } catch (error) {
      toast.error('Erro ao remover agendamento');
    } finally {
      setLoading(false);
    }
  };

  const isTimeSlotAvailable = (time: string) => {
    if (occupiedSlots.includes(time)) return false;
    
    // If today, check if time has passed
    if (isSameDay(selectedDate, new Date())) {
      const [hours, minutes] = time.split(':').map(Number);
      const slotDate = new Date();
      slotDate.setHours(hours, minutes, 0, 0);
      return isAfter(slotDate, new Date());
    }
    
    return true;
  };

  const nextStep = () => setStep(s => s + 1);
  const prevStep = () => setStep(s => s - 1);

  const servicesByCategory = services.reduce((acc, s) => {
    const cat = s.category || 'outros';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(s);
    return acc;
  }, {} as Record<string, Service[]>);

  if (showHistory) {
    return (
      <div className="min-h-screen bg-dark-bg relative overflow-y-auto p-4 md:p-8">
        <Background />
        
        <div className="max-w-4xl mx-auto relative z-10">
          <header className="flex items-center justify-between mb-8 sm:mb-12 bg-zinc-900/40 backdrop-blur-xl p-4 sm:p-6 rounded-3xl border border-white/5 shadow-2xl gap-4">
            <div className="flex items-center gap-3 sm:gap-4 min-w-0">
              <div className="w-12 h-12 sm:w-14 sm:h-14 bg-brand-blue/10 rounded-2xl flex items-center justify-center border border-brand-blue/20 flex-shrink-0">
                <History className="text-brand-blue w-6 h-6 sm:w-7 sm:h-7" />
              </div>
              <div className="min-w-0">
                <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight truncate">Meu Histórico</h1>
                <p className="text-zinc-500 text-[8px] sm:text-[10px] font-bold uppercase tracking-[0.2em] sm:tracking-[0.3em] truncate">Acompanhe seus agendamentos</p>
              </div>
            </div>
            <button 
              onClick={() => setShowHistory(false)} 
              className="px-4 sm:px-6 py-2.5 sm:py-3 bg-zinc-800/50 hover:bg-zinc-800 text-white text-[10px] sm:text-xs font-black uppercase tracking-widest rounded-2xl transition-all border border-white/5 active:scale-95 flex-shrink-0"
            >
              Voltar
            </button>
          </header>

          <div className="space-y-6">
            {history.length === 0 ? (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center py-24 glass-card border-white/5"
              >
                <div className="w-20 h-20 bg-zinc-900 rounded-full flex items-center justify-center mx-auto mb-6 border border-white/5">
                  <History className="text-zinc-700 w-10 h-10" />
                </div>
                <p className="text-zinc-500 font-bold uppercase tracking-widest text-sm">Nenhum agendamento encontrado.</p>
              </motion.div>
            ) : (
              history.map((app, index) => (
                <motion.div 
                  key={app.id} 
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="glass-card p-8 flex flex-col md:flex-row md:items-center justify-between gap-8 border-white/5 hover:border-white/10 transition-all group"
                >
                  <div className="space-y-4 flex-1">
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] font-black px-3 py-1 bg-brand-blue/10 text-brand-blue rounded-lg border border-brand-blue/10 uppercase tracking-[0.2em]">
                        {app.vehicleType}
                      </span>
                      <div className="w-1 h-1 bg-zinc-800 rounded-full" />
                      <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest">
                        {format(parseISO(app.date), 'dd/MM/yyyy')} às {app.time}
                      </span>
                    </div>
                    
                    <div>
                      <h3 className="text-xl font-black text-white leading-tight mb-2 group-hover:text-brand-blue transition-colors">
                        {app.serviceNames?.join(' + ')}
                      </h3>
                      <p className="text-2xl font-black text-white/90">R$ {app.totalPrice.toFixed(2)}</p>
                    </div>
                    
                    {app.notes && (
                      <div className="p-4 bg-zinc-950/50 rounded-2xl border border-white/5 italic">
                        <p className="text-[10px] text-zinc-600 uppercase font-black tracking-widest mb-2 not-italic">Observações do Cliente</p>
                        <p className="text-sm text-zinc-400 leading-relaxed">"{app.notes}"</p>
                      </div>
                    )}

                    {app.status === 'completed' && (app.photoBefore || app.photoAfter) && (
                      <div className="grid grid-cols-2 gap-4 pt-2">
                        {app.photoBefore && (
                          <div className="space-y-2">
                            <span className="text-[10px] text-zinc-600 uppercase font-black tracking-widest ml-1">Estado Inicial</span>
                            <div className="aspect-video rounded-2xl overflow-hidden border border-white/5 shadow-2xl">
                              <img src={app.photoBefore} alt="Antes" className="w-full h-full object-cover hover:scale-110 transition-transform duration-700" referrerPolicy="no-referrer" />
                            </div>
                          </div>
                        )}
                        {app.photoAfter && (
                          <div className="space-y-2">
                            <span className="text-[10px] text-zinc-600 uppercase font-black tracking-widest ml-1">Resultado Final</span>
                            <div className="aspect-video rounded-2xl overflow-hidden border border-brand-blue/20 shadow-2xl shadow-blue-500/10">
                              <img src={app.photoAfter} alt="Depois" className="w-full h-full object-cover hover:scale-110 transition-transform duration-700" referrerPolicy="no-referrer" />
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col md:items-end gap-4 min-w-[160px]">
                    <div className={`w-full px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] text-center border ${
                      app.status === 'confirmed' ? 'bg-green-500/10 text-green-500 border-green-500/20' :
                      app.status === 'pending' ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' :
                      app.status === 'washing' ? 'bg-blue-500/10 text-blue-500 border-blue-500/20 animate-pulse' :
                      app.status === 'completed' ? 'bg-zinc-900 text-zinc-500 border-white/5' :
                      'bg-red-500/10 text-red-500 border-red-500/20'
                    }`}>
                      {app.status === 'washing' ? 'Lavando Veículo' : 
                       app.status === 'completed' ? 'Serviço Finalizado' :
                       app.status === 'pending' ? 'Aguardando Aprovação' :
                       app.status === 'confirmed' ? 'Agendamento Confirmado' : 'Cancelado'}
                    </div>
                    
                    {(app.status === 'pending' || app.status === 'confirmed') && (
                      <button 
                        onClick={() => setCancellingId(app.id)}
                        className="w-full py-3 text-[10px] font-black uppercase tracking-widest text-red-500/60 hover:text-red-500 hover:bg-red-500/5 rounded-xl transition-all"
                      >
                        Cancelar Agendamento
                      </button>
                    )}

                    {(app.status === 'completed' || app.status === 'cancelled') && (
                      <button 
                        onClick={() => setDeletingId(app.id)}
                        className="w-full py-3 text-[10px] font-black uppercase tracking-widest text-zinc-600 hover:text-zinc-400 hover:bg-white/5 rounded-xl transition-all flex items-center justify-center gap-2"
                      >
                        <Trash2 className="w-3 h-3" />
                        Remover do Histórico
                      </button>
                    )}
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </div>

        {/* Modals in History View */}
        <AnimatePresence>
          {cancellingId && (
            <div className="fixed inset-0 z-[100] overflow-y-auto">
              <div className="flex min-h-full items-start sm:items-center justify-center p-4">
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setCancellingId(null)}
                  className="fixed inset-0 bg-black/90 backdrop-blur-md cursor-pointer"
                />
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: 20 }}
                  onClick={(e) => e.stopPropagation()}
                  className="glass-card w-full max-w-sm p-10 text-center relative z-10 my-8 sm:my-auto"
                >
                <div className="absolute top-0 left-0 w-full h-1 bg-red-500/50" />
                <div className="w-20 h-20 bg-red-500/10 rounded-3xl flex items-center justify-center mx-auto mb-6 border border-red-500/20 shadow-2xl shadow-red-500/5 rotate-3">
                  <X className="text-red-500 w-10 h-10" />
                </div>
                <h3 className="text-2xl font-black text-white mb-3 tracking-tight">Cancelar?</h3>
                <p className="text-zinc-500 mb-10 text-sm leading-relaxed">
                  Esta ação não pode ser desfeita e o horário será liberado imediatamente.
                </p>
                <div className="flex flex-col gap-3">
                  <button 
                    onClick={() => cancelAppointment(cancellingId)}
                    disabled={loading}
                    className="w-full py-5 bg-red-600 hover:bg-red-700 text-white text-xs font-black uppercase tracking-widest rounded-2xl transition-all shadow-xl shadow-red-600/20 disabled:opacity-50"
                  >
                    {loading ? 'Processando...' : 'Confirmar Cancelamento'}
                  </button>
                  <button 
                    onClick={() => setCancellingId(null)}
                    className="w-full py-5 bg-zinc-900/50 hover:bg-zinc-800 text-zinc-500 hover:text-white text-xs font-black uppercase tracking-widest rounded-2xl transition-all border border-white/5"
                  >
                    Manter Agendamento
                  </button>
                </div>
              </motion.div>
            </div>
          </div>
        )}

          {deletingId && (
            <div className="fixed inset-0 z-[100] overflow-y-auto">
              <div className="flex min-h-full items-start sm:items-center justify-center p-4">
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setDeletingId(null)}
                  className="fixed inset-0 bg-black/90 backdrop-blur-md cursor-pointer"
                />
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: 20 }}
                  onClick={(e) => e.stopPropagation()}
                  className="glass-card w-full max-w-sm p-10 text-center relative z-10 my-8 sm:my-auto"
                >
                <div className="absolute top-0 left-0 w-full h-1 bg-zinc-500/50" />
                <div className="w-20 h-20 bg-zinc-500/10 rounded-3xl flex items-center justify-center mx-auto mb-6 border border-zinc-500/20 shadow-2xl shadow-zinc-500/5 rotate-3">
                  <Trash2 className="text-zinc-500 w-10 h-10" />
                </div>
                <h3 className="text-2xl font-black text-white mb-3 tracking-tight">Remover?</h3>
                <p className="text-zinc-500 mb-10 text-sm leading-relaxed">
                  Este agendamento será removido permanentemente do seu histórico.
                </p>
                <div className="flex flex-col gap-3">
                  <button 
                    onClick={() => deleteAppointment(deletingId)}
                    disabled={loading}
                    className="w-full py-5 bg-zinc-700 hover:bg-zinc-600 text-white text-xs font-black uppercase tracking-widest rounded-2xl transition-all shadow-xl shadow-zinc-700/20 disabled:opacity-50"
                  >
                    {loading ? 'Removendo...' : 'Confirmar Remoção'}
                  </button>
                  <button 
                    onClick={() => setDeletingId(null)}
                    className="w-full py-5 bg-zinc-900/50 hover:bg-zinc-800 text-zinc-500 hover:text-white text-xs font-black uppercase tracking-widest rounded-2xl transition-all border border-white/5"
                  >
                    Manter no Histórico
                  </button>
                </div>
              </motion.div>
            </div>
          </div>
        )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-bg relative overflow-y-auto">
      <Background />

      <div className="relative z-10 max-w-5xl mx-auto p-4 md:p-8">
        <header className="flex items-center justify-between mb-8 bg-zinc-900/40 backdrop-blur-xl p-3 rounded-2xl border border-white/5 shadow-2xl">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-brand-blue rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20 border border-white/10 flex-shrink-0">
              <span className="text-xs font-black text-white tracking-tighter">
                {getInitials(profile?.displayName || '')}
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">{getGreeting()}</p>
              <h1 className="text-xs font-black text-white tracking-tight truncate">{profile?.displayName || 'Cliente'}</h1>
            </div>
          </div>
          
          <div className="flex items-center gap-1">
            <button 
              onClick={() => setShowNotifications(!showNotifications)}
              className="p-2 hover:bg-zinc-800 rounded-xl transition-all relative group"
              title="Notificações"
            >
              <Bell className={`w-4 h-4 ${unreadCount > 0 ? 'text-brand-blue animate-pulse' : 'text-zinc-400'} group-hover:text-brand-blue transition-colors`} />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-brand-blue rounded-full shadow-lg shadow-brand-blue/50" />
              )}
            </button>
            <button 
              onClick={() => setShowHistory(true)} 
              className="p-2 hover:bg-zinc-800 rounded-xl transition-all relative group"
              title="Histórico"
            >
              <History className="w-4 h-4 text-zinc-400 group-hover:text-brand-blue transition-colors" />
              {notifications.some(n => n.type === 'status_change' && !n.read) && (
                <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-blue-500 rounded-full animate-ping"></span>
              )}
            </button>
            <button 
              onClick={() => setShowProfile(true)} 
              className="p-2 hover:bg-zinc-800 rounded-xl transition-all group"
              title="Meu Perfil"
            >
              <Car className="w-4 h-4 text-zinc-400 group-hover:text-brand-blue transition-colors" />
            </button>
            <button 
              onClick={() => {
                const phone = settings?.whatsappNumber?.replace(/\D/g, '') || '5511999999999';
                window.open(`https://wa.me/${phone}`, '_blank');
              }} 
              className="p-2 hover:bg-emerald-500/10 rounded-xl transition-all group"
              title="WhatsApp"
            >
              <MessageCircle className="w-4 h-4 text-zinc-400 group-hover:text-emerald-500 transition-colors" />
            </button>
            <div className="w-px h-4 bg-white/5 mx-1" />
            <button 
              onClick={signOut} 
              className="p-2 hover:bg-red-500/10 rounded-xl transition-all group"
              title="Sair"
            >
              <LogOut className="w-4 h-4 text-zinc-400 group-hover:text-red-500 transition-colors" />
            </button>
          </div>
        </header>

        {/* Barra de Ações Rápidas */}
        <div className="flex gap-2 mb-8 overflow-x-auto no-scrollbar pb-2">
          <button 
            onClick={() => setStep(1)} 
            className={`flex-shrink-0 px-4 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${
              step === 1 ? 'bg-brand-blue text-white shadow-lg shadow-blue-500/20' : 'bg-zinc-900/40 text-zinc-500 border border-white/5 hover:bg-zinc-800'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            Agendar
          </button>
          <button 
            onClick={() => setShowHistory(true)} 
            className="flex-shrink-0 px-4 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 bg-zinc-900/40 text-zinc-500 border border-white/5 hover:bg-zinc-800 relative"
          >
            <History className="w-3.5 h-3.5" />
            Histórico
            {notifications.some(n => n.type === 'status_change' && !n.read) && (
              <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-blue-500 rounded-full animate-ping"></span>
            )}
          </button>
          <button 
            onClick={() => setShowProfile(true)} 
            className="flex-shrink-0 px-4 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 bg-zinc-900/40 text-zinc-500 border border-white/5 hover:bg-zinc-800"
          >
            <Car className="w-3.5 h-3.5" />
            Perfil
          </button>
        </div>

        {/* Programa de Fidelidade */}
        {settings?.loyaltyEnabled && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 glass-card p-6 border-brand-blue/20 bg-brand-blue/5 relative overflow-hidden group"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 relative z-10">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-brand-blue rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20 flex-shrink-0">
                  <CheckCircle2 className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white tracking-tight">Fidelidade Premium</h3>
                  <p className="text-[10px] text-zinc-400 font-medium">
                    {profile?.washCount && profile.washCount % settings.loyaltyGoal === 0 && profile.washCount > 0 ? (
                      <span className="text-emerald-400">Recompensa disponível!</span>
                    ) : (
                      (() => {
                        const remaining = settings.loyaltyGoal - ((profile?.washCount || 0) % settings.loyaltyGoal);
                        const reward = settings.loyaltyReward;
                        const template = settings.loyaltyMessageTemplate || 'Faltam {remaining} lavagens para sua {reward}';
                        
                        const parts = template.split(/(\{remaining\}|\{reward\})/g);
                        
                        return parts.map((part, i) => {
                          if (part === '{remaining}') return <span key={i} className="text-brand-blue font-black">{remaining}</span>;
                          if (part === '{reward}') return <span key={i} className="text-white font-black">{reward}</span>;
                          return part;
                        });
                      })()
                    )}
                  </p>
                </div>
              </div>

              <div className="flex-1 max-w-xs space-y-2">
                <div className="flex justify-between text-[9px] font-black uppercase tracking-widest text-zinc-500">
                  <span>Progresso</span>
                  <span className="text-brand-blue">
                    {profile?.washCount && profile.washCount % settings.loyaltyGoal === 0 && profile.washCount > 0 
                      ? settings.loyaltyGoal 
                      : (profile?.washCount || 0) % settings.loyaltyGoal} / {settings.loyaltyGoal}
                  </span>
                </div>
                <div className="h-2 bg-zinc-950 rounded-full overflow-hidden border border-white/5 p-0.5">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${(profile?.washCount && profile.washCount % settings.loyaltyGoal === 0 && profile.washCount > 0 
                      ? 1 
                      : ((profile?.washCount || 0) % settings.loyaltyGoal) / settings.loyaltyGoal) * 100}%` }}
                    className="h-full bg-brand-blue rounded-full shadow-[0_0_10px_rgba(37,99,235,0.5)]"
                  />
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Seção de Promoções */}
        {promotions.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-12"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 bg-amber-500/10 rounded-lg flex items-center justify-center border border-amber-500/20">
                <Tag className="w-4 h-4 text-amber-500" />
              </div>
              <h3 className="text-lg font-black text-white uppercase tracking-widest">Ofertas Especiais</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {promotions.map((promo) => (
                <motion.div 
                  key={promo.id}
                  whileHover={{ y: -4 }}
                  onClick={() => handleApplyPromotion(promo)}
                  className={`glass-card p-6 border-white/5 bg-zinc-900/40 relative overflow-hidden group cursor-pointer transition-all ${appliedPromotion?.id === promo.id ? 'ring-2 ring-brand-blue border-brand-blue/50 bg-brand-blue/5' : ''}`}
                >
                  <div className="flex gap-6">
                    {promo.imageUrl && (
                      <div className="w-24 h-24 rounded-2xl overflow-hidden flex-shrink-0 border border-white/5">
                        <img 
                          src={promo.imageUrl} 
                          alt={promo.title} 
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                    )}
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Sparkles className="w-3 h-3 text-amber-500" />
                          <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest">Promoção Ativa</span>
                        </div>
                        {promo.discountType === 'percentage' && (
                          <span className="bg-emerald-500/10 text-emerald-500 text-[10px] font-black px-2 py-1 rounded-lg border border-emerald-500/20">-{promo.discountValue}% OFF</span>
                        )}
                        {promo.discountType === 'fixed' && (
                          <div className="flex flex-col items-end gap-1">
                            <span className="bg-emerald-500/10 text-emerald-500 text-[10px] font-black px-2 py-1 rounded-lg border border-emerald-500/20">-R$ {promo.discountValue} OFF</span>
                            {selectedVehicle && promo.serviceIds && promo.serviceIds.length > 0 && (
                              <span className="text-[8px] font-bold text-emerald-500/60 uppercase tracking-widest">
                                ~{((promo.discountValue! / services.filter(s => promo.serviceIds!.includes(s.id)).reduce((sum, s) => sum + s.prices[selectedVehicle], 0)) * 100).toFixed(0)}% OFF
                              </span>
                            )}
                          </div>
                        )}
                        {promo.discountType === 'bundle' && (
                          <div className="flex flex-col items-end gap-1">
                            <span className="bg-brand-blue/10 text-brand-blue text-[10px] font-black px-2 py-1 rounded-lg border border-brand-blue/20">R$ {promo.fixedPrice}</span>
                            {selectedVehicle && promo.serviceIds && promo.serviceIds.length > 0 && (
                              <span className="text-[8px] font-bold text-brand-blue/60 uppercase tracking-widest">
                                ~{( (1 - (promo.fixedPrice! / services.filter(s => promo.serviceIds!.includes(s.id)).reduce((sum, s) => sum + s.prices[selectedVehicle], 0))) * 100).toFixed(0)}% OFF
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      <h4 className="text-lg font-black text-white mb-1 leading-tight">{promo.title}</h4>
                      <p className="text-xs text-zinc-500 leading-relaxed line-clamp-1 mb-3">{promo.description}</p>
                      
                      {/* Serviços incluídos */}
                      {promo.serviceIds && promo.serviceIds.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-4">
                          {promo.serviceIds.slice(0, 3).map(sid => {
                            const s = services.find(srv => srv.id === sid);
                            return s ? (
                              <span key={sid} className="text-[7px] font-black text-zinc-600 uppercase tracking-widest bg-zinc-950 px-1.5 py-0.5 rounded border border-white/5">
                                {s.name}
                              </span>
                            ) : null;
                          })}
                          {promo.serviceIds.length > 3 && (
                            <span className="text-[7px] font-black text-zinc-600 uppercase tracking-widest bg-zinc-950 px-1.5 py-0.5 rounded border border-white/5">
                              +{promo.serviceIds.length - 3}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Exibição de Preço */}
                      <div className="flex items-baseline gap-2 mb-4">
                        {(() => {
                          const promoServices = services.filter(s => promo.serviceIds?.includes(s.id));
                          if (promoServices.length === 0) return null;

                          if (selectedVehicle) {
                            const original = promoServices.reduce((sum, s) => sum + s.prices[selectedVehicle], 0);
                            let discounted = original;
                            if (promo.discountType === 'percentage') discounted = original * (1 - promo.discountValue! / 100);
                            else if (promo.discountType === 'fixed') discounted = Math.max(0, original - promo.discountValue!);
                            else if (promo.discountType === 'bundle') discounted = promo.fixedPrice!;

                            return (
                              <>
                                <span className="text-2xl font-black text-white">R$ {discounted.toFixed(2)}</span>
                                <span className="text-xs font-bold text-zinc-600 line-through">R$ {original.toFixed(2)}</span>
                              </>
                            );
                          } else {
                            // Show "Starting from"
                            const vehicleTypes: VehicleType[] = ['hatch', 'sedan', 'suv', 'pickup'];
                            const minOriginal = Math.min(...vehicleTypes.map(v => promoServices.reduce((sum, s) => sum + s.prices[v], 0)));
                            
                            let minDiscounted = minOriginal;
                            if (promo.discountType === 'percentage') minDiscounted = minOriginal * (1 - promo.discountValue! / 100);
                            else if (promo.discountType === 'fixed') minDiscounted = Math.max(0, minOriginal - promo.discountValue!);
                            else if (promo.discountType === 'bundle') minDiscounted = promo.fixedPrice!;

                            return (
                              <div className="flex flex-col">
                                <span className="text-[8px] font-black text-zinc-600 uppercase tracking-widest">A partir de</span>
                                <span className="text-2xl font-black text-white">R$ {minDiscounted.toFixed(2)}</span>
                              </div>
                            );
                          }
                        })()}
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black text-brand-blue uppercase tracking-widest group-hover:translate-x-1 transition-transform">Ativar Oferta</span>
                        <ChevronRight className="w-3 h-3 text-brand-blue" />
                      </div>
                    </div>
                  </div>
                  <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="w-8 h-8 bg-brand-blue rounded-full flex items-center justify-center shadow-lg shadow-blue-500/40">
                      <Gift className="w-4 h-4 text-white" />
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Indicador de Passos (Stepper) */}
        <div id="booking-section" className="flex items-center justify-between mb-20 max-w-xl mx-auto relative px-4">
          <div className="absolute top-1/2 left-0 right-0 h-[1px] bg-white/5 -translate-y-1/2 z-0" />
          <motion.div 
            className="absolute top-1/2 left-0 h-[2px] bg-brand-blue -translate-y-1/2 z-0 shadow-[0_0_15px_rgba(37,99,235,0.5)]" 
            initial={{ width: 0 }}
            animate={{ width: `${((step - 1) / 2) * 100}%` }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          />
          
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex flex-col items-center relative z-10">
              <motion.div 
                animate={{ 
                  scale: step === i ? 1.15 : 1,
                  backgroundColor: step >= i ? '#2563eb' : '#09090b',
                  borderColor: step >= i ? '#3b82f6' : 'rgba(255,255,255,0.05)'
                }}
                className={`w-14 h-14 rounded-2xl flex items-center justify-center font-black transition-all duration-500 border shadow-2xl ${
                  step >= i ? 'text-white shadow-blue-500/30' : 'text-zinc-600'
                }`}
              >
                {step > i ? (
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>
                    <CheckCircle2 className="w-7 h-7" />
                  </motion.div>
                ) : (
                  <span className="text-lg">{i}</span>
                )}
              </motion.div>
              <motion.span 
                animate={{ 
                  color: step >= i ? '#fff' : '#52525b',
                  opacity: step >= i ? 1 : 0.5,
                  y: step === i ? 12 : 10
                }}
                className="absolute -bottom-10 text-[10px] font-black uppercase tracking-[0.3em] whitespace-nowrap"
              >
                {i === 1 ? 'Veículo' : i === 2 ? 'Data' : 'Revisão'}
              </motion.span>
            </div>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -30 }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="space-y-16"
            >
              <section>
                <div className="flex items-center gap-4 mb-8">
                  <div className="w-1.5 h-8 bg-brand-blue rounded-full shadow-[0_0_15px_rgba(37,99,235,0.6)]" />
                  <div>
                    <h2 className="text-2xl font-black text-white tracking-tight">Selecione seu Veículo</h2>
                    <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-[0.3em]">Escolha a categoria que melhor se adapta</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  {VEHICLE_TYPES.map((v) => (
                    <motion.button
                      key={v.id}
                      whileHover={{ y: -5, scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => {
                        setSelectedVehicle(v.id);
                        setSelectedServices([]);
                      }}
                      className={`p-10 glass-card flex flex-col items-center gap-6 transition-all relative overflow-hidden group ${
                        selectedVehicle === v.id 
                          ? 'border-brand-blue/50 bg-brand-blue/10 shadow-2xl shadow-blue-500/10' 
                          : 'hover:border-white/10 hover:bg-white/[0.02]'
                      }`}
                    >
                      {selectedVehicle === v.id && (
                        <motion.div 
                          layoutId="active-vehicle"
                          className="absolute top-4 right-4"
                        >
                          <div className="w-6 h-6 bg-brand-blue rounded-full flex items-center justify-center shadow-lg shadow-blue-500/40">
                            <CheckCircle2 className="w-4 h-4 text-white" />
                          </div>
                        </motion.div>
                      )}
                      <span className="text-6xl group-hover:scale-110 transition-transform duration-500 filter drop-shadow-2xl">{v.icon}</span>
                      <span className={`font-black text-xs uppercase tracking-[0.2em] transition-colors ${
                        selectedVehicle === v.id ? 'text-brand-blue' : 'text-zinc-500'
                      }`}>{v.label}</span>
                      
                      {/* Decorative element */}
                      <div className={`absolute -bottom-4 -right-4 w-16 h-16 rounded-full blur-2xl transition-opacity duration-500 ${
                        selectedVehicle === v.id ? 'bg-brand-blue/20 opacity-100' : 'bg-white/5 opacity-0'
                      }`} />
                    </motion.button>
                  ))}
                </div>
              </section>

              {selectedVehicle && (
                <section className="space-y-10">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-1 h-6 bg-brand-blue rounded-full" />
                    <h2 className="text-xl font-black text-white tracking-tight">Escolha os Serviços</h2>
                  </div>
                  
                  {Object.entries(servicesByCategory).map(([cat, catServices]) => (
                    <div key={cat} className="space-y-6">
                      <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.3em] ml-1">
                        {CATEGORIES[cat] || cat}
                      </h3>
                      <div className="grid gap-4">
                        {(catServices as Service[]).map((s) => {
                          const isSelected = selectedServices.some(item => item.id === s.id);
                          return (
                            <button
                              key={s.id}
                              onClick={() => toggleService(s)}
                              className={`p-6 glass-card flex items-center justify-between text-left transition-all relative group overflow-hidden ${
                                isSelected 
                                  ? 'border-brand-blue bg-brand-blue/10 shadow-lg shadow-blue-500/5' 
                                  : 'hover:border-zinc-700 hover:bg-zinc-900/40'
                              }`}
                            >
                              {isSelected && (
                                <div className="absolute left-0 top-0 bottom-0 w-1 bg-brand-blue" />
                              )}
                              <div className="flex-1 pr-6">
                                <div className="flex items-center gap-3 mb-2">
                                  <h4 className="font-black text-lg text-white">{s.name}</h4>
                                  {isSelected && <CheckCircle2 className="w-5 h-5 text-brand-blue" />}
                                </div>
                                <p className="text-zinc-500 text-sm leading-relaxed">
                                  {s.description}
                                </p>
                                <div className="flex items-center gap-4 mt-4">
                                  <div className="flex items-center gap-1.5 text-[10px] font-black text-zinc-600 uppercase tracking-widest">
                                    <Clock className="w-3 h-3" />
                                    {s.duration} min
                                  </div>
                                </div>
                              </div>
                              <div className="text-right flex flex-col items-end gap-1">
                                <span className="text-xl font-black text-brand-blue">
                                  R$ {s.prices[selectedVehicle].toFixed(2)}
                                </span>
                                <div className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-lg ${
                                  isSelected ? 'bg-brand-blue text-white' : 'bg-zinc-900 text-zinc-600'
                                }`}>
                                  {isSelected ? 'Selecionado' : 'Adicionar'}
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </section>
              )}

              <div className="flex justify-end sticky bottom-6 z-20">
                <button
                  disabled={!selectedVehicle || selectedServices.length === 0}
                  onClick={nextStep}
                  className="bg-brand-blue hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black uppercase tracking-widest flex items-center gap-3 px-10 py-5 rounded-2xl shadow-2xl shadow-blue-500/40 transition-all active:scale-95"
                >
                  Próximo Passo <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-12"
            >
              <section>
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-3">
                    <div className="w-1 h-6 bg-brand-blue rounded-full" />
                    <h2 className="text-xl font-black text-white tracking-tight">Escolha a Data</h2>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                      className="p-2 bg-zinc-900/50 hover:bg-zinc-800 rounded-xl border border-white/5 transition-all"
                    >
                      <ChevronLeft className="w-4 h-4 text-zinc-400" />
                    </button>
                    <span className="text-[10px] font-black uppercase tracking-widest text-white min-w-[100px] text-center">
                      {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
                    </span>
                    <button 
                      onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                      className="p-2 bg-zinc-900/50 hover:bg-zinc-800 rounded-xl border border-white/5 transition-all"
                    >
                      <ChevronRight className="w-4 h-4 text-zinc-400" />
                    </button>
                  </div>
                </div>

                <div className="glass-card p-4 md:p-8 bg-zinc-900/40 border-white/5">
                  <div className="grid grid-cols-7 mb-4">
                    {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((day) => (
                      <div key={day} className="text-center text-[10px] font-black uppercase tracking-widest text-zinc-600">
                        {day}
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-7 gap-1 md:gap-2">
                    {(() => {
                      const monthStart = startOfMonth(currentMonth);
                      const monthEnd = endOfMonth(monthStart);
                      const startDate = startOfWeek(monthStart);
                      const endDate = endOfWeek(monthEnd);
                      const calendarDays = eachDayOfInterval({ start: startDate, end: endDate });

                      return calendarDays.map((date, i) => {
                        const isSelected = isSameDay(date, selectedDate);
                        const isCurrentMonth = isSameMonth(date, monthStart);
                        const isPast = isAfter(startOfToday(), date) && !isToday(date);
                        const isSun = isSunday(date);
                        const disabled = !isCurrentMonth || isPast || isSun;

                        return (
                          <button
                            key={i}
                            disabled={disabled}
                            onClick={() => setSelectedDate(date)}
                            className={`aspect-square flex flex-col items-center justify-center rounded-xl transition-all relative group ${
                              isSelected 
                                ? 'bg-brand-blue text-white shadow-lg shadow-blue-500/20 z-10 scale-105' 
                                : disabled
                                  ? 'text-zinc-800 cursor-not-allowed'
                                  : 'hover:bg-white/5 text-zinc-400'
                            }`}
                          >
                            <span className={`text-sm font-black ${isSelected ? 'text-white' : ''}`}>
                              {format(date, 'd')}
                            </span>
                            {isToday(date) && !isSelected && (
                              <div className="absolute bottom-1.5 w-1 h-1 bg-brand-blue rounded-full" />
                            )}
                            {isSun && isCurrentMonth && (
                              <div className="absolute top-1 right-1 w-1 h-1 bg-red-500/30 rounded-full" />
                            )}
                          </button>
                        );
                      });
                    })()}
                  </div>
                  
                  <div className="mt-8 flex items-center gap-6 justify-center border-t border-white/5 pt-6">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-brand-blue rounded-full" />
                      <span className="text-[8px] font-black uppercase tracking-widest text-zinc-500">Hoje</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-zinc-800 rounded-full" />
                      <span className="text-[8px] font-black uppercase tracking-widest text-zinc-500">Indisponível</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-red-500/30 rounded-full" />
                      <span className="text-[8px] font-black uppercase tracking-widest text-zinc-500">Domingo</span>
                    </div>
                  </div>
                </div>
              </section>

              <section>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-1 h-6 bg-brand-blue rounded-full" />
                  <h2 className="text-xl font-black text-white tracking-tight">Horários Disponíveis</h2>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
                  {TIME_SLOTS.map((time) => {
                    const available = isTimeSlotAvailable(time);
                    const isSelected = selectedTime === time;
                    return (
                      <button
                        key={time}
                        disabled={!available}
                        onClick={() => setSelectedTime(time)}
                        className={`p-5 rounded-2xl border font-black transition-all text-sm tracking-widest ${
                          !available 
                            ? 'bg-zinc-950/50 border-zinc-900 text-zinc-800 cursor-not-allowed opacity-30' :
                          isSelected 
                            ? 'bg-brand-blue border-brand-blue text-white shadow-lg shadow-blue-500/30 scale-105' :
                            'bg-zinc-900/50 border-white/5 text-zinc-400 hover:border-zinc-600 hover:text-white'
                        }`}
                      >
                        {time}
                      </button>
                    );
                  })}
                </div>
              </section>

              <div className="flex justify-between items-center pt-8">
                <button onClick={prevStep} className="text-zinc-500 hover:text-white font-black uppercase tracking-widest text-xs transition-colors">
                  Voltar
                </button>
                <button
                  disabled={!selectedTime}
                  onClick={nextStep}
                  className="bg-brand-blue hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black uppercase tracking-widest flex items-center gap-3 px-10 py-5 rounded-2xl shadow-2xl shadow-blue-500/40 transition-all active:scale-95"
                >
                  Revisar <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              <div className="glass-card p-10 space-y-10 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-brand-blue/10 rounded-full blur-3xl -mr-16 -mt-16" />
                
                <div className="text-center space-y-2">
                  <h2 className="text-3xl font-black text-white tracking-tight">Resumo Premium</h2>
                  <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-[0.4em]">Confirme os detalhes abaixo</p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                  <div className="space-y-2">
                    <p className="text-zinc-600 text-[10px] font-black uppercase tracking-widest">Veículo Selecionado</p>
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">{VEHICLE_TYPES.find(v => v.id === selectedVehicle)?.icon}</span>
                      <p className="text-xl font-black text-white capitalize">{selectedVehicle}</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-zinc-600 text-[10px] font-black uppercase tracking-widest">Serviços</p>
                    <div className="space-y-2">
                      {selectedServices.map(s => (
                        <div key={s.id} className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 bg-brand-blue rounded-full" />
                          <p className="text-lg font-black text-white">{s.name}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-zinc-600 text-[10px] font-black uppercase tracking-widest">Data & Horário</p>
                    <div className="flex items-center gap-3">
                      <Calendar className="w-5 h-5 text-brand-blue" />
                      <p className="text-xl font-black text-white">
                        {format(selectedDate, "dd 'de' MMMM", { locale: ptBR })} às {selectedTime}
                      </p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <p className="text-zinc-600 text-[10px] font-black uppercase tracking-widest">Total Estimado</p>
                      {appliedPromotion && (
                        <span className="bg-emerald-500/10 text-emerald-500 text-[8px] font-black px-1.5 py-0.5 rounded border border-emerald-500/20">PROMO ATIVA</span>
                      )}
                    </div>
                    <div className="flex items-baseline gap-3">
                      <p className="text-4xl font-black text-brand-blue">
                        R$ {calculateTotalPrice().toFixed(2)}
                      </p>
                      {appliedPromotion && (
                        <p className="text-lg font-bold text-zinc-600 line-through tracking-tighter">
                          R$ {selectedVehicle ? selectedServices.reduce((sum, s) => sum + s.prices[selectedVehicle!], 0).toFixed(2) : '0.00'}
                        </p>
                      )}
                    </div>
                    {appliedPromotion && (
                      <div className="flex items-center gap-2 text-emerald-500 text-[10px] font-black uppercase tracking-widest">
                        <Tag className="w-3 h-3" />
                        <span>Economia de R$ {(selectedServices.reduce((sum, s) => sum + s.prices[selectedVehicle!], 0) - calculateTotalPrice()).toFixed(2)}</span>
                        <button 
                          onClick={() => setAppliedPromotion(null)}
                          className="ml-2 text-zinc-500 hover:text-red-500 transition-colors"
                        >
                          (Remover)
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-10 border-t border-white/5 space-y-4">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] ml-1">
                    Observações Especiais (Opcional)
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Ex: Gostaria de focar na limpeza dos bancos de couro..."
                    className="w-full bg-zinc-950/50 border border-white/5 rounded-2xl p-6 text-sm text-zinc-300 focus:ring-2 focus:ring-brand-blue/50 outline-none transition-all min-h-[120px] resize-none placeholder:text-zinc-800"
                  />
                </div>
              </div>

              <div className="flex justify-between items-center pt-4">
                <button onClick={prevStep} className="text-zinc-500 hover:text-white font-black uppercase tracking-widest text-xs transition-colors">
                  Voltar
                </button>
                <button
                  disabled={loading}
                  onClick={handleBooking}
                  className="bg-brand-blue hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black uppercase tracking-widest flex items-center gap-3 px-4 py-4 rounded-2xl shadow-2xl shadow-blue-500/40 transition-all active:scale-95 text-xs"
                >
                  {loading ? (
                    <div className="flex items-center gap-3">
                      <div className="w-5 h-5 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Agendando...</span>
                    </div>
                  ) : 'Finalizar Agendamento'}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Modais */}
        <AnimatePresence>
          {/* Modal de Notificações */}
          <AnimatePresence>
            {showNotifications && (
              <div className="fixed inset-0 z-[110] overflow-y-auto">
                <div className="flex min-h-full items-start sm:items-center justify-center p-4">
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setShowNotifications(false)}
                    className="fixed inset-0 bg-black/90 backdrop-blur-xl cursor-pointer"
                  />
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 20 }}
                    onClick={(e) => e.stopPropagation()}
                    className="glass-card w-full max-w-md relative z-10 my-8 sm:my-auto overflow-hidden"
                  >
                    <div className="p-4 sm:p-6 border-b border-white/5 flex items-center justify-between bg-zinc-950/50 sticky top-0 z-20">
                      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                        <div className="w-9 h-9 sm:w-10 sm:h-10 bg-brand-blue/10 rounded-xl flex items-center justify-center text-brand-blue flex-shrink-0">
                          <Bell className="w-4 h-4 sm:w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-base sm:text-lg font-black text-white tracking-tight truncate">Notificações</h3>
                          <p className="text-[9px] sm:text-[10px] text-zinc-500 font-bold uppercase tracking-widest truncate">
                            {unreadCount} novas mensagens
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                        {unreadCount > 0 && (
                          <button 
                            onClick={markAllAsRead}
                            className="p-2 text-zinc-500 hover:text-brand-blue transition-colors"
                            title="Marcar todas como lidas"
                          >
                            <CheckCircle2 className="w-5 h-5" />
                          </button>
                        )}
                        <button 
                          onClick={() => setShowNotifications(false)}
                          className="p-2 text-zinc-500 hover:text-white transition-colors"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                    </div>

                    <div className="max-h-[60vh] overflow-y-auto p-4 space-y-3 no-scrollbar">
                      {notifications.length === 0 ? (
                        <div className="py-20 text-center">
                          <BellOff className="w-12 h-12 mx-auto mb-4 text-zinc-800" />
                          <p className="text-xs font-black text-zinc-600 uppercase tracking-widest">Nenhuma notificação</p>
                        </div>
                      ) : (
                        notifications.map((notif) => (
                          <motion.div 
                            layout
                            key={notif.id}
                            className={`p-4 rounded-2xl border transition-all group relative ${
                              notif.read 
                                ? 'bg-zinc-950/20 border-white/5 opacity-60' 
                                : 'bg-brand-blue/5 border-brand-blue/20 shadow-lg shadow-brand-blue/5'
                            }`}
                          >
                            <div className="flex gap-4">
                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                                notif.read ? 'bg-zinc-900 text-zinc-500' : 'bg-brand-blue text-white'
                              }`}>
                                <Sparkles className="w-5 h-5" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between mb-1">
                                  <h4 className="text-sm font-black text-white tracking-tight truncate pr-6">{notif.title}</h4>
                                  <span className="text-[9px] text-zinc-600 font-bold uppercase whitespace-nowrap">
                                    {format(parseISO(notif.createdAt), 'HH:mm')}
                                  </span>
                                </div>
                                <p className="text-xs text-zinc-400 leading-relaxed mb-3">{notif.message}</p>
                                <div className="flex items-center gap-3">
                                  {!notif.read && (
                                    <button 
                                      onClick={() => markAsRead(notif.id)}
                                      className="text-[10px] font-black text-brand-blue uppercase tracking-widest hover:underline"
                                    >
                                      Marcar como lida
                                    </button>
                                  )}
                                  <button 
                                    onClick={() => deleteNotification(notif.id)}
                                    className="text-[10px] font-black text-zinc-600 hover:text-red-500 uppercase tracking-widest transition-colors"
                                  >
                                    Excluir
                                  </button>
                                </div>
                              </div>
                            </div>
                            {!notif.read && (
                              <div className="absolute top-4 right-4 w-2 h-2 bg-brand-blue rounded-full" />
                            )}
                          </motion.div>
                        ))
                      )}
                    </div>

                    {notifications.length > 0 && (
                      <div className="p-4 bg-zinc-950/50 border-t border-white/5">
                        <p className="text-[9px] text-zinc-600 font-black uppercase tracking-[0.2em] text-center">
                          Fique por dentro do status do seu veículo
                        </p>
                      </div>
                    )}
                  </motion.div>
                </div>
              </div>
            )}
          </AnimatePresence>

          {/* Modal de Perfil */}
          {showProfile && (
            <div className="fixed inset-0 z-[100] overflow-y-auto">
              <div className="flex min-h-full items-start sm:items-center justify-center p-4 md:p-8">
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setShowProfile(false)}
                  className="fixed inset-0 bg-black/95 backdrop-blur-2xl cursor-pointer"
                />
                
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: 20 }}
                  onClick={(e) => e.stopPropagation()}
                  className="glass-card w-full max-w-2xl p-6 md:p-12 relative z-10 my-8 sm:my-auto"
                >
                  {/* Decorative Glows */}
                  <div className="absolute -top-24 -right-24 w-64 h-64 bg-brand-blue/10 rounded-full blur-[100px] pointer-events-none" />
                  <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-brand-blue/5 rounded-full blur-[100px] pointer-events-none" />

                  <div className="flex items-center justify-between mb-8 md:mb-12 relative gap-4">
                    <div className="flex items-center gap-3 md:gap-6 min-w-0">
                      <div className="w-12 h-12 md:w-20 md:h-20 bg-brand-blue/10 rounded-2xl md:rounded-3xl flex items-center justify-center border border-brand-blue/20 shadow-2xl shadow-blue-500/10 rotate-3 flex-shrink-0">
                        <Car className="text-brand-blue w-6 h-6 md:w-10 md:h-10" />
                      </div>
                      <div className="min-w-0">
                        <h2 className="text-xl md:text-3xl font-black text-white tracking-tight truncate">Meu Perfil</h2>
                        <p className="text-zinc-500 text-[7px] md:text-[10px] font-bold uppercase tracking-[0.2em] md:tracking-[0.4em] truncate">Personalize sua experiência</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => setShowProfile(false)}
                      className="w-10 h-10 md:w-12 md:h-12 bg-zinc-900/50 hover:bg-zinc-800 rounded-xl md:rounded-2xl flex items-center justify-center border border-white/5 transition-all active:scale-90 flex-shrink-0"
                    >
                      <X className="w-5 h-5 md:w-6 h-6 text-zinc-500" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 mb-8 md:mb-12 relative">
                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] ml-1">Modelo do Carro</label>
                      <div className="relative group">
                        <Car className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-600 group-focus-within:text-brand-blue transition-colors" />
                        <input 
                          type="text" 
                          value={carModel}
                          onChange={(e) => setCarModel(e.target.value)}
                          placeholder="Ex: BMW M3 G80"
                          className="w-full bg-zinc-950/50 border border-white/5 rounded-2xl pl-14 pr-6 py-4 md:py-5 text-sm text-white focus:ring-2 focus:ring-brand-blue/50 outline-none transition-all placeholder:text-zinc-800"
                        />
                      </div>
                    </div>

                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] ml-1">Placa do Veículo</label>
                      <div className="relative group">
                        <div className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center text-zinc-600 group-focus-within:text-brand-blue transition-colors font-black text-xs">#</div>
                        <input 
                          type="text" 
                          value={licensePlate}
                          onChange={(e) => setLicensePlate(e.target.value)}
                          placeholder="ABC-1234"
                          className="w-full bg-zinc-950/50 border border-white/5 rounded-2xl pl-14 pr-6 py-4 md:py-5 text-sm text-white focus:ring-2 focus:ring-brand-blue/50 outline-none transition-all placeholder:text-zinc-800 uppercase"
                        />
                      </div>
                    </div>

                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] ml-1 flex items-center justify-between">
                        <span>Telefone / WhatsApp</span>
                        <span className="text-brand-blue text-[8px]">Obrigatório</span>
                      </label>
                      <div className="relative group">
                        <Phone className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-600 group-focus-within:text-brand-blue transition-colors" />
                        <input 
                          type="tel" 
                          required
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          placeholder="(11) 99999-9999"
                          className={`w-full bg-zinc-950/50 border rounded-2xl pl-14 pr-6 py-4 md:py-5 text-sm text-white focus:ring-2 focus:ring-brand-blue/50 outline-none transition-all placeholder:text-zinc-800 ${!phone ? 'border-brand-blue/30' : 'border-white/5'}`}
                        />
                      </div>
                    </div>

                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] ml-1">Tipo Preferencial</label>
                      <div className="grid grid-cols-4 gap-2">
                        {VEHICLE_TYPES.map((v) => (
                          <button
                            key={v.id}
                            onClick={() => setPreferredVehicleType(v.id)}
                            className={`p-2 md:p-3 rounded-xl border transition-all flex flex-col items-center gap-1 ${
                              preferredVehicleType === v.id 
                                ? 'bg-brand-blue/20 border-brand-blue text-brand-blue' 
                                : 'bg-zinc-950/50 border-white/5 text-zinc-600 hover:border-zinc-700'
                            }`}
                          >
                            <span className="text-lg md:text-xl">{v.icon}</span>
                            <span className="text-[7px] md:text-[8px] font-black uppercase tracking-tighter">{v.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-4 relative">
                    <button 
                      onClick={() => setShowProfile(false)}
                      className="w-full sm:flex-1 py-4 md:py-5 bg-zinc-900/50 hover:bg-zinc-800 text-zinc-400 hover:text-white text-xs font-black uppercase tracking-widest rounded-2xl transition-all border border-white/5"
                    >
                      Cancelar
                    </button>
                    <button 
                      onClick={saveProfile}
                      disabled={loading}
                      className="w-full sm:flex-2 py-4 md:py-5 bg-brand-blue hover:bg-blue-600 text-white text-xs font-black uppercase tracking-widest rounded-2xl transition-all shadow-xl shadow-blue-500/20 flex items-center justify-center gap-3 disabled:opacity-50"
                    >
                      {loading ? (
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4" />
                          Salvar Alterações
                        </>
                      )}
                    </button>
                  </div>
                </motion.div>
              </div>
            </div>
          )}
          </AnimatePresence>

          {/* Modal de Confirmação Personalizado */}
          <AnimatePresence>
            {cancellingId && (
              <div className="fixed inset-0 z-[100] overflow-y-auto">
                <div className="flex min-h-full items-start sm:items-center justify-center p-4">
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setCancellingId(null)}
                    className="fixed inset-0 bg-black/90 backdrop-blur-md cursor-pointer"
                  />
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 20 }}
                    onClick={(e) => e.stopPropagation()}
                    className="glass-card w-full max-w-sm p-10 text-center relative z-10 my-8 sm:my-auto"
                  >
                  <div className="absolute top-0 left-0 w-full h-1 bg-red-500/50" />
                  <div className="w-20 h-20 bg-red-500/10 rounded-3xl flex items-center justify-center mx-auto mb-6 border border-red-500/20 shadow-2xl shadow-red-500/5 rotate-3">
                    <X className="text-red-500 w-10 h-10" />
                  </div>
                  <h3 className="text-2xl font-black text-white mb-3 tracking-tight">Cancelar?</h3>
                  <p className="text-zinc-500 mb-10 text-sm leading-relaxed">
                    Esta ação não pode ser desfeita e o horário será liberado imediatamente.
                  </p>
                  <div className="flex flex-col gap-3">
                    <button 
                      onClick={() => cancelAppointment(cancellingId)}
                      disabled={loading}
                      className="w-full py-5 bg-red-600 hover:bg-red-700 text-white text-xs font-black uppercase tracking-widest rounded-2xl transition-all shadow-xl shadow-red-600/20 disabled:opacity-50"
                    >
                      {loading ? 'Processando...' : 'Confirmar Cancelamento'}
                    </button>
                    <button 
                      onClick={() => setCancellingId(null)}
                      className="w-full py-5 bg-zinc-900/50 hover:bg-zinc-800 text-zinc-500 hover:text-white text-xs font-black uppercase tracking-widest rounded-2xl transition-all border border-white/5"
                    >
                      Manter Agendamento
                    </button>
                  </div>
                </motion.div>
              </div>
            </div>
          )}

            {deletingId && (
              <div className="fixed inset-0 z-[100] overflow-y-auto">
                <div className="flex min-h-full items-start sm:items-center justify-center p-4">
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setDeletingId(null)}
                    className="fixed inset-0 bg-black/90 backdrop-blur-md cursor-pointer"
                  />
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 20 }}
                    onClick={(e) => e.stopPropagation()}
                    className="glass-card w-full max-w-sm p-10 text-center relative z-10 my-8 sm:my-auto"
                  >
                  <div className="absolute top-0 left-0 w-full h-1 bg-zinc-500/50" />
                  <div className="w-20 h-20 bg-zinc-500/10 rounded-3xl flex items-center justify-center mx-auto mb-6 border border-zinc-500/20 shadow-2xl shadow-zinc-500/5 rotate-3">
                    <Trash2 className="text-zinc-500 w-10 h-10" />
                  </div>
                  <h3 className="text-2xl font-black text-white mb-3 tracking-tight">Remover?</h3>
                  <p className="text-zinc-500 mb-10 text-sm leading-relaxed">
                    Este agendamento será removido permanentemente do seu histórico.
                  </p>
                  <div className="flex flex-col gap-3">
                    <button 
                      onClick={() => deleteAppointment(deletingId)}
                      disabled={loading}
                      className="w-full py-5 bg-zinc-700 hover:bg-zinc-600 text-white text-xs font-black uppercase tracking-widest rounded-2xl transition-all shadow-xl shadow-zinc-700/20 disabled:opacity-50"
                    >
                      {loading ? 'Removendo...' : 'Confirmar Remoção'}
                    </button>
                    <button 
                      onClick={() => setDeletingId(null)}
                      className="w-full py-5 bg-zinc-900/50 hover:bg-zinc-800 text-zinc-500 hover:text-white text-xs font-black uppercase tracking-widest rounded-2xl transition-all border border-white/5"
                    >
                      Manter no Histórico
                    </button>
                  </div>
                </motion.div>
              </div>
            </div>
          )}
          </AnimatePresence>
      </div>
    </div>
  );
}
