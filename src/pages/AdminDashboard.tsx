import React, { useState, useEffect } from 'react';
import { dbService } from '../services/dbService';
import { supabase } from '../lib/supabase';
import { Appointment, Service, VehicleType, Expense, Promotion, AppSettings, Profile, Notification } from '../types';
import { 
  LayoutDashboard, 
  Calendar, 
  Settings, 
  Users, 
  TrendingUp, 
  Clock, 
  DollarSign,
  MessageCircle,
  MoreVertical,
  Plus,
  User,
  UserPlus,
  Trash2,
  Download,
  Edit2,
  Save,
  X,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Search,
  Filter,
  CheckCircle2,
  Play,
  Car,
  Truck,
  Phone,
  AlertCircle,
  Wallet,
  Tag,
  Image as ImageIcon,
  ExternalLink,
  Zap,
  Star,
  Upload,
  Sparkles,
  Percent,
  Receipt,
  Gift,
  Menu,
  ChevronDown
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, isToday, parseISO, addDays, eachDayOfInterval, isSameDay, subDays, startOfWeek, endOfWeek, startOfToday, startOfYear, endOfYear, isSameMonth, isSameYear } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Cell, PieChart, Pie } from 'recharts';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'motion/react';

import { useAuth } from '../hooks/useAuth';
import { useLogo } from '../hooks/useLogo';
import Background from '../components/Background';
import { IMaskInput } from 'react-imask';

import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

const TIME_SLOTS = ['08:00', '09:30', '11:00', '12:30', '14:00', '15:30'];

const DEFAULT_LOGO = 'https://lh3.googleusercontent.com/d/1cKe9DW0MFwXLqTrRaV9bemKXVda1nFi8';

export default function AdminDashboard() {
  const { user, signOut } = useAuth();
  const cachedLogo = useLogo();
  const [activeTab, setActiveTab] = useState<'stats' | 'appointments' | 'calendar' | 'services' | 'settings' | 'finance' | 'promotions' | 'clients'>('stats');
  const [statsMonth, setStatsMonth] = useState(new Date());
  const [appointmentsMonth, setAppointmentsMonth] = useState(new Date());
  const [financeMonth, setFinanceMonth] = useState(new Date());
  const [selectedCalendarDay, setSelectedCalendarDay] = useState<Date>(startOfToday());
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [settings, setSettings] = useState<AppSettings>({
    id: 'default',
    businessHours: ['08:00', '09:30', '11:00', '12:30', '14:00', '15:30'],
    capacity: 1,
    loyaltyEnabled: true,
    loyaltyGoal: 5,
    loyaltyReward: 'Cera de Carnaúba',
    logoUrl: DEFAULT_LOGO,
    updatedAt: new Date().toISOString()
  });
  const [logoLoaded, setLogoLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [expandedAppointments, setExpandedAppointments] = useState<Set<string>>(new Set());

  const toggleAppointmentExpansion = (id: string) => {
    const newExpanded = new Set(expandedAppointments);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedAppointments(newExpanded);
  };

  // Photo upload state
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [photoBefore, setPhotoBefore] = useState('');
  const [photoAfter, setPhotoAfter] = useState('');
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  // Price editing state
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null);
  const [tempPrice, setTempPrice] = useState<string>('');

  // New states for professional board
  const [searchTerm, setSearchTerm] = useState('');
  const [workflowTab, setWorkflowTab] = useState<'upcoming' | 'active' | 'finished'>('upcoming');

  // Stats
  const [stats, setStats] = useState({
    monthlyRevenue: 0,
    annualRevenue: 0,
    averageTicket: 0,
    todayAppointments: 0,
    pendingAppointments: 0,
    totalClients: 0
  });

  const [showNewAppointmentModal, setShowNewAppointmentModal] = useState(false);
  const [editingAppointmentId, setEditingAppointmentId] = useState<string | null>(null);
  const [showNewCustomerModal, setShowNewCustomerModal] = useState(false);
  const [newCustomer, setNewCustomer] = useState({
    displayName: '',
    email: '',
    phone: '',
    carModel: '',
    licensePlate: '',
    preferredVehicleType: 'hatch' as VehicleType
  });
  const [newAppointment, setNewAppointment] = useState({
    customerName: '',
    customerPhone: '',
    vehicleType: 'hatch' as VehicleType,
    serviceIds: [] as string[],
    date: format(new Date(), 'yyyy-MM-dd'),
    time: '08:00',
    status: 'pending' as Appointment['status'],
    notes: '',
    userId: '' as string | undefined
  });

  const [showNewExpenseModal, setShowNewExpenseModal] = useState(false);
  const [newExpense, setNewExpense] = useState({
    description: '',
    amount: '',
    category: 'products' as Expense['category'],
    date: format(new Date(), 'yyyy-MM-dd')
  });

  const [showNewPromotionModal, setShowNewPromotionModal] = useState(false);
  const [editingPromotionId, setEditingPromotionId] = useState<string | null>(null);
  const [newPromotion, setNewPromotion] = useState({
    id: undefined as string | undefined,
    title: '',
    description: '',
    active: true,
    imageUrl: '',
    discountType: 'percentage' as Promotion['discountType'],
    discountValue: 0,
    fixedPrice: 0,
    serviceIds: [] as string[]
  });

  const [showNewServiceModal, setShowNewServiceModal] = useState(false);
  const [newService, setNewService] = useState({
    name: '',
    description: '',
    category: 'lavagem',
    duration: 60,
    prices: {
      hatch: 0,
      sedan: 0,
      suv: 0,
      pickup: 0
    } as Record<VehicleType, number>,
    active: true
  });

  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    id: string;
    type: 'service' | 'expense' | 'promotion';
    title: string;
  } | null>(null);

  const [financeView, setFinanceView] = useState<'monthly' | 'annual'>('monthly');

  useEffect(() => {
    loadData();

    // Inscrição em tempo real
    const subscription = supabase
      .channel('admin-appointments-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'appointments'
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newApp = payload.new as Appointment;
            toast.success(`Novo agendamento: ${newApp.customerName} para ${newApp.time}`, {
              icon: '📅',
              duration: 6000,
              style: {
                border: '1px solid #2563eb',
                padding: '16px',
                color: '#fff',
                background: '#09090b',
              },
            });
          }
          loadData();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleImportContact = async (target: 'appointment' | 'customer' = 'appointment') => {
    if (!('contacts' in navigator && 'select' in (navigator as any).contacts)) {
      toast.error('Seu navegador não suporta a importação de contatos.');
      return;
    }

    try {
      const props = ['name', 'tel', 'email'];
      const opts = { multiple: false };
      const contacts = await (navigator as any).contacts.select(props, opts);
      
      if (contacts.length > 0) {
        const contact = contacts[0];
        const name = contact.name?.[0] || '';
        const phone = contact.tel?.[0] || '';
        const email = contact.email?.[0] || '';

        if (target === 'appointment') {
          setNewAppointment(prev => ({
            ...prev,
            customerName: name || prev.customerName,
            customerPhone: phone || prev.customerPhone
          }));
        } else {
          setNewCustomer(prev => ({
            ...prev,
            displayName: name || prev.displayName,
            phone: phone || prev.phone,
            email: email || prev.email
          }));
        }
        toast.success('Contato importado!');
      }
    } catch (err) {
      console.error('Erro ao importar contato:', err);
    }
  };

  const handleCreateManualAppointment = async () => {
    if (!newAppointment.customerName || !newAppointment.customerPhone || newAppointment.serviceIds.length === 0) {
      toast.error('Preencha os campos obrigatórios');
      return;
    }

    // Verificar capacidade (apenas se mudar data/hora ou for novo)
    const originalApp = editingAppointmentId ? appointments.find(a => a.id === editingAppointmentId) : null;
    const isDateTimeChanged = !originalApp || originalApp.date !== newAppointment.date || originalApp.time !== newAppointment.time;

    if (isDateTimeChanged) {
      const appointmentsInSlot = appointments.filter(app => 
        app.date === newAppointment.date && 
        app.time === newAppointment.time && 
        app.status !== 'cancelled' &&
        app.id !== editingAppointmentId
      ).length;

      if (appointmentsInSlot >= settings.capacity) {
        toast.error(`Capacidade máxima atingida para este horário (${settings.capacity} agendamentos)`);
        return;
      }
    }

    setLoading(true);
    try {
      const selectedServices = services.filter(s => newAppointment.serviceIds.includes(s.id));
      const totalPrice = selectedServices.reduce((sum, s) => sum + (s.prices[newAppointment.vehicleType] || 0), 0);
      
      if (editingAppointmentId) {
        await dbService.updateAppointment(editingAppointmentId, {
          customerName: newAppointment.customerName,
          customerPhone: newAppointment.customerPhone,
          vehicleType: newAppointment.vehicleType,
          serviceIds: newAppointment.serviceIds,
          serviceNames: selectedServices.map(s => s.name),
          date: newAppointment.date,
          time: newAppointment.time,
          status: newAppointment.status,
          totalPrice,
          notes: newAppointment.notes || undefined,
        });
        toast.success('Agendamento atualizado com sucesso!');
      } else {
        await dbService.createAppointment({
          userId: newAppointment.userId || user?.id || null,
          customerName: newAppointment.customerName,
          customerPhone: newAppointment.customerPhone,
          vehicleType: newAppointment.vehicleType,
          serviceIds: newAppointment.serviceIds,
          serviceNames: selectedServices.map(s => s.name),
          date: newAppointment.date,
          time: newAppointment.time,
          status: newAppointment.status,
          totalPrice,
          notes: newAppointment.notes || undefined,
        });
        toast.success('Agendamento criado com sucesso!');
      }

      setShowNewAppointmentModal(false);
      setEditingAppointmentId(null);
      setNewAppointment({
        customerName: '',
        customerPhone: '',
        vehicleType: 'hatch',
        serviceIds: [],
        date: format(new Date(), 'yyyy-MM-dd'),
        time: '08:00',
        status: 'pending',
        notes: '',
        userId: ''
      });
      loadData();
    } catch (error: any) {
      toast.error('Erro ao salvar agendamento: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEditAppointment = (app: Appointment) => {
    setNewAppointment({
      customerName: app.customerName,
      customerPhone: app.customerPhone,
      vehicleType: app.vehicleType,
      serviceIds: app.serviceIds,
      date: app.date,
      time: app.time,
      status: app.status,
      notes: app.notes || '',
      userId: app.userId || ''
    });
    setEditingAppointmentId(app.id);
    setShowNewAppointmentModal(true);
  };

  const handleCreateCustomer = async (andSchedule = false) => {
    if (!newCustomer.displayName || !newCustomer.phone) {
      toast.error('Nome e telefone são obrigatórios');
      return;
    }

    setLoading(true);
    try {
      // Create a temporary ID for the profile if it doesn't have one
      // In a real app, this would be the Auth UID, but for manual creation
      // we can use a randomly generated one or let the backend handle it if possible.
      // Since createProfile uses upsert, we might need an ID.
      // However, if we want to allow them to login later, we should probably
      // use their email as a key or something.
      // For now, let's use a random UUID for the profile ID.
      const tempId = crypto.randomUUID();

      await dbService.createProfile({
        id: tempId,
        displayName: newCustomer.displayName,
        email: newCustomer.email || undefined,
        phone: newCustomer.phone,
        carModel: newCustomer.carModel || undefined,
        licensePlate: newCustomer.licensePlate || undefined,
        preferredVehicleType: newCustomer.preferredVehicleType,
        washCount: 0,
        role: 'client'
      });

      toast.success('Cliente cadastrado com sucesso!');
      
      if (andSchedule) {
        setNewAppointment({
          ...newAppointment,
          customerName: newCustomer.displayName,
          customerPhone: newCustomer.phone,
          vehicleType: newCustomer.preferredVehicleType,
          date: format(new Date(), 'yyyy-MM-dd'),
          userId: tempId
        });
        setShowNewAppointmentModal(true);
      }
      
      setShowNewCustomerModal(false);
      setNewCustomer({
        displayName: '',
        email: '',
        phone: '',
        carModel: '',
        licensePlate: '',
        preferredVehicleType: 'hatch'
      });
      loadData();
    } catch (error: any) {
      toast.error('Erro ao cadastrar cliente: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveExpense = async () => {
    if (!newExpense.description || !newExpense.amount) {
      toast.error('Preencha os campos obrigatórios');
      return;
    }

    setLoading(true);
    try {
      await dbService.saveExpense({
        description: newExpense.description,
        amount: parseFloat(newExpense.amount),
        category: newExpense.category,
        date: newExpense.date
      });
      toast.success('Despesa salva!');
      setShowNewExpenseModal(false);
      setNewExpense({
        description: '',
        amount: '',
        category: 'products',
        date: format(new Date(), 'yyyy-MM-dd')
      });
      loadData();
    } catch (error) {
      toast.error('Erro ao salvar despesa');
    } finally {
      setLoading(false);
    }
  };

  const handleSavePromotion = async () => {
    if (!newPromotion.title || !newPromotion.description) {
      toast.error('Preencha os campos obrigatórios');
      return;
    }

    setLoading(true);
    try {
      await dbService.savePromotion(newPromotion as any);
      toast.success(editingPromotionId ? 'Promoção atualizada!' : 'Promoção salva!');
      setShowNewPromotionModal(false);
      setEditingPromotionId(null);
      setNewPromotion({
        id: undefined,
        title: '',
        description: '',
        active: true,
        imageUrl: '',
        discountType: 'percentage',
        discountValue: 0,
        fixedPrice: 0,
        serviceIds: []
      });
      loadData();
    } catch (error) {
      toast.error('Erro ao salvar promoção');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveService = async () => {
    if (!newService.name || !newService.description || !newService.category) {
      toast.error('Preencha os campos obrigatórios');
      return;
    }

    setLoading(true);
    try {
      await dbService.saveService(newService);
      toast.success('Serviço salvo com sucesso!');
      setShowNewServiceModal(false);
      setNewService({
        name: '',
        description: '',
        category: 'lavagem',
        duration: 60,
        prices: {
          hatch: 0,
          sedan: 0,
          suv: 0,
          pickup: 0
        },
        active: true
      });
      loadData();
    } catch (error) {
      toast.error('Erro ao salvar serviço');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteExpense = async (id: string) => {
    setDeleteConfirmation({
      id,
      type: 'expense',
      title: 'Deseja realmente excluir esta despesa?'
    });
  };

  const handleDeletePromotion = async (id: string) => {
    setDeleteConfirmation({
      id,
      type: 'promotion',
      title: 'Deseja realmente excluir esta promoção?'
    });
  };

  const confirmDelete = async () => {
    if (!deleteConfirmation) return;
    
    setLoading(true);
    try {
      if (deleteConfirmation.type === 'service') {
        await dbService.deleteService(deleteConfirmation.id);
        toast.success('Serviço excluído!');
      } else if (deleteConfirmation.type === 'expense') {
        await dbService.deleteExpense(deleteConfirmation.id);
        toast.success('Despesa excluída!');
      } else if (deleteConfirmation.type === 'promotion') {
        await dbService.deletePromotion(deleteConfirmation.id);
        toast.success('Promoção excluída!');
      }
      loadData();
    } catch (error) {
      toast.error('Erro ao excluir item');
    } finally {
      setLoading(false);
      setDeleteConfirmation(null);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    
    setIsSavingSettings(true);
    try {
      await dbService.saveSettings(settings);
      toast.success('Configurações salvas com sucesso!', {
        duration: 4000,
        position: 'top-center',
        icon: '✅'
      });
      loadData();
    } catch (error: any) {
      console.error('Erro detalhado ao salvar configurações:', error);
      const errorMessage = error.message || error.details || 'Erro desconhecido';
      toast.error(`Erro ao salvar: ${errorMessage}`);
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error('A imagem deve ter no máximo 2MB');
      return;
    }

    const toastId = toast.loading('Enviando logo...');
    try {
      const fileName = `logo-${Date.now()}.${file.name.split('.').pop()}`;
      const publicUrl = await dbService.uploadPhoto(file, fileName);
      setSettings(prev => ({ ...prev, logoUrl: publicUrl }));
      toast.success('Logo atualizada!', { id: toastId });
    } catch (error: any) {
      toast.error('Erro ao enviar logo: ' + error.message, { id: toastId });
    }
  };

  const handlePromotionImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error('A imagem deve ter no máximo 2MB');
      return;
    }

    const toastId = toast.loading('Enviando imagem...');
    try {
      const fileName = `promo-${Date.now()}.${file.name.split('.').pop()}`;
      const publicUrl = await dbService.uploadPhoto(file, fileName);
      setNewPromotion(prev => ({ ...prev, imageUrl: publicUrl }));
      toast.success('Imagem enviada!', { id: toastId });
    } catch (error: any) {
      toast.error('Erro ao enviar imagem: ' + error.message, { id: toastId });
    }
  };

  const generateReceipt = async (app: Appointment) => {
    const toastId = toast.loading('Gerando comprovante...');
    
    try {
      const receiptElement = document.createElement('div');
      receiptElement.style.position = 'absolute';
      receiptElement.style.left = '-9999px';
      receiptElement.style.width = '800px';
      receiptElement.style.padding = '40px';
      receiptElement.style.backgroundColor = '#ffffff';
      receiptElement.style.color = '#000000';
      receiptElement.style.fontFamily = 'sans-serif';

      receiptElement.innerHTML = `
        <div style="border: 2px solid #000; padding: 40px; border-radius: 10px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 40px; border-bottom: 2px solid #eee; padding-bottom: 20px;">
            <div>
              <h1 style="font-size: 32px; font-weight: 900; margin: 0; color: #000;">BOX CLASS CAR</h1>
              <p style="font-size: 14px; margin: 5px 0; color: #666;">CNPJ: 47.284.030/0001-30</p>
              <p style="font-size: 14px; margin: 5px 0; color: #666;">Estética Automotiva Premium</p>
            </div>
            <img src="${settings.logoUrl || DEFAULT_LOGO}" style="height: 80px; width: auto;" />
          </div>

          <div style="margin-bottom: 30px;">
            <h2 style="font-size: 18px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 15px; color: #2563eb;">Dados do Cliente</h2>
            <p style="font-size: 16px; margin: 8px 0;"><strong>Nome:</strong> ${app.customerName}</p>
            <p style="font-size: 16px; margin: 8px 0;"><strong>Telefone:</strong> ${app.customerPhone}</p>
            <p style="font-size: 16px; margin: 8px 0;"><strong>Veículo:</strong> ${app.vehicleType.toUpperCase()}</p>
          </div>

          <div style="margin-bottom: 30px; background-color: #f8fafc; padding: 20px; border-radius: 8px;">
            <h2 style="font-size: 18px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 15px; color: #2563eb;">Detalhes do Serviço</h2>
            <p style="font-size: 16px; margin: 8px 0;"><strong>Serviço(s):</strong> ${app.serviceNames?.join(' + ')}</p>
            <p style="font-size: 16px; margin: 8px 0;"><strong>Data:</strong> ${format(parseISO(app.date), 'dd/MM/yyyy')}</p>
            <p style="font-size: 16px; margin: 8px 0;"><strong>Horário:</strong> ${app.time}</p>
            <div style="margin-top: 20px; padding-top: 15px; border-top: 1px dashed #cbd5e1; display: flex; justify-content: space-between; align-items: center;">
              <span style="font-size: 20px; font-weight: 900;">VALOR TOTAL:</span>
              <span style="font-size: 24px; font-weight: 900; color: #2563eb;">R$ ${app.totalPrice.toFixed(2)}</span>
            </div>
          </div>

          <div style="margin-top: 60px; text-align: center; border-top: 2px solid #eee; padding-top: 30px;">
            <p style="font-size: 16px; font-weight: 700; margin-bottom: 10px;">Obrigado pela preferência!</p>
            <p style="font-size: 12px; color: #666; margin: 5px 0;">Este documento é um comprovante de serviço realizado pela Box Class Car.</p>
            <p style="font-size: 12px; color: #666; margin: 5px 0;">Siga-nos no Instagram: @boxclasscar</p>
          </div>
        </div>
      `;

      document.body.appendChild(receiptElement);
      
      const canvas = await html2canvas(receiptElement, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff'
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`comprovante-${app.customerName.replace(/\s+/g, '-').toLowerCase()}-${app.date}.pdf`);
      
      document.body.removeChild(receiptElement);
      toast.success('Comprovante gerado com sucesso!', { id: toastId });
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      toast.error('Erro ao gerar comprovante.', { id: toastId });
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      // Rotina de limpeza de fotos (deleta fotos com mais de 10 dias)
      dbService.deleteOldPhotos();

      const [appsResult, servsResult, expsResult, promsResult, settingsResult, profilesResult] = await Promise.allSettled([
        dbService.getAppointments(),
        dbService.getAllServices(),
        dbService.getExpenses(),
        dbService.getPromotions(),
        dbService.getSettings(),
        dbService.getProfiles()
      ]);

      if (appsResult.status === 'fulfilled') setAppointments(appsResult.value);
      if (servsResult.status === 'fulfilled') setServices(servsResult.value);
      if (expsResult.status === 'fulfilled') setExpenses(expsResult.value);
      if (promsResult.status === 'fulfilled') setPromotions(promsResult.value);
      if (settingsResult.status === 'fulfilled') setSettings(settingsResult.value);
      if (profilesResult.status === 'fulfilled') setProfiles(profilesResult.value);

      if (appsResult.status === 'fulfilled') {
        calculateStats(appsResult.value, statsMonth);
      }

      // If any critical fetch failed, show a more specific warning
      if (appsResult.status === 'rejected' || servsResult.status === 'rejected') {
        toast.error('Erro ao carregar agendamentos ou serviços. Verifique as tabelas no banco de dados.');
      }
      
      if (expsResult.status === 'rejected' || promsResult.status === 'rejected') {
        console.warn('Tabelas de despesas ou promoções podem não existir ainda.');
      }
    } catch (error) {
      toast.error('Erro crítico ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    calculateStats(appointments, statsMonth);
  }, [statsMonth, appointments]);

  const calculateStats = (apps: Appointment[], targetDate: Date) => {
    const start = startOfMonth(targetDate);
    const end = endOfMonth(targetDate);
    const yearStart = startOfYear(targetDate);
    const yearEnd = endOfYear(targetDate);

    const monthlyApps = apps.filter(a => {
      const d = parseISO(a.date);
      return d >= start && d <= end && a.status === 'completed';
    });

    const monthly = monthlyApps.reduce((sum, a) => sum + a.totalPrice, 0);
    const averageTicket = monthlyApps.length > 0 ? monthly / monthlyApps.length : 0;

    const annual = apps
      .filter(a => {
        const d = parseISO(a.date);
        return d >= yearStart && d <= yearEnd && a.status === 'completed';
      })
      .reduce((sum, a) => sum + a.totalPrice, 0);

    const today = apps.filter(a => isToday(parseISO(a.date))).length;
    const pending = apps.filter(a => a.status === 'pending').length;
    const clients = new Set(apps.map(a => a.userId)).size;

    setStats({
      monthlyRevenue: monthly,
      annualRevenue: annual,
      averageTicket: averageTicket,
      todayAppointments: today,
      pendingAppointments: pending,
      totalClients: clients
    });
  };

  const updateStatus = async (id: string, status: Appointment['status']) => {
    if (status === 'completed') {
      setCompletingId(id);
      setPhotoBefore('');
      setPhotoAfter('');
      return;
    }

    try {
      await dbService.updateAppointmentStatus(id, status);
      toast.success('Status atualizado');
      loadData();
    } catch (error) {
      toast.error('Erro ao atualizar status');
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, type: 'before' | 'after') => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file size (limit to 10MB for storage)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('A imagem é muito grande. Escolha uma foto menor que 10MB.');
      return;
    }

    setIsUploadingPhoto(true);
    const toastId = toast.loading('Enviando foto...');

    try {
      // Create a unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `${completingId}-${type}-${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      const publicUrl = await dbService.uploadPhoto(file, filePath);
      
      if (type === 'before') setPhotoBefore(publicUrl);
      else setPhotoAfter(publicUrl);
      
      toast.success('Foto enviada com sucesso!', { id: toastId });
    } catch (error: any) {
      console.error('Erro no upload:', error);
      toast.error('Erro ao enviar foto: ' + error.message, { id: toastId });
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleComplete = async () => {
    if (!completingId) return;
    try {
      await dbService.updateAppointmentStatus(completingId, 'completed', {
        photoBefore: photoBefore || undefined,
        photoAfter: photoAfter || undefined
      });
      toast.success('Serviço concluído!');
      
      // Notificar via WhatsApp automaticamente
      const app = appointments.find(a => a.id === completingId);
      if (app) {
        openWhatsApp(app.customerPhone, app.customerName, 'ready');
        
        // Check if this completion triggered a reward
        const profile = profiles.find(p => p.id === app.userId);
        if (profile) {
          const newCount = (profile.washCount || 0) + 1;
          if (newCount % settings.loyaltyGoal === 0) {
            toast.success(`🎉 O cliente ${app.customerName} acaba de ganhar uma recompensa!`, {
              duration: 8000,
              icon: '🎁'
            });
          }
        }
      }
      
      setCompletingId(null);
      setPhotoBefore('');
      setPhotoAfter('');
      loadData();
    } catch (error) {
      toast.error('Erro ao concluir serviço');
    }
  };

  const handleRedeemReward = async (userId: string, appointmentId?: string) => {
    try {
      const profile = profiles.find(p => p.id === userId);
      if (!profile) {
        toast.error('Perfil do cliente não encontrado');
        return;
      }

      // Calculate new count (resetting the cycle)
      const newWashCount = profile.washCount % settings.loyaltyGoal;
      
      await dbService.updateProfile(userId, { washCount: newWashCount });
      
      // Create a notification for the user about the redemption
      await dbService.createNotification({
        userId,
        appointmentId: appointmentId || '',
        title: 'Recompensa Resgatada! 🎁',
        message: `Sua recompensa de "${settings.loyaltyReward}" foi resgatada com sucesso. Aproveite!`,
        type: 'status_change',
        read: false
      });

      toast.success('Recompensa resgatada e contador reiniciado!');
      loadData();
    } catch (error) {
      console.error('Erro ao resgatar recompensa:', error);
      toast.error('Erro ao resgatar recompensa');
    }
  };

  const updatePrice = async (id: string) => {
    const price = parseFloat(tempPrice);
    if (isNaN(price)) {
      toast.error('Preço inválido');
      return;
    }

    try {
      await dbService.updateAppointment(id, { totalPrice: price });
      toast.success('Preço atualizado');
      setEditingPriceId(null);
      loadData();
    } catch (error) {
      toast.error('Erro ao atualizar preço');
    }
  };

  // Finance logic
  const filteredExpenses = expenses.filter(exp => {
    const d = parseISO(exp.date);
    return isSameMonth(d, financeMonth);
  });

  const annualExpenses = expenses.filter(exp => {
    const d = parseISO(exp.date);
    return isSameYear(d, financeMonth);
  });

  const monthlyExpenseTotal = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
  const annualExpenseTotal = annualExpenses.reduce((sum, e) => sum + e.amount, 0);

  const monthlyData = Array.from({ length: 12 }, (_, i) => {
    const monthDate = new Date(financeMonth.getFullYear(), i, 1);
    const monthStart = startOfMonth(monthDate);
    const monthEnd = endOfMonth(monthDate);
    
    const revenue = appointments
      .filter(a => {
        const d = parseISO(a.date);
        return d >= monthStart && d <= monthEnd && a.status === 'completed';
      })
      .reduce((sum, a) => sum + a.totalPrice, 0);

    const expense = expenses
      .filter(e => {
        const d = parseISO(e.date);
        return d >= monthStart && d <= monthEnd;
      })
      .reduce((sum, e) => sum + e.amount, 0);

    return {
      name: format(monthDate, 'MMM', { locale: ptBR }),
      receita: revenue,
      despesa: expense,
      lucro: revenue - expense
    };
  });

  const expenseDistribution = [
    { name: 'Produtos', value: (financeView === 'monthly' ? filteredExpenses : annualExpenses).filter(e => e.category === 'products').reduce((sum, e) => sum + e.amount, 0) },
    { name: 'Aluguel', value: (financeView === 'monthly' ? filteredExpenses : annualExpenses).filter(e => e.category === 'rent').reduce((sum, e) => sum + e.amount, 0) },
    { name: 'Energia', value: (financeView === 'monthly' ? filteredExpenses : annualExpenses).filter(e => e.category === 'electricity').reduce((sum, e) => sum + e.amount, 0) },
    { name: 'Água', value: (financeView === 'monthly' ? filteredExpenses : annualExpenses).filter(e => e.category === 'water').reduce((sum, e) => sum + e.amount, 0) },
    { name: 'Outros', value: (financeView === 'monthly' ? filteredExpenses : annualExpenses).filter(e => e.category === 'other').reduce((sum, e) => sum + e.amount, 0) },
  ].filter(item => item.value > 0);

  const COLORS = ['#2563eb', '#ef4444', '#f59e0b', '#10b981', '#6366f1'];

  const serviceRanking = appointments
    .filter(a => {
      const d = parseISO(a.date);
      const start = financeView === 'monthly' ? startOfMonth(financeMonth) : startOfYear(financeMonth);
      const end = financeView === 'monthly' ? endOfMonth(financeMonth) : endOfYear(financeMonth);
      return d >= start && d <= end && a.status === 'completed';
    })
    .reduce((acc: Record<string, { count: number, revenue: number }>, a) => {
      a.serviceNames.forEach(name => {
        if (!acc[name]) acc[name] = { count: 0, revenue: 0 };
        acc[name].count += 1;
        acc[name].revenue += a.totalPrice / a.serviceIds.length;
      });
      return acc;
    }, {});

  const sortedServices = Object.entries(serviceRanking)
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  const handleExportFinance = () => {
    const data = financeView === 'monthly' ? filteredExpenses : annualExpenses;
    const revenue = financeView === 'monthly' ? stats.monthlyRevenue : stats.annualRevenue;
    const expenseTotal = financeView === 'monthly' ? monthlyExpenseTotal : annualExpenseTotal;
    const profit = revenue - expenseTotal;

    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Relatorio Financeiro - " + (financeView === 'monthly' ? format(financeMonth, 'MMMM yyyy', { locale: ptBR }) : format(financeMonth, 'yyyy', { locale: ptBR })) + "\n\n";
    csvContent += "Resumo\n";
    csvContent += `Faturamento;R$ ${revenue.toFixed(2)}\n`;
    csvContent += `Despesas;R$ ${expenseTotal.toFixed(2)}\n`;
    csvContent += `Lucro Real;R$ ${profit.toFixed(2)}\n\n`;
    
    csvContent += "Detalhamento de Despesas\n";
    csvContent += "Data;Descricao;Categoria;Valor\n";
    
    data.forEach(exp => {
      csvContent += `${format(parseISO(exp.date), 'dd/MM/yyyy')};${exp.description};${exp.category};${exp.amount.toFixed(2)}\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `financeiro_${format(financeMonth, 'yyyy_MM')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const openWhatsApp = (phone: string, name: string, type: 'confirmation' | 'ready' | 'general' = 'general') => {
    if (!phone) {
      toast.error('Telefone não cadastrado');
      return;
    }
    const cleanPhone = phone.replace(/\D/g, '');
    let message = '';
    
    if (type === 'confirmation') {
      message = `Olá ${name}! Confirmamos seu agendamento na BOX CLASS. Estamos te esperando! 🚗✨`;
    } else if (type === 'ready') {
      message = `Olá ${name}! Seu veículo já está pronto e brilhando aqui na BOX CLASS! 🌟 Pode vir buscar quando quiser.\n\nAh, e não esqueça de se cadastrar no nosso App para acompanhar seus agendamentos e ganhar benefícios exclusivos: https://box-class-service.vercel.app/`;
    } else {
      message = `Olá ${name}, aqui é da Box Class Car. Gostaria de falar sobre seu agendamento...`;
    }
    
    window.open(`https://wa.me/55${cleanPhone}?text=${encodeURIComponent(message)}`, '_blank');
  };

  const chartData = Array.from({ length: 7 }).map((_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - i));
    const dateStr = format(date, 'yyyy-MM-dd');
    const dayTotal = appointments
      .filter(a => a.date === dateStr && a.status === 'completed')
      .reduce((sum, a) => sum + a.totalPrice, 0);
    return {
      name: format(date, 'EEE', { locale: ptBR }),
      revenue: dayTotal
    };
  });

  const filteredAppointments = appointments.filter(app => {
    const appDate = parseISO(app.date);
    const isInSelectedMonth = isSameMonth(appDate, appointmentsMonth);
    
    if (!isInSelectedMonth) return false;

    const matchesSearch = 
      app.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      app.customerPhone.includes(searchTerm) ||
      app.vehicleType.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (!matchesSearch) return false;

    if (workflowTab === 'upcoming') {
      return app.status === 'pending' || app.status === 'confirmed';
    }
    if (workflowTab === 'active') {
      return app.status === 'washing';
    }
    if (workflowTab === 'finished') {
      return app.status === 'completed' || app.status === 'cancelled';
    }
    return true;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed': return 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20';
      case 'pending': return 'text-amber-400 bg-amber-400/10 border-amber-400/20';
      case 'washing': return 'text-blue-400 bg-blue-400/10 border-blue-400/20';
      case 'completed': return 'text-zinc-400 bg-zinc-400/10 border-zinc-400/20';
      case 'cancelled': return 'text-red-400 bg-red-400/10 border-red-400/20';
      default: return 'text-zinc-400 bg-zinc-400/10 border-zinc-400/20';
    }
  };

  const getVehicleIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'pickup':
      case 'suv':
        return <Truck className="w-4 h-4" />;
      default:
        return <Car className="w-4 h-4" />;
    }
  };

  return (
    <div className="min-h-screen bg-dark-bg flex flex-col md:flex-row relative overflow-hidden">
      <Background />
      
      {/* Mobile Header */}
      <div className="md:hidden sticky top-0 z-[100] bg-zinc-950/80 backdrop-blur-xl border-b border-white/5 p-4 flex items-center justify-between">
        <button 
          onClick={() => setIsMobileMenuOpen(true)}
          className="w-12 h-12 bg-brand-blue/10 border border-brand-blue/20 rounded-xl flex items-center justify-center text-brand-blue active:scale-90 transition-all"
        >
          <Menu className="w-6 h-6" />
        </button>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <h2 className="font-black text-lg tracking-tighter text-white text-right">BOX CLASS</h2>
            <p className="text-[8px] font-black text-brand-blue uppercase tracking-widest text-right">Admin Panel</p>
          </div>
          <div className="w-10 h-10 bg-black rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20 border border-white/5">
            <img src={cachedLogo || settings?.logoUrl || DEFAULT_LOGO} alt="Logo" className="w-6 h-6 object-contain" />
          </div>
        </div>
      </div>

      {/* Mobile Menu Overlay (Drawer) */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <div className="fixed inset-0 z-[200] md:hidden">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="absolute inset-0 bg-black/90 backdrop-blur-md"
            />
            <motion.div 
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="absolute left-0 top-0 bottom-0 w-[85%] bg-zinc-950 border-r border-white/10 p-8 flex flex-col gap-8 shadow-2xl"
            >
              <div className="flex items-center justify-between">
                <button 
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center text-zinc-500"
                >
                  <X className="w-6 h-6" />
                </button>
                <div className="flex items-center gap-3">
                  <h3 className="font-black text-white uppercase tracking-widest text-sm text-right">Menu</h3>
                  <div className="w-10 h-10 bg-brand-blue/10 rounded-xl flex items-center justify-center border border-brand-blue/20">
                    <LayoutDashboard className="w-5 h-5 text-brand-blue" />
                  </div>
                </div>
              </div>

              <nav className="flex flex-col gap-2 overflow-y-auto no-scrollbar">
                <MobileMenuButton active={activeTab === 'stats'} onClick={() => { setActiveTab('stats'); setIsMobileMenuOpen(false); }} icon={<TrendingUp />} label="Dashboard Principal" />
                <MobileMenuButton active={activeTab === 'appointments'} onClick={() => { setActiveTab('appointments'); setIsMobileMenuOpen(false); }} icon={<Clock />} label="Operações & Board" />
                <MobileMenuButton active={activeTab === 'clients'} onClick={() => { setActiveTab('clients'); setIsMobileMenuOpen(false); }} icon={<Users />} label="Gestão de Clientes" />
                <MobileMenuButton active={activeTab === 'calendar'} onClick={() => { setActiveTab('calendar'); setIsMobileMenuOpen(false); }} icon={<Calendar />} label="Agenda & Horários" />
                <MobileMenuButton active={activeTab === 'services'} onClick={() => { setActiveTab('services'); setIsMobileMenuOpen(false); }} icon={<LayoutDashboard />} label="Serviços & Preços" />
                <MobileMenuButton active={activeTab === 'finance'} onClick={() => { setActiveTab('finance'); setIsMobileMenuOpen(false); }} icon={<Wallet />} label="Controle Financeiro" />
                <MobileMenuButton active={activeTab === 'promotions'} onClick={() => { setActiveTab('promotions'); setIsMobileMenuOpen(false); }} icon={<Tag />} label="Promoções Ativas" />
                <MobileMenuButton active={activeTab === 'settings'} onClick={() => { setActiveTab('settings'); setIsMobileMenuOpen(false); }} icon={<Settings />} label="Configurações" />
              </nav>

              <div className="mt-auto pt-8 border-t border-white/5">
                <button
                  onClick={() => { signOut(); setIsMobileMenuOpen(false); }}
                  className="flex items-center gap-4 px-6 py-5 rounded-2xl text-red-500 bg-red-500/5 transition-all w-full"
                >
                  <LogOut className="w-5 h-5" />
                  <span className="font-black text-[11px] uppercase tracking-[0.2em]">Sair do Sistema</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Sidebar (Desktop) */}
      <aside className="hidden md:flex w-80 bg-zinc-950/40 backdrop-blur-3xl border-r border-white/5 p-10 flex-col gap-12 relative z-10 h-screen overflow-y-auto">
        <div className="flex items-center gap-5 relative group cursor-pointer">
          <div className="absolute -inset-4 bg-brand-blue/10 rounded-3xl blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <div className="w-14 h-14 bg-black rounded-2xl flex items-center justify-center shadow-2xl shadow-blue-500/40 rotate-3 transition-transform group-hover:rotate-6 duration-500 relative overflow-hidden">
            <AnimatePresence mode="wait">
              {!logoLoaded && (
                <motion.div 
                  key="placeholder"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 flex items-center justify-center bg-zinc-900"
                >
                  <Sparkles className="w-6 h-6 text-brand-blue animate-pulse" />
                </motion.div>
              )}
            </AnimatePresence>
            <img 
              src={cachedLogo || settings?.logoUrl || DEFAULT_LOGO} 
              alt="BOX CLASS Logo" 
              onLoad={() => setLogoLoaded(true)}
              className={`w-full h-full object-contain transition-opacity duration-500 ${logoLoaded ? 'opacity-100' : 'opacity-0'}`}
              referrerPolicy="no-referrer"
            />
          </div>
          <div className="relative">
            <h2 className="font-black text-2xl tracking-tighter text-white">BOX CLASS</h2>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_#10b981]" />
              <p className="text-[10px] font-black text-brand-blue uppercase tracking-[0.3em]">Operational</p>
            </div>
          </div>
        </div>

        <nav className="flex flex-col gap-3 flex-1">
          <NavButton active={activeTab === 'stats'} onClick={() => setActiveTab('stats')} icon={<TrendingUp />} label="Dashboard" />
          <NavButton active={activeTab === 'appointments'} onClick={() => setActiveTab('appointments')} icon={<Clock />} label="Operações" />
          <NavButton active={activeTab === 'clients'} onClick={() => setActiveTab('clients')} icon={<Users />} label="Clientes" />
          <NavButton active={activeTab === 'calendar'} onClick={() => setActiveTab('calendar')} icon={<Calendar />} label="Calendário" />
          <NavButton active={activeTab === 'services'} onClick={() => setActiveTab('services')} icon={<LayoutDashboard />} label="Serviços" />
          <NavButton active={activeTab === 'finance'} onClick={() => setActiveTab('finance')} icon={<Wallet />} label="Financeiro" />
          <NavButton active={activeTab === 'promotions'} onClick={() => setActiveTab('promotions')} icon={<Tag />} label="Promoções" />
          <NavButton active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} icon={<Settings />} label="Configurações" />
          
          <div className="mt-auto pt-10 border-t border-white/5">
            <button
              onClick={signOut}
              className="flex items-center gap-4 px-6 py-5 rounded-2xl text-zinc-500 hover:text-red-500 hover:bg-red-500/5 transition-all w-full group overflow-hidden relative"
            >
              <div className="absolute inset-0 bg-red-500/0 group-hover:bg-red-500/5 transition-colors duration-300" />
              <LogOut className="w-5 h-5 group-hover:-translate-x-1 transition-transform relative z-10" />
              <span className="font-black text-[11px] uppercase tracking-[0.2em] relative z-10">Encerrar Sessão</span>
            </button>
          </div>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-10 overflow-y-auto relative z-10 h-screen">
        <header className="hidden md:flex flex-col md:flex-row md:items-center justify-between gap-8 mb-16">
          <div className="relative">
            <div className="absolute -left-4 top-1/2 -translate-y-1/2 w-1 h-12 bg-brand-blue rounded-full shadow-[0_0_15px_#2563eb]" />
            <h2 className="text-4xl font-black text-white tracking-tight mb-2">Gestão Box Class Car</h2>
            <p className="text-zinc-500 text-sm font-medium flex items-center gap-2">
              Controle total da sua estética automotiva premium
              <span className="w-1 h-1 bg-zinc-800 rounded-full" />
              <span className="text-brand-blue font-black uppercase text-[10px] tracking-widest">v2.0</span>
            </p>
          </div>
        </header>

        {activeTab === 'stats' && (
          <div className="space-y-12">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-8">
              <div className="flex items-center gap-4 bg-zinc-900/40 p-4 rounded-2xl border border-white/5 w-fit">
                <button 
                  onClick={() => setStatsMonth(prev => subDays(startOfMonth(prev), 1))}
                  className="p-2 hover:bg-white/5 rounded-xl text-zinc-400 transition-all"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <div className="text-center min-w-[140px]">
                  <p className="text-[10px] font-black text-brand-blue uppercase tracking-widest mb-0.5">Período Stats</p>
                  <p className="text-sm font-black text-white uppercase tracking-tight">
                    {format(statsMonth, 'MMMM yyyy', { locale: ptBR })}
                  </p>
                </div>
                <button 
                  onClick={() => setStatsMonth(prev => addDays(endOfMonth(prev), 1))}
                  className="p-2 hover:bg-white/5 rounded-xl text-zinc-400 transition-all"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 xl:gap-8">
              <StatCard label="Receita Mensal" value={`R$ ${stats.monthlyRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} icon={<DollarSign />} color="text-emerald-500" />
              <StatCard label="Agendamentos Hoje" value={stats.todayAppointments} icon={<Clock />} color="text-brand-blue" />
              <StatCard label="Pendentes" value={stats.pendingAppointments} icon={<Calendar />} color="text-amber-500" />
              <StatCard label="Total Clientes" value={stats.totalClients} icon={<Users />} color="text-violet-500" />
            </div>

            <div className="glass-card p-10 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-brand-blue/5 rounded-full blur-[100px] -mr-32 -mt-32" />
              
              <div className="flex items-center justify-between mb-10 relative z-10">
                <div>
                  <h3 className="text-xl font-black text-white tracking-tight mb-1">Performance Semanal</h3>
                  <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">Receita nos últimos 7 dias</p>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                  <TrendingUp className="w-4 h-4 text-emerald-500" />
                  <span className="text-xs font-black text-emerald-500 uppercase tracking-widest">+15.4%</span>
                </div>
              </div>

              <div className="h-96 relative z-10">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <defs>
                      <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#2563eb" stopOpacity={1} />
                        <stop offset="100%" stopColor="#2563eb" stopOpacity={0.3} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1f1f1f" vertical={false} />
                    <XAxis 
                      dataKey="name" 
                      stroke="#52525b" 
                      fontSize={11} 
                      tickLine={false} 
                      axisLine={false} 
                      dy={15}
                      className="font-black uppercase tracking-widest"
                    />
                    <YAxis 
                      stroke="#52525b" 
                      fontSize={11} 
                      tickLine={false} 
                      axisLine={false} 
                      tickFormatter={(v) => `R$${v}`} 
                      className="font-bold"
                    />
                    <Tooltip 
                      cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                      contentStyle={{ 
                        backgroundColor: 'rgba(9, 9, 11, 0.9)', 
                        border: '1px solid rgba(255, 255, 255, 0.05)', 
                        borderRadius: '16px',
                        backdropFilter: 'blur(12px)',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
                      }}
                      itemStyle={{ color: '#2563eb', fontWeight: '900', fontSize: '12px' }}
                      labelStyle={{ color: '#71717a', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.1em', fontSize: '10px', fontWeight: '900' }}
                    />
                    <Bar dataKey="revenue" fill="url(#barGradient)" radius={[6, 6, 0, 0]} barSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'appointments' && (
          <div className="space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div>
                <h3 className="text-2xl font-black text-white tracking-tight">Painel de Operações</h3>
                <p className="text-sm text-zinc-500 font-medium">Gerencie o fluxo de trabalho da sua estética</p>
              </div>
              <div className="flex items-center gap-4 bg-zinc-900/40 p-3 rounded-2xl border border-white/5">
                <button 
                  onClick={() => setAppointmentsMonth(prev => subDays(startOfMonth(prev), 1))}
                  className="p-1.5 hover:bg-white/5 rounded-lg text-zinc-400 transition-all"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <div className="text-center min-w-[120px]">
                  <p className="text-[9px] font-black text-brand-blue uppercase tracking-widest">Mês Agenda</p>
                  <p className="text-xs font-black text-white uppercase tracking-tight">
                    {format(appointmentsMonth, 'MMMM yyyy', { locale: ptBR })}
                  </p>
                </div>
                <button 
                  onClick={() => setAppointmentsMonth(prev => addDays(endOfMonth(prev), 1))}
                  className="p-1.5 hover:bg-white/5 rounded-lg text-zinc-400 transition-all"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <button 
                  onClick={() => setShowNewCustomerModal(true)}
                  className="flex items-center gap-2 px-6 py-3.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 text-xs font-black uppercase tracking-widest rounded-2xl transition-all border border-white/5 active:scale-95"
                >
                  <UserPlus className="w-4 h-4" />
                  <span className="hidden sm:inline">Novo Cliente</span>
                </button>
                <button 
                  onClick={() => setShowNewAppointmentModal(true)}
                  className="flex items-center gap-2 px-6 py-3.5 bg-brand-blue hover:bg-blue-600 text-white text-xs font-black uppercase tracking-widest rounded-2xl transition-all shadow-lg shadow-blue-500/20 active:scale-95"
                >
                  <Calendar className="w-4 h-4" />
                  <span className="hidden sm:inline">Novo Agendamento</span>
                </button>
                <div className="relative group">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600 group-focus-within:text-brand-blue transition-colors" />
                  <input 
                    type="text" 
                    placeholder="Buscar cliente ou veículo..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full md:w-80 bg-zinc-950/50 border border-white/5 rounded-2xl pl-12 pr-6 py-3.5 text-sm text-white focus:ring-2 focus:ring-brand-blue/50 outline-none transition-all placeholder:text-zinc-800"
                  />
                </div>
                <button 
                  onClick={loadData} 
                  className="w-12 h-12 flex items-center justify-center bg-zinc-950/50 border border-white/5 rounded-2xl hover:bg-zinc-900 transition-all active:scale-90 group"
                >
                  <TrendingUp className="w-5 h-5 text-zinc-500 group-hover:text-brand-blue transition-colors" />
                </button>
              </div>
            </div>

            {/* Workflow Tabs */}
            <div className="flex overflow-x-auto no-scrollbar p-1.5 bg-zinc-950/50 border border-white/5 rounded-[22px] w-full md:w-fit backdrop-blur-xl">
              {[
                { id: 'upcoming', label: 'Próximos', icon: Calendar, count: appointments.filter(a => (a.status === 'pending' || a.status === 'confirmed') && isSameMonth(parseISO(a.date), appointmentsMonth)).length },
                { id: 'active', label: 'No Pátio', icon: Play, count: appointments.filter(a => a.status === 'washing' && isSameMonth(parseISO(a.date), appointmentsMonth)).length },
                { id: 'finished', label: 'Finalizados', icon: CheckCircle2, count: appointments.filter(a => (a.status === 'completed' || a.status === 'cancelled') && isSameMonth(parseISO(a.date), appointmentsMonth)).length },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setWorkflowTab(tab.id as any)}
                  className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-4 md:px-6 py-3 rounded-[18px] text-[10px] md:text-xs font-black uppercase tracking-wider transition-all duration-500 relative overflow-hidden whitespace-nowrap ${
                    workflowTab === tab.id 
                      ? 'text-white shadow-xl shadow-brand-blue/20' 
                      : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  {workflowTab === tab.id && (
                    <motion.div 
                      layoutId="active-workflow"
                      className="absolute inset-0 bg-brand-blue -z-10"
                      transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                    />
                  )}
                  <tab.icon className={`w-3.5 h-3.5 md:w-4 md:h-4 ${workflowTab === tab.id ? 'animate-pulse' : ''}`} />
                  <span>{tab.label}</span>
                  {tab.count > 0 && (
                    <span className={`ml-1 px-2 py-0.5 rounded-lg text-[9px] md:text-[10px] font-black ${
                      workflowTab === tab.id ? 'bg-white/20 text-white' : 'bg-zinc-900 text-zinc-600'
                    }`}>
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Desktop Table */}
            <div className="hidden md:block glass-card overflow-hidden border-white/5">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-zinc-950/50">
                      <th className="p-6 text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] border-b border-white/5">Cliente</th>
                      <th className="p-6 text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] border-b border-white/5">Veículo</th>
                      <th className="p-6 text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] border-b border-white/5">Serviço</th>
                      <th className="p-6 text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] border-b border-white/5">Data/Hora</th>
                      <th className="p-6 text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] border-b border-white/5">Status</th>
                      <th className="p-6 text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] border-b border-white/5 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filteredAppointments.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-20 text-center text-zinc-500">
                          <div className="flex flex-col items-center gap-4 opacity-20">
                            <AlertCircle className="w-12 h-12" />
                            <p className="font-black uppercase tracking-widest text-xs">Nenhum agendamento encontrado</p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      filteredAppointments.map((app) => {
                        const isExpanded = expandedAppointments.has(app.id);
                        return (
                          <React.Fragment key={app.id}>
                            <tr 
                              className={`hover:bg-white/[0.02] transition-colors group cursor-pointer ${isExpanded ? 'bg-brand-blue/5' : ''}`}
                              onClick={() => toggleAppointmentExpansion(app.id)}
                            >
                              <td className="p-6">
                                <div className="flex items-center gap-4">
                                  <div className="w-10 h-10 rounded-2xl bg-brand-blue/10 flex items-center justify-center text-brand-blue font-black text-sm border border-brand-blue/20 rotate-3 group-hover:rotate-6 transition-transform">
                                    {app.customerName.charAt(0)}
                                  </div>
                                  <div>
                                    <div className="font-black text-sm text-white tracking-tight">{app.customerName}</div>
                                    <div className="text-[10px] text-zinc-500 font-bold flex items-center gap-1.5 mt-0.5">
                                      <Phone className="w-3 h-3 text-zinc-600" /> {app.customerPhone}
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td className="p-6">
                                <div className="flex items-center gap-3">
                                  <div className="p-2 bg-zinc-900/50 rounded-xl text-zinc-500 border border-white/5 group-hover:text-brand-blue transition-colors">
                                    {getVehicleIcon(app.vehicleType)}
                                  </div>
                                  <span className="text-[11px] font-black text-zinc-300 uppercase tracking-widest">{app.vehicleType}</span>
                                </div>
                              </td>
                              <td className="p-6">
                                <div className="flex items-center gap-2">
                                  <div className="w-1 h-1 bg-brand-blue rounded-full" />
                                  <span className="text-[10px] font-black text-brand-blue uppercase tracking-widest">R$ {app.totalPrice.toFixed(2)}</span>
                                </div>
                              </td>
                              <td className="p-6">
                                <div className="text-xs font-black text-white tracking-tight mb-0.5">{format(parseISO(app.date), 'dd MMM, yy', { locale: ptBR })}</div>
                                <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">{app.time}</div>
                              </td>
                              <td className="p-6">
                                <div className={`text-[10px] font-black uppercase tracking-[0.15em] px-3 py-2 rounded-xl border border-transparent inline-block ${getStatusColor(app.status)}`}>
                                  {app.status === 'pending' ? 'Pendente' : 
                                   app.status === 'confirmed' ? 'Confirmado' :
                                   app.status === 'washing' ? 'Lavando' :
                                   app.status === 'completed' ? 'Concluído' : 'Cancelado'}
                                </div>
                              </td>
                              <td className="p-6 text-right">
                                <motion.div
                                  animate={{ rotate: isExpanded ? 180 : 0 }}
                                  className="inline-block text-zinc-600"
                                >
                                  <ChevronDown className="w-5 h-5" />
                                </motion.div>
                              </td>
                            </tr>
                            <AnimatePresence>
                              {isExpanded && (
                                <tr className="bg-zinc-950/30">
                                  <td colSpan={6} className="p-0 border-b border-white/5">
                                    <motion.div
                                      initial={{ height: 0, opacity: 0 }}
                                      animate={{ height: 'auto', opacity: 1 }}
                                      exit={{ height: 0, opacity: 0 }}
                                      className="overflow-hidden"
                                    >
                                      <div className="p-8 grid grid-cols-1 md:grid-cols-3 gap-8">
                                        <div className="space-y-4">
                                          <p className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">Serviços e Observações</p>
                                          <div className="space-y-2">
                                            <p className="text-sm text-white font-bold">{app.serviceNames?.join(' + ')}</p>
                                            {app.notes && (
                                              <p className="text-xs text-zinc-500 italic">"{app.notes}"</p>
                                            )}
                                          </div>
                                        </div>
                                        <div className="space-y-4">
                                          <p className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">Alterar Status</p>
                                          <div className="relative inline-block w-full">
                                            <select 
                                              value={app.status}
                                              onChange={(e) => updateStatus(app.id, e.target.value as any)}
                                              className={`w-full text-[10px] font-black uppercase tracking-[0.15em] pl-4 pr-10 py-3 rounded-xl border border-transparent focus:ring-2 focus:ring-brand-blue/50 outline-none cursor-pointer transition-all appearance-none ${getStatusColor(app.status)}`}
                                              onClick={(e) => e.stopPropagation()}
                                            >
                                              <option value="pending">Pendente</option>
                                              <option value="confirmed">Confirmado</option>
                                              <option value="washing">Lavando</option>
                                              <option value="completed">Concluído</option>
                                              <option value="cancelled">Cancelado</option>
                                            </select>
                                            <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-50 rotate-90 pointer-events-none" />
                                          </div>
                                        </div>
                                        <div className="space-y-4">
                                          <p className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">Ações Rápidas</p>
                                          <div className="flex flex-wrap gap-2" onClick={(e) => e.stopPropagation()}>
                                            <button 
                                              onClick={() => handleEditAppointment(app)}
                                              className="p-3 bg-zinc-900/50 text-zinc-500 rounded-xl hover:bg-zinc-800 hover:text-white transition-all border border-white/5"
                                              title="Editar"
                                            >
                                              <Edit2 className="w-4 h-4" />
                                            </button>
                                            <button 
                                              onClick={() => openWhatsApp(app.customerPhone, app.customerName, 'confirmation')}
                                              className="p-3 bg-blue-500/10 text-blue-500 rounded-xl hover:bg-blue-500 hover:text-white transition-all border border-blue-500/20"
                                              title="Confirmar"
                                            >
                                              <CheckCircle2 className="w-4 h-4" />
                                            </button>
                                            <button 
                                              onClick={() => openWhatsApp(app.customerPhone, app.customerName, 'ready')}
                                              className="p-3 bg-emerald-500/10 text-emerald-500 rounded-xl hover:bg-emerald-500 hover:text-white transition-all border border-emerald-500/20"
                                              title="Pronto"
                                            >
                                              <Zap className="w-4 h-4" />
                                            </button>
                                            <button 
                                              onClick={() => generateReceipt(app)}
                                              className="p-3 bg-zinc-900/50 text-zinc-500 rounded-xl hover:bg-brand-blue hover:text-white transition-all border border-white/5"
                                              title="Recibo"
                                            >
                                              <Receipt className="w-4 h-4" />
                                            </button>
                                          </div>
                                        </div>
                                      </div>
                                    </motion.div>
                                  </td>
                                </tr>
                              )}
                            </AnimatePresence>
                          </React.Fragment>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden space-y-6">
              {filteredAppointments.length === 0 ? (
                <div className="glass-card p-20 text-center text-zinc-500">
                  <AlertCircle className="w-12 h-12 mx-auto mb-4 opacity-20" />
                  <p className="font-black uppercase tracking-widest text-xs">Nenhum agendamento</p>
                </div>
              ) : (
                filteredAppointments.map((app) => {
                  const isExpanded = expandedAppointments.has(app.id);
                  return (
                    <motion.div 
                      layout
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      key={app.id} 
                      className={`glass-card p-6 space-y-6 relative overflow-hidden group cursor-pointer transition-all duration-300 ${isExpanded ? 'ring-2 ring-brand-blue/30' : 'hover:bg-zinc-900/40'}`}
                      onClick={() => toggleAppointmentExpansion(app.id)}
                    >
                    {/* Status Indicator Bar */}
                    <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${getStatusColor(app.status).split(' ')[0].replace('text-', 'bg-')}`} />
                    
                    <div className="flex justify-between items-start pl-2 gap-4">
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        <div className="w-12 h-12 rounded-2xl bg-brand-blue/10 flex items-center justify-center text-brand-blue font-black text-lg border border-brand-blue/20 rotate-3 shrink-0">
                          {app.customerName.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-black text-white tracking-tight text-lg truncate">{app.customerName}</h4>
                          <div className="flex flex-wrap items-center gap-2 mt-1">
                            <span className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg border ${getStatusColor(app.status)}`}>
                              {app.status === 'pending' ? 'Pendente' : 
                               app.status === 'confirmed' ? 'Confirmado' :
                               app.status === 'washing' ? 'Lavando' :
                               app.status === 'completed' ? 'Concluído' : 'Cancelado'}
                            </span>
                            {(() => {
                              const profile = profiles.find(p => p.id === app.userId);
                              if (profile && profile.washCount > 0 && profile.washCount % settings.loyaltyGoal === 0) {
                                return (
                                  <span className="text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg border border-emerald-500/20 bg-emerald-500/10 text-emerald-500 flex items-center gap-1">
                                    <Gift className="w-3 h-3" />
                                    Recompensa
                                  </span>
                                );
                              }
                              return null;
                            })()}
                          </div>
                        </div>
                      </div>
                      <div className="text-right shrink-0 flex flex-col items-end">
                        <div className="text-sm font-black text-white tracking-tight">{app.time}</div>
                        <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">{format(parseISO(app.date), 'dd/MM')}</div>
                        <motion.div
                          animate={{ rotate: isExpanded ? 180 : 0 }}
                          className="mt-2 text-zinc-600"
                        >
                          <ChevronDown className="w-4 h-4" />
                        </motion.div>
                      </div>
                    </div>

                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="grid grid-cols-2 gap-4 py-5 border-y border-white/5 pl-2 mt-4">
                            <div className="space-y-1.5">
                              <p className="text-[9px] font-black text-zinc-600 uppercase tracking-[0.2em]">Veículo</p>
                              <div className="flex items-center gap-2 text-[11px] font-black text-zinc-300 uppercase tracking-widest">
                                {getVehicleIcon(app.vehicleType)}
                                <span>{app.vehicleType}</span>
                              </div>
                            </div>
                            <div className="space-y-1.5">
                              <p className="text-[9px] font-black text-zinc-600 uppercase tracking-[0.2em]">Valor Total</p>
                              <p className="text-[11px] font-black text-brand-blue uppercase tracking-widest">R$ {app.totalPrice.toFixed(2)}</p>
                            </div>
                          </div>

                    <div className="space-y-2 pl-2">
                      <p className="text-[9px] font-black text-zinc-600 uppercase tracking-[0.2em]">Serviços Contratados</p>
                      <p className="text-xs text-zinc-400 font-medium leading-relaxed">
                        {app.serviceNames?.join(' + ')}
                      </p>
                    </div>

                    {app.notes && (
                      <div className="p-4 bg-brand-blue/5 rounded-2xl border border-brand-blue/10 ml-2">
                        <p className="text-[9px] font-black text-brand-blue uppercase tracking-widest mb-1.5">Observação</p>
                        <p className="text-xs text-zinc-500 italic font-medium">"{app.notes}"</p>
                      </div>
                    )}

                            <div className="grid grid-cols-2 gap-2 pt-2 pl-2" onClick={(e) => e.stopPropagation()}>
                              <button 
                                onClick={() => handleEditAppointment(app)}
                                className="flex items-center justify-center gap-2 py-3 bg-zinc-900/50 text-zinc-400 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-zinc-800 hover:text-white transition-all border border-white/5 col-span-2"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                                Editar Agendamento
                              </button>
                              <button 
                                onClick={() => openWhatsApp(app.customerPhone, app.customerName, 'confirmation')}
                                className="flex items-center justify-center gap-2 py-3 bg-blue-500/10 text-blue-500 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-blue-500 hover:text-white transition-all border border-blue-500/20"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                Confirmar
                              </button>
                              <button 
                                onClick={() => openWhatsApp(app.customerPhone, app.customerName, 'ready')}
                                className="flex items-center justify-center gap-2 py-3 bg-emerald-500/10 text-emerald-500 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-emerald-500 hover:text-white transition-all border border-emerald-500/20"
                              >
                                <Zap className="w-3.5 h-3.5" />
                                Pronto
                              </button>
                              <button 
                                onClick={() => generateReceipt(app)}
                                className="flex items-center justify-center gap-2 py-3 bg-zinc-900/50 text-zinc-400 rounded-xl border border-white/5 text-[9px] font-black uppercase tracking-widest hover:bg-brand-blue hover:text-white transition-all"
                              >
                                <Receipt className="w-3.5 h-3.5" />
                                Recibo
                              </button>
                              <button 
                                onClick={() => openWhatsApp(app.customerPhone, app.customerName, 'general')}
                                className="flex items-center justify-center gap-2 py-3 bg-zinc-900/50 text-zinc-500 rounded-xl hover:bg-zinc-800 hover:text-white transition-all border border-white/5 text-[9px] font-black uppercase tracking-widest"
                              >
                                <MessageCircle className="w-3.5 h-3.5" />
                                WhatsApp
                              </button>
                              {(() => {
                                const profile = profiles.find(p => p.id === app.userId);
                                if (profile && profile.washCount > 0 && profile.washCount % settings.loyaltyGoal === 0) {
                                  return (
                                    <button 
                                      onClick={() => handleRedeemReward(app.userId, app.id)}
                                      className="flex items-center justify-center gap-2 py-3 bg-emerald-500 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-emerald-600 transition-all border border-emerald-500/20 col-span-2"
                                    >
                                      <Gift className="w-3.5 h-3.5" />
                                      Resgatar Recompensa
                                    </button>
                                  );
                                }
                                return null;
                              })()}
                            </div>
                            
                            <div className="relative pl-2 mt-4" onClick={(e) => e.stopPropagation()}>
                              <select 
                                value={app.status}
                                onChange={(e) => updateStatus(app.id, e.target.value as any)}
                                className="w-full appearance-none bg-zinc-950 border border-white/5 rounded-2xl px-4 py-4 text-[10px] font-black uppercase tracking-widest text-center focus:ring-2 focus:ring-brand-blue/50 outline-none text-zinc-400"
                              >
                                <option value="pending">Pendente</option>
                                <option value="confirmed">Confirmado</option>
                                <option value="washing">Lavando</option>
                                <option value="completed">Concluído</option>
                                <option value="cancelled">Cancelado</option>
                              </select>
                              <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-600 rotate-90 pointer-events-none" />
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {activeTab === 'calendar' && (
          <div className="space-y-6 md:space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div>
                <h3 className="text-2xl font-black text-white tracking-tight">Agenda Visual</h3>
                <p className="text-sm text-zinc-500 font-medium">Visualize e gerencie a ocupação da sua estética</p>
              </div>
              <div className="flex items-center gap-4 bg-zinc-900/40 p-3 rounded-2xl border border-white/5">
                <button 
                  onClick={() => setAppointmentsMonth(prev => subDays(startOfMonth(prev), 1))}
                  className="p-1.5 hover:bg-white/5 rounded-lg text-zinc-400 transition-all"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <div className="text-center min-w-[120px]">
                  <p className="text-[9px] font-black text-brand-blue uppercase tracking-widest">Mês Visual</p>
                  <p className="text-xs font-black text-white uppercase tracking-tight">
                    {format(appointmentsMonth, 'MMMM yyyy', { locale: ptBR })}
                  </p>
                </div>
                <button 
                  onClick={() => setAppointmentsMonth(prev => addDays(endOfMonth(prev), 1))}
                  className="p-1.5 hover:bg-white/5 rounded-lg text-zinc-400 transition-all"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
              {/* Calendar Grid */}
              <div className="lg:col-span-2 glass-card p-1 border-white/5 overflow-hidden">
                <div className="grid grid-cols-7 gap-px bg-white/5">
                  {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => (
                    <div key={day} className="bg-zinc-950/40 py-3 md:py-4 text-center">
                      <span className="text-[8px] md:text-[10px] font-black text-zinc-600 md:text-zinc-500 uppercase tracking-[0.2em] md:tracking-[0.3em]">
                        {day}
                      </span>
                    </div>
                  ))}
                  {Array.from({ length: 42 }).map((_, i) => {
                    const monthStart = startOfMonth(appointmentsMonth);
                    const startDay = monthStart.getDay();
                    const date = addDays(monthStart, i - startDay);
                    const isCurrentMonth = date.getMonth() === appointmentsMonth.getMonth();
                    const dateStr = format(date, 'yyyy-MM-dd');
                    const dayApps = appointments.filter(a => a.date === dateStr && a.status !== 'cancelled');
                    const isTodayDate = isToday(date);
                    const isSelected = isSameDay(date, selectedCalendarDay);

                    return (
                      <div 
                        key={i} 
                        onClick={() => setSelectedCalendarDay(date)}
                        className={`min-h-[60px] md:min-h-[140px] p-1.5 md:p-3 bg-zinc-950/20 transition-all duration-500 relative group cursor-pointer ${
                          !isCurrentMonth ? 'opacity-5 pointer-events-none' : 'hover:bg-white/[0.02]'
                        } ${isSelected ? 'ring-2 ring-brand-blue/50 ring-inset bg-brand-blue/5' : ''}`}
                      >
                        {isTodayDate && (
                          <div className="absolute inset-0 bg-brand-blue/5 pointer-events-none" />
                        )}
                        
                        <div className="flex justify-between items-start mb-1 md:mb-3 relative z-10">
                          <span className={`text-[9px] md:text-xs font-black tracking-tighter ${
                            isTodayDate ? 'text-brand-blue scale-110 md:scale-125 origin-left' : 'text-zinc-700 md:text-zinc-600 group-hover:text-zinc-400'
                          } transition-all`}>
                            {format(date, 'd')}
                          </span>
                          {dayApps.length > 0 && (
                            <div className="flex items-center gap-0.5 md:gap-1">
                              <div className="w-0.5 h-0.5 md:w-1 md:h-1 bg-brand-blue rounded-full animate-pulse" />
                              <span className="text-[7px] md:text-[9px] font-black text-brand-blue uppercase tracking-widest">
                                {dayApps.length}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Desktop view of jobs */}
                        <div className="hidden md:block space-y-1.5 relative z-10">
                          {dayApps.slice(0, 3).map(app => (
                            <motion.div 
                              initial={{ opacity: 0, x: -5 }}
                              animate={{ opacity: 1, x: 0 }}
                              key={app.id} 
                              className={`text-[9px] px-2 py-1.5 rounded-lg border font-black uppercase tracking-wider truncate transition-all ${
                                app.status === 'completed' ? 'bg-zinc-900/50 border-white/5 text-zinc-600' :
                                app.status === 'washing' ? 'bg-brand-blue/10 border-brand-blue/20 text-brand-blue shadow-[0_0_10px_rgba(37,99,235,0.1)]' :
                                app.status === 'confirmed' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' :
                                'bg-amber-500/10 border-amber-500/20 text-amber-500'
                              }`}
                            >
                              <span className="opacity-50 mr-1">{app.time}</span>
                              {app.customerName.split(' ')[0]}
                            </motion.div>
                          ))}
                          {dayApps.length > 3 && (
                            <div className="text-[9px] text-zinc-700 text-center font-black uppercase tracking-widest pt-1">
                              + {dayApps.length - 3}
                            </div>
                          )}
                        </div>

                        {/* Mobile view of jobs (dots) */}
                        <div className="md:hidden flex flex-wrap gap-0.5 mt-0.5">
                          {dayApps.slice(0, 6).map(app => (
                            <div 
                              key={app.id}
                              className={`w-1 h-1 rounded-full ${
                                app.status === 'completed' ? 'bg-zinc-700' :
                                app.status === 'washing' ? 'bg-brand-blue' :
                                app.status === 'confirmed' ? 'bg-emerald-500' :
                                'bg-amber-500'
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Day Details (especially for mobile) */}
              <div className="glass-card p-5 md:p-6 border-white/5 flex flex-col gap-6">
                <div className="flex items-center justify-between border-b border-white/5 pb-4">
                  <div>
                    <h4 className="text-lg font-black text-white tracking-tight">
                      {format(selectedCalendarDay, "EEEE, d 'de' MMMM", { locale: ptBR })}
                    </h4>
                    <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">
                      {appointments.filter(a => a.date === format(selectedCalendarDay, 'yyyy-MM-dd') && a.status !== 'cancelled').length} agendamentos
                    </p>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-brand-blue/10 flex items-center justify-center text-brand-blue border border-brand-blue/20">
                    <Calendar className="w-5 h-5" />
                  </div>
                </div>

                <div className="space-y-3 overflow-y-auto max-h-[400px] pr-2 no-scrollbar">
                  {appointments
                    .filter(a => a.date === format(selectedCalendarDay, 'yyyy-MM-dd') && a.status !== 'cancelled')
                    .sort((a, b) => a.time.localeCompare(b.time))
                    .length === 0 ? (
                      <div className="py-10 text-center">
                        <p className="text-[10px] text-zinc-600 font-black uppercase tracking-widest">Nenhum job para este dia</p>
                      </div>
                    ) : (
                      appointments
                        .filter(a => a.date === format(selectedCalendarDay, 'yyyy-MM-dd') && a.status !== 'cancelled')
                        .sort((a, b) => a.time.localeCompare(b.time))
                        .map(app => (
                          <div 
                            key={app.id}
                            className="p-3.5 bg-zinc-950/50 border border-white/5 rounded-2xl flex items-center justify-between group hover:border-brand-blue/30 transition-all"
                          >
                            <div className="flex items-center gap-3">
                              <div className="text-xs font-black text-white tracking-tight w-10">{app.time}</div>
                              <div>
                                <div className="text-[11px] font-black text-zinc-300 uppercase tracking-wide">{app.customerName}</div>
                                <div className="text-[8px] text-zinc-500 font-bold uppercase tracking-widest flex items-center gap-1.5 mt-0.5">
                                  {getVehicleIcon(app.vehicleType)}
                                  {app.vehicleType}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className={`px-2 py-1 rounded-lg text-[7px] font-black uppercase tracking-widest border ${getStatusColor(app.status)}`}>
                                {app.status === 'pending' ? 'Pendente' : 
                                 app.status === 'confirmed' ? 'Confirmado' :
                                 app.status === 'washing' ? 'Lavando' :
                                 app.status === 'completed' ? 'Concluído' : 'Cancelado'}
                              </div>
                              <button 
                                onClick={() => handleEditAppointment(app)}
                                className="w-8 h-8 flex items-center justify-center bg-zinc-900/50 text-zinc-500 rounded-lg hover:bg-zinc-800 hover:text-white transition-all border border-white/5"
                                title="Editar Agendamento"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))
                    )}
                </div>

                <button 
                  onClick={() => {
                    setNewAppointment(prev => ({ ...prev, date: format(selectedCalendarDay, 'yyyy-MM-dd') }));
                    setShowNewAppointmentModal(true);
                  }}
                  className="w-full py-4 bg-brand-blue/10 hover:bg-brand-blue text-brand-blue hover:text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border border-brand-blue/20 mt-auto active:scale-95"
                >
                  Novo Job para este dia
                </button>
              </div>
            </div>
          </div>
        )}



        {activeTab === 'services' && (
          <div className="space-y-10">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div>
                <h3 className="text-2xl font-black text-white tracking-tight">Catálogo de Serviços</h3>
                <p className="text-sm text-zinc-500 font-medium">Defina os serviços e preços da sua estética</p>
              </div>
              <button 
                onClick={() => {
                  setNewService({
                    name: '',
                    description: '',
                    category: 'lavagem',
                    duration: 60,
                    prices: {
                      hatch: 0,
                      sedan: 0,
                      suv: 0,
                      pickup: 0
                    },
                    active: true
                  });
                  setShowNewServiceModal(true);
                }}
                className="flex items-center gap-3 px-8 py-4 bg-brand-blue text-white rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] hover:bg-blue-700 transition-all shadow-xl shadow-blue-500/20 active:scale-95 group"
              >
                <Plus className="w-4 h-4 group-hover:rotate-90 transition-transform" />
                Novo Serviço
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {services.map((s) => (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  key={s.id} 
                  className="glass-card p-8 group hover:border-brand-blue/50 transition-all duration-500 relative overflow-hidden bg-zinc-900/60 border-white/10"
                >
                  <div className="absolute top-0 right-0 w-32 h-32 bg-brand-blue/5 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-brand-blue/10 transition-colors" />
                  
                  <div className="flex justify-between items-start relative z-10 mb-8">
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-brand-blue/10 flex items-center justify-center text-brand-blue border border-brand-blue/20">
                          <LayoutDashboard className="w-5 h-5" />
                        </div>
                        <h4 className="text-xl font-black text-white tracking-tight">{s.name}</h4>
                      </div>
                      <p className="text-sm text-zinc-500 font-medium leading-relaxed max-w-md">{s.description}</p>
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => {
                          setNewService({
                            id: s.id,
                            name: s.name,
                            description: s.description,
                            category: s.category,
                            duration: s.duration,
                            prices: { ...s.prices },
                            active: s.active
                          } as any);
                          setShowNewServiceModal(true);
                        }}
                        className="w-10 h-10 flex items-center justify-center bg-zinc-900/50 text-zinc-500 rounded-xl hover:bg-brand-blue hover:text-white transition-all border border-white/5"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => {
                          setDeleteConfirmation({
                            id: s.id,
                            type: 'service',
                            title: `Deseja realmente excluir o serviço "${s.name}"?`
                          });
                        }}
                        className="w-10 h-10 flex items-center justify-center bg-zinc-900/50 text-zinc-500 rounded-xl hover:bg-red-500 hover:text-white transition-all border border-white/5"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-8 border-t border-white/5 relative z-10">
                    {Object.entries(s.prices).map(([type, price]) => (
                      <div key={type} className="bg-zinc-950/50 p-4 rounded-2xl border border-white/5 group/price hover:border-brand-blue/20 transition-all">
                        <span className="text-[9px] font-black text-zinc-600 uppercase tracking-[0.2em] block mb-2 group-hover/price:text-brand-blue transition-colors">
                          {type === 'hatch' ? 'Hatch' : type === 'sedan' ? 'Sedan' : type === 'suv' ? 'SUV' : 'Pickup'}
                        </span>
                        <span className="text-sm font-black text-white tracking-tight">R$ {(price as number).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="max-w-4xl space-y-10">
            <div>
              <h3 className="text-2xl font-black text-white tracking-tight">Configurações do Sistema</h3>
              <p className="text-sm text-zinc-500 font-medium">Ajuste os parâmetros operacionais da sua estética</p>
            </div>
            
            <form onSubmit={handleSaveSettings} className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="glass-card p-10 space-y-10 bg-zinc-900/60 border-white/10">
                <div className="space-y-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-brand-blue/20 flex items-center justify-center text-brand-blue border border-brand-blue/30">
                      <Clock className="w-5 h-5" />
                    </div>
                    <h4 className="text-lg font-black text-white tracking-tight">Horários de Funcionamento</h4>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    {TIME_SLOTS.map(t => (
                      <label key={t} className="flex items-center gap-4 p-4 bg-zinc-900/40 rounded-2xl border border-white/10 cursor-pointer hover:border-brand-blue/50 transition-all group">
                        <div className="relative flex items-center">
                          <input 
                            type="checkbox" 
                            checked={settings.businessHours.includes(t)}
                            onChange={(e) => {
                              const newHours = e.target.checked 
                                ? [...settings.businessHours, t].sort()
                                : settings.businessHours.filter(h => h !== t);
                              setSettings({ ...settings, businessHours: newHours });
                            }}
                            className="peer appearance-none w-5 h-5 bg-zinc-800 border border-white/20 rounded-lg checked:bg-brand-blue checked:border-brand-blue transition-all" 
                          />
                          <CheckCircle2 className="absolute inset-0 w-5 h-5 text-white opacity-0 peer-checked:opacity-100 transition-opacity p-1" />
                        </div>
                        <span className="text-[11px] font-black text-zinc-300 uppercase tracking-widest group-hover:text-white transition-colors">{t}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.3em]">Capacidade por Horário</label>
                  <div className="relative">
                    <Users className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                    <input 
                      type="number" 
                      value={settings.capacity}
                      onChange={(e) => setSettings({ ...settings, capacity: parseInt(e.target.value) })}
                      className="w-full bg-zinc-900/50 border border-white/10 rounded-2xl pl-14 pr-6 py-4 text-sm text-white focus:ring-2 focus:ring-brand-blue/50 outline-none transition-all" 
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.3em]">WhatsApp de Contato</label>
                  <div className="relative">
                    <Phone className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                    <IMaskInput
                      mask="(00) 00000-0000"
                      value={settings.whatsappNumber || ''}
                      onAccept={(value: any) => setSettings({ ...settings, whatsappNumber: value })}
                      placeholder="(00) 00000-0000"
                      className="w-full bg-zinc-900/50 border border-white/10 rounded-2xl pl-14 pr-6 py-4 text-sm text-white focus:ring-2 focus:ring-brand-blue/50 outline-none transition-all" 
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-8">
                <div className="glass-card p-10 space-y-8 bg-zinc-900/60 border-white/10">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-500 border border-amber-500/30">
                      <Star className="w-5 h-5" />
                    </div>
                    <h4 className="text-lg font-black text-white tracking-tight">Cartão Fidelidade</h4>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-zinc-900/40 rounded-2xl border border-white/10">
                    <div className="space-y-1">
                      <p className="text-xs font-black text-white uppercase tracking-widest">Programa Ativo</p>
                      <p className="text-[10px] text-zinc-400 font-bold">Habilitar recompensas para clientes</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSettings({ ...settings, loyaltyEnabled: !settings.loyaltyEnabled })}
                      className={`w-12 h-6 rounded-full transition-all relative ${settings.loyaltyEnabled ? 'bg-emerald-500' : 'bg-zinc-800'}`}
                    >
                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${settings.loyaltyEnabled ? 'left-7' : 'left-1'}`} />
                    </button>
                  </div>

                  <div className="space-y-4">
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.3em]">Meta de Lavagens (Objetivo)</label>
                    <div className="relative">
                      <input 
                        type="number" 
                        value={settings.loyaltyGoal}
                        onChange={(e) => setSettings({ ...settings, loyaltyGoal: parseInt(e.target.value) })}
                        className="w-full bg-zinc-900/50 border border-white/10 rounded-2xl px-6 py-4 text-sm text-white focus:ring-2 focus:ring-amber-500/50 outline-none transition-all" 
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.3em]">Prêmio da Recompensa</label>
                    <div className="relative">
                      <input 
                        type="text" 
                        value={settings.loyaltyReward}
                        onChange={(e) => setSettings({ ...settings, loyaltyReward: e.target.value })}
                        placeholder="Ex: Cera de Carnaúba"
                        className="w-full bg-zinc-900/50 border border-white/10 rounded-2xl px-6 py-4 text-sm text-white focus:ring-2 focus:ring-amber-500/50 outline-none transition-all" 
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.3em]">Frase do Cartão Fidelidade</label>
                    <div className="relative">
                      <textarea 
                        rows={3}
                        value={settings.loyaltyMessageTemplate || ''}
                        onChange={(e) => setSettings({ ...settings, loyaltyMessageTemplate: e.target.value })}
                        placeholder="Ex: Faltam {remaining} lavagens para você ganhar um {reward} por nossa conta!"
                        className="w-full bg-zinc-900/50 border border-white/10 rounded-2xl px-6 py-4 text-sm text-white focus:ring-2 focus:ring-amber-500/50 outline-none transition-all resize-none" 
                      />
                      <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest mt-2">
                        Use <span className="text-amber-500">{'{remaining}'}</span> para o número de lavagens que faltam e <span className="text-amber-500">{'{reward}'}</span> para o nome do prêmio.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="glass-card p-10 space-y-8 bg-zinc-900/60 border-white/10">
                  <div className="flex items-center gap-4 mb-2">
                    <div className="w-12 h-12 rounded-2xl bg-brand-blue flex items-center justify-center text-white shadow-lg shadow-blue-500/40">
                      <Sparkles className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="text-lg font-black text-white tracking-tight">Identidade Visual</h4>
                      <p className="text-xs text-brand-blue font-black uppercase tracking-widest">Personalize sua marca</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.3em]">Logo da Empresa</label>
                    <div className="flex flex-col md:flex-row gap-6 items-start">
                      <div className="w-24 h-24 bg-black rounded-2xl flex items-center justify-center border border-white/10 overflow-hidden shadow-xl">
                        <img 
                          src={cachedLogo || settings.logoUrl || DEFAULT_LOGO} 
                          alt="Preview Logo" 
                          className="w-full h-full object-contain"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                      <div className="flex-1 w-full space-y-4">
                        <div className="relative group">
                          <input 
                            type="text" 
                            value={settings.logoUrl || ''}
                            onChange={(e) => setSettings({ ...settings, logoUrl: e.target.value })}
                            placeholder="Cole aqui a URL da sua logo"
                            className="w-full bg-zinc-900/50 border border-white/10 rounded-2xl px-6 py-4 text-sm text-white focus:ring-2 focus:ring-brand-blue/50 outline-none transition-all" 
                          />
                        </div>
                        
                        <div className="flex items-center gap-4">
                          <label className="flex-1 cursor-pointer group">
                            <div className="flex items-center justify-center gap-3 py-4 px-6 bg-zinc-900/50 border border-white/10 border-dashed rounded-2xl group-hover:border-brand-blue/50 group-hover:bg-brand-blue/5 transition-all">
                              <Upload className="w-4 h-4 text-zinc-500 group-hover:text-brand-blue" />
                              <span className="text-xs font-black text-zinc-500 group-hover:text-white uppercase tracking-widest">Upload da Imagem</span>
                            </div>
                            <input 
                              type="file" 
                              accept="image/*" 
                              capture="environment"
                              onChange={handleLogoUpload} 
                              className="hidden" 
                            />
                          </label>
                          
                          {settings.logoUrl && (
                            <button 
                              type="button"
                              onClick={() => setSettings({ ...settings, logoUrl: '' })}
                              className="p-4 bg-red-500/10 text-red-500 rounded-2xl border border-red-500/20 hover:bg-red-500 hover:text-white transition-all"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                        
                        <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest leading-relaxed">
                          Recomendado: Imagem PNG com fundo transparente ou fundo preto.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="glass-card p-10 bg-brand-blue/5 border-brand-blue/10">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-12 h-12 rounded-2xl bg-brand-blue flex items-center justify-center text-white shadow-lg shadow-blue-500/40">
                      <TrendingUp className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="text-lg font-black text-white tracking-tight">Status do Sistema</h4>
                      <p className="text-xs text-brand-blue font-black uppercase tracking-widest">Todos os serviços ativos</p>
                    </div>
                  </div>
                  <p className="text-sm text-zinc-400 font-medium leading-relaxed mb-8">
                    Seu sistema está operando com performance máxima. As notificações via WhatsApp e sincronização em tempo real estão ativas.
                  </p>
                  <div className="flex items-center gap-2 text-[10px] font-black text-zinc-500 uppercase tracking-widest">
                    <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                    Última sincronização: Agora mesmo
                  </div>
                </div>
              </div>

              <div className="md:col-span-2 pt-6">
                <button 
                  type="submit" 
                  disabled={isSavingSettings}
                  className="w-full py-6 bg-gradient-to-r from-brand-blue to-blue-700 text-white rounded-2xl text-sm font-black uppercase tracking-[0.3em] shadow-2xl shadow-blue-500/20 hover:shadow-blue-500/40 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-3"
                >
                  {isSavingSettings ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Salvando Alterações...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-5 h-5" />
                      <span>Salvar Todas as Configurações</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}
        {activeTab === 'clients' && (
          <div className="space-y-10">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div>
                <h3 className="text-2xl font-black text-white tracking-tight">Base de Clientes</h3>
                <p className="text-sm text-zinc-500 font-medium">Gerencie o relacionamento com seus clientes premium</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="relative group">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 group-focus-within:text-brand-blue transition-colors" />
                  <input 
                    type="text" 
                    placeholder="Buscar por nome ou telefone..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="bg-zinc-900/50 border border-white/5 rounded-2xl pl-12 pr-6 py-3 text-sm text-white focus:ring-2 focus:ring-brand-blue/50 outline-none transition-all w-full md:w-80"
                  />
                </div>
                <button 
                  onClick={() => setShowNewCustomerModal(true)}
                  className="px-6 py-3 bg-brand-blue hover:bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-xl shadow-blue-500/20 flex items-center gap-2"
                >
                  <UserPlus className="w-4 h-4" />
                  Novo Cliente
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {profiles
                .filter(p => 
                  (p.role === 'client' || !p.role) && (
                    p.displayName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                    p.phone.includes(searchTerm)
                  )
                )
                .sort((a, b) => (b.washCount || 0) - (a.washCount || 0))
                .map((p) => (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  key={p.id} 
                  className="glass-card p-6 group hover:border-brand-blue/50 transition-all duration-500 relative overflow-hidden bg-zinc-900/60 border-white/10"
                >
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-12 h-12 rounded-2xl bg-zinc-950 flex items-center justify-center text-brand-blue border border-white/5 group-hover:border-brand-blue/30 transition-all">
                      <User className="w-6 h-6" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-lg font-black text-white tracking-tight truncate">{p.displayName}</h4>
                      <p className="text-[10px] font-black text-brand-blue uppercase tracking-widest">{p.phone}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="bg-zinc-950/50 p-4 rounded-2xl border border-white/5">
                      <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-1">Lavagens</p>
                      <p className="text-xl font-black text-white">{p.washCount || 0}</p>
                    </div>
                    <div className="bg-zinc-950/50 p-4 rounded-2xl border border-white/5">
                      <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-1">Veículo</p>
                      <p className="text-xs font-black text-white uppercase truncate">{p.carModel || 'Não informado'}</p>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button 
                      onClick={() => {
                        setNewAppointment({
                          ...newAppointment,
                          customerName: p.displayName,
                          customerPhone: p.phone,
                          vehicleType: p.preferredVehicleType || 'hatch',
                          userId: p.id
                        });
                        setShowNewAppointmentModal(true);
                      }}
                      className="flex-1 px-4 py-3 bg-brand-blue/10 hover:bg-brand-blue text-brand-blue hover:text-white text-[9px] font-black uppercase tracking-widest rounded-xl transition-all border border-brand-blue/20 flex items-center justify-center gap-2"
                    >
                      <Calendar className="w-3.5 h-3.5" />
                      Novo Agendamento
                    </button>
                    <button 
                      onClick={() => window.open(`https://wa.me/55${p.phone.replace(/\D/g, '')}`, '_blank')}
                      className="w-12 h-12 flex items-center justify-center bg-zinc-900/50 text-zinc-500 rounded-xl hover:bg-emerald-500 hover:text-white transition-all border border-white/5"
                    >
                      <Phone className="w-4 h-4" />
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'finance' && (
          <div className="space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div>
                <h3 className="text-2xl font-black text-white tracking-tight">Gestão Financeira</h3>
                <p className="text-sm text-zinc-500 font-medium">Controle de despesas e lucro real</p>
              </div>
              <div className="flex flex-wrap items-center gap-3 md:gap-4">
                <button
                  onClick={handleExportFinance}
                  className="flex items-center gap-2 px-4 py-3.5 bg-zinc-900/60 hover:bg-zinc-800 text-zinc-400 hover:text-white text-[10px] font-black uppercase tracking-widest rounded-2xl transition-all border border-white/5 active:scale-95"
                >
                  <Download className="w-4 h-4" />
                  <span>Exportar CSV</span>
                </button>
                <div className="flex bg-zinc-900/60 p-1 rounded-xl border border-white/5">
                  <button
                    onClick={() => setFinanceView('monthly')}
                    className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${financeView === 'monthly' ? 'bg-brand-blue text-white shadow-lg shadow-blue-500/20' : 'text-zinc-500 hover:text-zinc-300'}`}
                  >
                    Mensal
                  </button>
                  <button
                    onClick={() => setFinanceView('annual')}
                    className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${financeView === 'annual' ? 'bg-brand-blue text-white shadow-lg shadow-blue-500/20' : 'text-zinc-500 hover:text-zinc-300'}`}
                  >
                    Anual
                  </button>
                </div>
                <button 
                  onClick={() => setShowNewExpenseModal(true)}
                  className="flex items-center gap-2 px-6 py-3.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-black uppercase tracking-widest rounded-2xl transition-all shadow-lg shadow-emerald-500/20 active:scale-95"
                >
                  <Plus className="w-4 h-4" />
                  <span>Nova Despesa</span>
                </button>
              </div>
            </div>

            {/* Seletor de Mês/Ano */}
            <div className="flex items-center gap-4 bg-zinc-900/40 p-4 rounded-2xl border border-white/5 w-fit">
              <button 
                onClick={() => setFinanceMonth(prev => subDays(startOfMonth(prev), 1))}
                className="p-2 hover:bg-white/5 rounded-xl text-zinc-400 transition-all"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div className="text-center min-w-[140px]">
                <p className="text-[10px] font-black text-brand-blue uppercase tracking-widest mb-0.5">Período Financeiro</p>
                <p className="text-sm font-black text-white uppercase tracking-tight">
                  {financeView === 'monthly' 
                    ? format(financeMonth, 'MMMM yyyy', { locale: ptBR })
                    : format(financeMonth, 'yyyy', { locale: ptBR })}
                </p>
              </div>
              <button 
                onClick={() => setFinanceMonth(prev => addDays(endOfMonth(prev), 1))}
                className="p-2 hover:bg-white/5 rounded-xl text-zinc-400 transition-all"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="glass-card p-8 bg-zinc-900/60 border-white/10 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                  <TrendingUp className="w-12 h-12 text-brand-blue" />
                </div>
                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2">Faturamento {financeView === 'monthly' ? 'Mensal' : 'Anual'}</p>
                <p className="text-3xl font-black text-white">
                  R$ {(financeView === 'monthly' ? stats.monthlyRevenue : stats.annualRevenue).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
                {financeView === 'monthly' && (
                  <p className="text-[10px] text-zinc-500 mt-2 font-bold uppercase tracking-widest">
                    Acumulado no ano: R$ {stats.annualRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                )}
              </div>
              <div className="glass-card p-8 bg-zinc-900/60 border-white/10 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                  <DollarSign className="w-12 h-12 text-red-500" />
                </div>
                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2">Total Despesas ({financeView === 'monthly' ? 'Mensal' : 'Anual'})</p>
                <p className="text-3xl font-black text-red-500">
                  R$ {(financeView === 'monthly' ? monthlyExpenseTotal : annualExpenseTotal).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className="glass-card p-8 bg-emerald-500/10 border-emerald-500/30 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                  <CheckCircle2 className="w-12 h-12 text-emerald-500" />
                </div>
                <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-2">Lucro Real ({financeView === 'monthly' ? 'Mensal' : 'Anual'})</p>
                <p className="text-3xl font-black text-emerald-500">
                  R$ {((financeView === 'monthly' ? stats.monthlyRevenue : stats.annualRevenue) - (financeView === 'monthly' ? monthlyExpenseTotal : annualExpenseTotal)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
                <p className="text-[10px] text-emerald-500/60 mt-2 font-bold uppercase tracking-widest">
                  Margem: {((financeView === 'monthly' ? stats.monthlyRevenue : stats.annualRevenue) > 0 
                    ? (((financeView === 'monthly' ? stats.monthlyRevenue : stats.annualRevenue) - (financeView === 'monthly' ? monthlyExpenseTotal : annualExpenseTotal)) / (financeView === 'monthly' ? stats.monthlyRevenue : stats.annualRevenue) * 100).toFixed(1)
                    : '0')}%
                </p>
              </div>
              <div className="glass-card p-8 bg-zinc-900/60 border-white/10 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                  <Tag className="w-12 h-12 text-amber-500" />
                </div>
                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2">Ticket Médio ({financeView === 'monthly' ? 'Mês' : 'Ano'})</p>
                <p className="text-3xl font-black text-white">
                  R$ {stats.averageTicket.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Gráfico de Desempenho */}
              <div className="lg:col-span-2 glass-card p-8 bg-zinc-900/60 border-white/10">
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h4 className="text-lg font-black text-white tracking-tight">Desempenho Anual</h4>
                    <p className="text-xs text-zinc-500 font-medium uppercase tracking-widest">Comparativo mensal de {financeMonth.getFullYear()}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-brand-blue rounded-full" />
                      <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Receita</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-red-500 rounded-full" />
                      <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Despesa</span>
                    </div>
                  </div>
                </div>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                      <XAxis 
                        dataKey="name" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fill: '#71717a', fontSize: 10, fontWeight: 900 }} 
                      />
                      <YAxis 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fill: '#71717a', fontSize: 10, fontWeight: 900 }}
                        tickFormatter={(value) => `R$ ${value}`}
                      />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#09090b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                        itemStyle={{ fontSize: '12px', fontWeight: '900', textTransform: 'uppercase' }}
                      />
                      <Bar dataKey="receita" fill="#2563eb" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="despesa" fill="#ef4444" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Distribuição de Despesas */}
              <div className="glass-card p-8 bg-zinc-900/60 border-white/10">
                <h4 className="text-lg font-black text-white tracking-tight mb-8">Distribuição de Gastos</h4>
                <div className="h-[250px] w-full">
                  {expenseDistribution.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={expenseDistribution}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {expenseDistribution.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#09090b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                          itemStyle={{ fontSize: '12px', fontWeight: '900', textTransform: 'uppercase' }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-zinc-500 text-xs font-black uppercase tracking-widest">
                      Sem dados de despesas
                    </div>
                  )}
                </div>
                <div className="mt-4 space-y-2">
                  {expenseDistribution.map((item, index) => (
                    <div key={item.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                        <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">{item.name}</span>
                      </div>
                      <span className="text-[10px] font-black text-white">R$ {item.value.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Ranking de Serviços */}
              <div className="glass-card p-8 bg-zinc-900/60 border-white/10">
                <h4 className="text-lg font-black text-white tracking-tight mb-6">Serviços que mais Rendem</h4>
                <div className="space-y-6">
                  {sortedServices.length > 0 ? (
                    sortedServices.map((service, index) => (
                      <div key={service.name} className="space-y-2">
                        <div className="flex justify-between items-end">
                          <div>
                            <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block mb-1">#{index + 1} {service.count}x</span>
                            <span className="text-sm font-black text-white tracking-tight">{service.name}</span>
                          </div>
                          <span className="text-sm font-black text-brand-blue">R$ {service.revenue.toFixed(2)}</span>
                        </div>
                        <div className="w-full h-1.5 bg-zinc-950 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-brand-blue rounded-full" 
                            style={{ width: `${(service.revenue / sortedServices[0].revenue) * 100}%` }}
                          />
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="py-10 text-center text-zinc-500 text-xs font-black uppercase tracking-widest">
                      Sem dados de serviços
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Desktop Table */}
            <div className="hidden md:block glass-card overflow-hidden border-white/5">
              <div className="p-6 border-b border-white/5 flex items-center justify-between">
                <h4 className="text-sm font-black text-white uppercase tracking-widest">Detalhamento de Despesas</h4>
                <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">
                  Mostrando {financeView === 'monthly' ? 'mês atual' : 'ano atual'}
                </p>
              </div>
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-zinc-950/50">
                    <th className="p-6 text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] border-b border-white/5">Data</th>
                    <th className="p-6 text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] border-b border-white/5">Descrição</th>
                    <th className="p-6 text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] border-b border-white/5">Categoria</th>
                    <th className="p-6 text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] border-b border-white/5 text-right">Valor</th>
                    <th className="p-6 text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] border-b border-white/5 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {(financeView === 'monthly' ? filteredExpenses : annualExpenses).length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-20 text-center text-zinc-500">Nenhuma despesa lançada para este período</td>
                    </tr>
                  ) : (
                    (financeView === 'monthly' ? filteredExpenses : annualExpenses).map((exp) => (
                      <tr key={exp.id} className="hover:bg-white/[0.02] transition-colors group">
                        <td className="p-6 text-xs font-bold text-zinc-400">{format(parseISO(exp.date), 'dd/MM/yyyy')}</td>
                        <td className="p-6 text-sm font-black text-white">{exp.description}</td>
                        <td className="p-6">
                          <span className="text-[9px] font-black px-3 py-1 bg-zinc-900 text-zinc-500 rounded-lg border border-white/5 uppercase tracking-widest">
                            {exp.category === 'products' ? 'Produtos' :
                             exp.category === 'rent' ? 'Aluguel' :
                             exp.category === 'electricity' ? 'Energia' :
                             exp.category === 'water' ? 'Água' : 'Outros'}
                          </span>
                        </td>
                        <td className="p-6 text-right text-sm font-black text-red-400">R$ {exp.amount.toFixed(2)}</td>
                        <td className="p-6 text-right">
                          <button 
                            onClick={() => handleDeleteExpense(exp.id)}
                            className="w-10 h-10 flex items-center justify-center bg-zinc-900/50 text-zinc-600 rounded-xl hover:bg-red-500 hover:text-white transition-all active:scale-90 border border-white/5"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden space-y-4">
              {(financeView === 'monthly' ? filteredExpenses : annualExpenses).length === 0 ? (
                <div className="glass-card p-20 text-center text-zinc-500">Nenhuma despesa lançada</div>
              ) : (
                (financeView === 'monthly' ? filteredExpenses : annualExpenses).map((exp) => (
                  <div key={exp.id} className="glass-card p-6 space-y-4 relative overflow-hidden">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1">{format(parseISO(exp.date), 'dd/MM/yyyy')}</p>
                        <h4 className="font-black text-white tracking-tight">{exp.description}</h4>
                      </div>
                      <button 
                        onClick={() => handleDeleteExpense(exp.id)}
                        className="w-10 h-10 flex items-center justify-center bg-red-500/10 text-red-500 rounded-xl active:scale-90 border border-red-500/20"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    
                    <div className="flex items-center justify-between pt-2 border-t border-white/5">
                      <span className="text-[9px] font-black px-3 py-1 bg-zinc-900 text-zinc-500 rounded-lg border border-white/5 uppercase tracking-widest">
                        {exp.category === 'products' ? 'Produtos' :
                         exp.category === 'rent' ? 'Aluguel' :
                         exp.category === 'electricity' ? 'Energia' :
                         exp.category === 'water' ? 'Água' : 'Outros'}
                      </span>
                      <p className="text-sm font-black text-red-400">R$ {exp.amount.toFixed(2)}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === 'promotions' && (
          <div className="space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div>
                <h3 className="text-2xl font-black text-white tracking-tight">Gestão de Promoções</h3>
                <p className="text-sm text-zinc-500 font-medium">Crie e edite ofertas para seus clientes</p>
              </div>
              <button 
                onClick={() => setShowNewPromotionModal(true)}
                className="flex items-center gap-2 px-6 py-3.5 bg-brand-blue hover:bg-blue-600 text-white text-xs font-black uppercase tracking-widest rounded-2xl transition-all shadow-lg shadow-blue-500/20 active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span>Nova Promoção</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
              {promotions.length === 0 ? (
                <div className="col-span-full glass-card p-20 text-center text-zinc-500">Nenhuma promoção ativa</div>
              ) : (
                promotions.map((promo) => (
                  <motion.div 
                    key={promo.id}
                    layout
                    className="glass-card group overflow-hidden border-white/5 hover:border-brand-blue/30 transition-all"
                  >
                    <div className="aspect-video bg-zinc-950 relative overflow-hidden">
                      {promo.imageUrl ? (
                        <img src={promo.imageUrl} alt={promo.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-zinc-800">
                          <ImageIcon className="w-12 h-12" />
                        </div>
                      )}
                      <div className="absolute top-4 right-4">
                        <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${promo.active ? 'bg-emerald-500 text-white' : 'bg-zinc-800 text-zinc-500'}`}>
                          {promo.active ? 'Ativa' : 'Pausada'}
                        </span>
                      </div>
                    </div>
                    <div className="p-8 space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xl font-black text-white tracking-tight">{promo.title}</h4>
                        {promo.discountType === 'percentage' && (
                          <span className="bg-emerald-500/10 text-emerald-500 text-[10px] font-black px-2 py-1 rounded-lg border border-emerald-500/20">-{promo.discountValue}%</span>
                        )}
                        {promo.discountType === 'fixed' && (
                          <span className="bg-emerald-500/10 text-emerald-500 text-[10px] font-black px-2 py-1 rounded-lg border border-emerald-500/20">-R$ {promo.discountValue}</span>
                        )}
                        {promo.discountType === 'bundle' && (
                          <span className="bg-brand-blue/10 text-brand-blue text-[10px] font-black px-2 py-1 rounded-lg border border-brand-blue/20">R$ {promo.fixedPrice}</span>
                        )}
                      </div>
                      <p className="text-sm text-zinc-500 leading-relaxed line-clamp-2">{promo.description}</p>
                      
                      {promo.serviceIds && promo.serviceIds.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {promo.serviceIds.map(sid => {
                            const s = services.find(srv => srv.id === sid);
                            return s ? (
                              <span key={sid} className="text-[8px] font-black text-zinc-600 uppercase tracking-widest bg-zinc-950 px-2 py-1 rounded border border-white/5">
                                {s.name}
                              </span>
                            ) : null;
                          })}
                        </div>
                      )}

                      <div className="pt-6 border-t border-white/5 flex items-center justify-end gap-3">
                        <button 
                          onClick={() => {
                            setNewPromotion({
                              id: promo.id,
                              title: promo.title,
                              description: promo.description,
                              active: promo.active,
                              imageUrl: promo.imageUrl || '',
                              discountType: promo.discountType,
                              discountValue: promo.discountValue || 0,
                              fixedPrice: promo.fixedPrice || 0,
                              serviceIds: promo.serviceIds || []
                            });
                            setEditingPromotionId(promo.id);
                            setShowNewPromotionModal(true);
                          }}
                          className="w-10 h-10 flex items-center justify-center bg-zinc-900/50 text-zinc-600 rounded-xl hover:bg-brand-blue hover:text-white transition-all border border-white/5"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleDeletePromotion(promo.id)}
                          className="w-10 h-10 flex items-center justify-center bg-zinc-900/50 text-zinc-600 rounded-xl hover:bg-red-500 hover:text-white transition-all border border-white/5"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => dbService.savePromotion({ ...promo, active: !promo.active }).then(loadData)}
                          className="px-6 py-2.5 bg-zinc-900 text-zinc-400 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-zinc-800 hover:text-white transition-all border border-white/5"
                        >
                          {promo.active ? 'Pausar' : 'Ativar'}
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </div>
        )}
      </main>

      {/* Completion Modal */}
      <AnimatePresence>
        {completingId && (
          <div className="fixed inset-0 z-[100] flex items-start sm:items-center justify-center p-4 pt-10 sm:pt-0 overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setCompletingId(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-xl" 
            />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="glass-card w-full max-w-xl p-10 relative z-10 border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.5)]"
            >
              <div className="flex items-center justify-between mb-8 sm:mb-10 gap-4">
                <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 border border-emerald-500/20 flex-shrink-0">
                    <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight truncate">Finalizar Serviço</h3>
                    <p className="text-[10px] sm:text-xs text-zinc-500 font-bold uppercase tracking-widest truncate">Confirmação de entrega premium</p>
                  </div>
                </div>
                <button 
                  onClick={() => setCompletingId(null)} 
                  className="w-10 h-10 flex items-center justify-center hover:bg-white/5 rounded-xl transition-all group flex-shrink-0"
                >
                  <X className="w-5 h-5 text-zinc-500 group-hover:text-white" />
                </button>
              </div>

              <div className="space-y-8">
                {appointments.find(a => a.id === completingId)?.notes && (
                  <div className="p-6 bg-brand-blue/5 border border-brand-blue/10 rounded-2xl relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-full bg-brand-blue" />
                    <p className="text-[10px] font-black text-brand-blue uppercase mb-2 tracking-[0.2em]">Observações do Job</p>
                    <p className="text-sm text-zinc-400 italic font-medium leading-relaxed">
                      "{appointments.find(a => a.id === completingId)?.notes}"
                    </p>
                  </div>
                )}

                <div className="space-y-4">
                  <p className="text-xs text-zinc-500 font-bold uppercase tracking-widest flex items-center gap-2">
                    <Car className="w-4 h-4" />
                    Registro Fotográfico
                  </p>
                  
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.2em] ml-1">Estado Inicial</label>
                      <div className="relative group aspect-video bg-zinc-950/50 rounded-2xl border-2 border-dashed border-white/5 flex flex-col items-center justify-center overflow-hidden hover:border-brand-blue/50 transition-all duration-500">
                        {photoBefore ? (
                          <>
                            <img src={photoBefore} alt="Antes" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <button 
                                onClick={() => setPhotoBefore('')}
                                className="w-10 h-10 bg-red-500 text-white rounded-xl shadow-xl flex items-center justify-center hover:scale-110 transition-transform"
                              >
                                <Trash2 className="w-5 h-5" />
                              </button>
                            </div>
                          </>
                        ) : isUploadingPhoto ? (
                          <div className="flex flex-col items-center gap-2">
                            <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-brand-blue animate-spin">
                              <Clock className="w-5 h-5" />
                            </div>
                            <span className="text-[10px] text-zinc-600 font-black uppercase tracking-widest">Enviando...</span>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-2">
                            <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-zinc-600 group-hover:text-brand-blue group-hover:bg-brand-blue/10 transition-all">
                              <Plus className="w-5 h-5" />
                            </div>
                            <span className="text-[10px] text-zinc-600 font-black uppercase tracking-widest">Foto Antes</span>
                            <input 
                              type="file" 
                              accept="image/*"
                              capture="environment"
                              onChange={(e) => handleFileChange(e, 'before')}
                              className="absolute inset-0 opacity-0 cursor-pointer"
                            />
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.2em] ml-1">Resultado Final</label>
                      <div className="relative group aspect-video bg-zinc-950/50 rounded-2xl border-2 border-dashed border-white/5 flex flex-col items-center justify-center overflow-hidden hover:border-brand-blue/50 transition-all duration-500">
                        {photoAfter ? (
                          <>
                            <img src={photoAfter} alt="Depois" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <button 
                                onClick={() => setPhotoAfter('')}
                                className="w-10 h-10 bg-red-500 text-white rounded-xl shadow-xl flex items-center justify-center hover:scale-110 transition-transform"
                              >
                                <Trash2 className="w-5 h-5" />
                              </button>
                            </div>
                          </>
                        ) : isUploadingPhoto ? (
                          <div className="flex flex-col items-center gap-2">
                            <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-brand-blue animate-spin">
                              <Clock className="w-5 h-5" />
                            </div>
                            <span className="text-[10px] text-zinc-600 font-black uppercase tracking-widest">Enviando...</span>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-2">
                            <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-zinc-600 group-hover:text-brand-blue group-hover:bg-brand-blue/10 transition-all">
                              <Plus className="w-5 h-5" />
                            </div>
                            <span className="text-[10px] text-zinc-600 font-black uppercase tracking-widest">Foto Depois</span>
                            <input 
                              type="file" 
                              accept="image/*"
                              capture="environment"
                              onChange={(e) => handleFileChange(e, 'after')}
                              className="absolute inset-0 opacity-0 cursor-pointer"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex gap-4 pt-6">
                  <button 
                    onClick={() => setCompletingId(null)}
                    className="flex-1 py-4 bg-zinc-900 text-zinc-400 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] hover:bg-zinc-800 hover:text-white transition-all active:scale-95"
                  >
                    Voltar
                  </button>
                  <button 
                    onClick={handleComplete}
                    className="flex-1 py-4 bg-emerald-500 text-white rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] shadow-xl shadow-emerald-500/20 hover:bg-emerald-600 transition-all active:scale-95"
                  >
                    Confirmar Entrega
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {showNewCustomerModal && (
          <div className="fixed inset-0 z-[100] flex items-start sm:items-center justify-center p-4 md:p-8 pt-10 sm:pt-0 overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowNewCustomerModal(false)}
              className="absolute inset-0 bg-black/90 backdrop-blur-xl"
            />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="glass-card w-full max-w-2xl p-6 md:p-10 relative z-10 overflow-hidden max-h-[90vh] overflow-y-auto no-scrollbar"
            >
              <div className="flex items-center justify-between mb-8 sm:mb-10 gap-4">
                <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                  <div className="w-12 h-12 sm:w-14 sm:h-14 bg-brand-blue/10 rounded-2xl flex items-center justify-center border border-brand-blue/20 flex-shrink-0">
                    <UserPlus className="text-brand-blue w-6 h-6 sm:w-7 sm:h-7" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight truncate">Novo Cliente</h2>
                    <p className="text-zinc-500 text-[8px] sm:text-[10px] font-bold uppercase tracking-[0.2em] sm:tracking-[0.3em] truncate">Cadastro manual de cliente</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => handleImportContact('customer')}
                    className="flex items-center gap-2 px-4 py-2 bg-zinc-900/50 hover:bg-zinc-800 text-zinc-400 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all border border-white/5"
                    title="Importar dos contatos"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Importar Contato</span>
                  </button>
                  <button onClick={() => setShowNewCustomerModal(false)} className="w-10 h-10 bg-zinc-900/50 rounded-xl flex items-center justify-center border border-white/5 flex-shrink-0">
                    <X className="w-5 h-5 text-zinc-500" />
                  </button>
                </div>
              </div>

              <div className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Nome Completo</label>
                    <input 
                      type="text" 
                      value={newCustomer.displayName}
                      onChange={(e) => setNewCustomer(prev => ({ ...prev, displayName: e.target.value }))}
                      placeholder="Nome do cliente"
                      className="w-full bg-zinc-950/50 border border-white/5 rounded-2xl px-5 py-3 text-sm text-white focus:ring-2 focus:ring-brand-blue/50 outline-none transition-all placeholder:text-zinc-800"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Telefone / WhatsApp</label>
                    <IMaskInput
                      mask="(00) 00000-0000"
                      value={newCustomer.phone}
                      onAccept={(value: any) => setNewCustomer(prev => ({ ...prev, phone: value }))}
                      placeholder="(00) 00000-0000"
                      className="w-full bg-zinc-950/50 border border-white/5 rounded-2xl px-5 py-3 text-sm text-white focus:ring-2 focus:ring-brand-blue/50 outline-none transition-all placeholder:text-zinc-800"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">E-mail (Opcional)</label>
                  <input 
                    type="email" 
                    value={newCustomer.email}
                    onChange={(e) => setNewCustomer(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="exemplo@email.com"
                    className="w-full bg-zinc-950/50 border border-white/5 rounded-2xl px-5 py-3 text-sm text-white focus:ring-2 focus:ring-brand-blue/50 outline-none transition-all placeholder:text-zinc-800"
                  />
                  <p className="text-[9px] text-zinc-600 font-bold uppercase tracking-widest ml-1">
                    O cliente poderá usar este e-mail para acessar o aplicativo futuramente.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Modelo do Carro</label>
                    <input 
                      type="text" 
                      value={newCustomer.carModel}
                      onChange={(e) => setNewCustomer(prev => ({ ...prev, carModel: e.target.value }))}
                      placeholder="Ex: Toyota Corolla"
                      className="w-full bg-zinc-950/50 border border-white/5 rounded-2xl px-5 py-3 text-sm text-white focus:ring-2 focus:ring-brand-blue/50 outline-none transition-all placeholder:text-zinc-800"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Placa</label>
                    <input 
                      type="text" 
                      value={newCustomer.licensePlate}
                      onChange={(e) => setNewCustomer(prev => ({ ...prev, licensePlate: e.target.value.toUpperCase() }))}
                      placeholder="ABC-1234"
                      className="w-full bg-zinc-950/50 border border-white/5 rounded-2xl px-5 py-3 text-sm text-white focus:ring-2 focus:ring-brand-blue/50 outline-none transition-all placeholder:text-zinc-800"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Tipo de Veículo Padrão</label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { id: 'hatch', label: 'Hatch', icon: '🚗' },
                      { id: 'sedan', label: 'Sedan', icon: '🚘' },
                      { id: 'suv', label: 'SUV', icon: '🚙' },
                      { id: 'pickup', label: 'Pickup', icon: '🛻' },
                    ].map((v) => (
                      <button
                        key={v.id}
                        onClick={() => setNewCustomer(prev => ({ ...prev, preferredVehicleType: v.id as VehicleType }))}
                        className={`p-3 rounded-2xl border transition-all flex flex-col items-center gap-2 ${
                          newCustomer.preferredVehicleType === v.id 
                            ? 'bg-brand-blue/10 border-brand-blue text-brand-blue' 
                            : 'bg-zinc-950/50 border-white/5 text-zinc-600 hover:border-zinc-700'
                        }`}
                      >
                        <span className="text-2xl">{v.icon}</span>
                        <span className="text-[9px] font-black uppercase tracking-widest">{v.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-4 border-t border-white/5 flex flex-col sm:flex-row gap-3">
                  <button 
                    onClick={() => setShowNewCustomerModal(false)}
                    className="flex-1 px-6 py-4 bg-zinc-900/50 hover:bg-zinc-800 text-zinc-400 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all border border-white/5"
                  >
                    Cancelar
                  </button>
                  <button 
                    onClick={() => handleCreateCustomer(false)}
                    disabled={loading}
                    className="flex-1 px-8 py-4 bg-zinc-800 hover:bg-zinc-700 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all border border-white/5 disabled:opacity-50"
                  >
                    {loading ? 'Salvando...' : 'Cadastrar Cliente'}
                  </button>
                  <button 
                    onClick={() => handleCreateCustomer(true)}
                    disabled={loading}
                    className="flex-1 px-8 py-4 bg-brand-blue hover:bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-xl shadow-blue-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <Calendar className="w-3.5 h-3.5" />
                    {loading ? 'Salvando...' : 'Cadastrar e Agendar'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
        {showNewAppointmentModal && (
          <div className="fixed inset-0 z-[100] flex items-start sm:items-center justify-center p-4 md:p-8 pt-10 sm:pt-0 overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowNewAppointmentModal(false)}
              className="absolute inset-0 bg-black/90 backdrop-blur-xl"
            />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="glass-card w-full max-w-2xl p-6 md:p-10 relative z-10 overflow-hidden max-h-[90vh] overflow-y-auto no-scrollbar"
            >
              <div className="flex items-center justify-between mb-8 sm:mb-10 gap-4">
                <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                  <div className="w-12 h-12 sm:w-14 sm:h-14 bg-brand-blue/10 rounded-2xl flex items-center justify-center border border-brand-blue/20 flex-shrink-0">
                    {editingAppointmentId ? (
                      <Edit2 className="text-brand-blue w-6 h-6 sm:w-7 sm:h-7" />
                    ) : (
                      <UserPlus className="text-brand-blue w-6 h-6 sm:w-7 sm:h-7" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight truncate">
                      {editingAppointmentId ? 'Editar Agendamento' : 'Novo Agendamento'}
                    </h2>
                    <p className="text-zinc-500 text-[8px] sm:text-[10px] font-bold uppercase tracking-[0.2em] sm:tracking-[0.3em] truncate">
                      {editingAppointmentId ? 'Atualize as informações do serviço' : 'Cadastro manual de cliente'}
                    </p>
                  </div>
                </div>
                <button onClick={() => setShowNewAppointmentModal(false)} className="w-10 h-10 bg-zinc-900/50 rounded-xl flex items-center justify-center border border-white/5 flex-shrink-0">
                  <X className="w-5 h-5 text-zinc-500" />
                </button>
              </div>

              <div className="space-y-8">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Vincular Cliente Existente (Opcional)</label>
                  <select 
                    className="w-full bg-zinc-950/50 border border-white/5 rounded-2xl px-5 py-3 text-sm text-white focus:ring-2 focus:ring-brand-blue/50 outline-none transition-all"
                    onChange={(e) => {
                      const profile = profiles.find(p => p.id === e.target.value);
                      if (profile) {
                        setNewAppointment(prev => ({
                          ...prev,
                          customerName: profile.displayName,
                          customerPhone: profile.phone,
                          vehicleType: profile.preferredVehicleType || 'hatch'
                        }));
                      }
                    }}
                  >
                    <option value="">Selecione um cliente...</option>
                    {profiles.sort((a, b) => a.displayName.localeCompare(b.displayName)).map(p => (
                      <option key={p.id} value={p.id}>{p.displayName} ({p.phone})</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Nome do Cliente</label>
                      <button 
                        onClick={() => handleImportContact('appointment')}
                        className="text-[9px] font-black text-brand-blue hover:text-blue-400 uppercase tracking-widest flex items-center gap-1.5 transition-colors"
                      >
                        <Phone className="w-3 h-3" />
                        Importar Contato
                      </button>
                    </div>
                    <input 
                      type="text" 
                      value={newAppointment.customerName}
                      onChange={(e) => setNewAppointment(prev => ({ ...prev, customerName: e.target.value }))}
                      placeholder="Nome completo"
                      className="w-full bg-zinc-950/50 border border-white/5 rounded-2xl px-5 py-3 text-sm text-white focus:ring-2 focus:ring-brand-blue/50 outline-none transition-all placeholder:text-zinc-800"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Telefone / WhatsApp</label>
                    <IMaskInput
                      mask="(00) 00000-0000"
                      value={newAppointment.customerPhone}
                      onAccept={(value: any) => setNewAppointment(prev => ({ ...prev, customerPhone: value }))}
                      placeholder="(00) 00000-0000"
                      className="w-full bg-zinc-950/50 border border-white/5 rounded-2xl px-5 py-3 text-sm text-white focus:ring-2 focus:ring-brand-blue/50 outline-none transition-all placeholder:text-zinc-800"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Tipo de Veículo</label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { id: 'hatch', label: 'Hatch', icon: '🚗' },
                      { id: 'sedan', label: 'Sedan', icon: '🚘' },
                      { id: 'suv', label: 'SUV', icon: '🚙' },
                      { id: 'pickup', label: 'Pickup', icon: '🛻' },
                    ].map((v) => (
                      <button
                        key={v.id}
                        onClick={() => setNewAppointment(prev => ({ ...prev, vehicleType: v.id as VehicleType }))}
                        className={`p-3 rounded-2xl border transition-all flex flex-col items-center gap-2 ${
                          newAppointment.vehicleType === v.id 
                            ? 'bg-brand-blue/10 border-brand-blue text-brand-blue' 
                            : 'bg-zinc-950/50 border-white/5 text-zinc-600 hover:border-zinc-700'
                        }`}
                      >
                        <span className="text-2xl">{v.icon}</span>
                        <span className="text-[9px] font-black uppercase tracking-widest">{v.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Serviços</label>
                  <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto pr-2 no-scrollbar">
                    {services.map((s) => {
                      const isSelected = newAppointment.serviceIds.includes(s.id);
                      return (
                        <button
                          key={s.id}
                          onClick={() => {
                            setNewAppointment(prev => ({
                              ...prev,
                              serviceIds: isSelected 
                                ? prev.serviceIds.filter(id => id !== s.id)
                                : [...prev.serviceIds, s.id]
                            }));
                          }}
                          className={`p-4 rounded-xl border flex items-center justify-between transition-all ${
                            isSelected 
                              ? 'bg-brand-blue/10 border-brand-blue text-white' 
                              : 'bg-zinc-950/50 border-white/5 text-zinc-500 hover:border-zinc-700'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${
                              isSelected ? 'bg-brand-blue border-brand-blue' : 'border-zinc-700'
                            }`}>
                              {isSelected && <CheckCircle2 className="w-3 h-3 text-white" />}
                            </div>
                            <span className="text-xs font-bold">{s.name}</span>
                          </div>
                          <span className="text-xs font-black text-brand-blue">R$ {s.prices[newAppointment.vehicleType]?.toFixed(2)}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Data</label>
                    <input 
                      type="date" 
                      value={newAppointment.date}
                      onChange={(e) => setNewAppointment(prev => ({ ...prev, date: e.target.value }))}
                      className="w-full bg-zinc-950/50 border border-white/5 rounded-2xl px-5 py-3 text-sm text-white focus:ring-2 focus:ring-brand-blue/50 outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Horário</label>
                    <select 
                      value={newAppointment.time}
                      onChange={(e) => setNewAppointment(prev => ({ ...prev, time: e.target.value }))}
                      className="w-full bg-zinc-950/50 border border-white/5 rounded-2xl px-5 py-3 text-sm text-white focus:ring-2 focus:ring-brand-blue/50 outline-none transition-all"
                    >
                      {TIME_SLOTS.map(t => {
                        const isOccupied = appointments.filter(app => 
                          app.date === newAppointment.date && 
                          app.time === t && 
                          app.status !== 'cancelled' &&
                          app.id !== editingAppointmentId
                        ).length >= settings.capacity;

                        return (
                          <option 
                            key={t} 
                            value={t} 
                            disabled={isOccupied}
                            className={`bg-zinc-900 ${isOccupied ? 'text-zinc-700' : ''}`}
                          >
                            {t} {isOccupied ? '(Ocupado)' : ''}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Status</label>
                    <select 
                      value={newAppointment.status}
                      onChange={(e) => setNewAppointment(prev => ({ ...prev, status: e.target.value as any }))}
                      className={`w-full bg-zinc-950/50 border border-white/5 rounded-2xl px-5 py-3 text-sm font-black uppercase tracking-widest focus:ring-2 focus:ring-brand-blue/50 outline-none transition-all ${getStatusColor(newAppointment.status)}`}
                    >
                      <option value="pending">Pendente</option>
                      <option value="confirmed">Confirmado</option>
                      <option value="washing">Lavando</option>
                      <option value="completed">Concluído</option>
                      <option value="cancelled">Cancelado</option>
                    </select>
                  </div>
                </div>

                {appointments.some(app => app.date === newAppointment.date && app.time === newAppointment.time && app.status !== 'cancelled') && (
                  <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3"
                  >
                    <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
                    <p className="text-xs font-bold text-red-200/80">
                      Este horário já está ocupado. Por favor, selecione outro horário para evitar conflitos.
                    </p>
                  </motion.div>
                )}

                <div className="pt-4 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="text-center sm:text-left">
                    <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-0.5">Total Estimado</p>
                    <p className="text-2xl font-black text-brand-blue">
                      R$ {newAppointment.serviceIds.reduce((sum, id) => {
                        const s = services.find(srv => srv.id === id);
                        return sum + (s?.prices[newAppointment.vehicleType] || 0);
                      }, 0).toFixed(2)}
                    </p>
                  </div>
                  <div className="flex gap-2 w-full sm:w-auto">
                    <button 
                      onClick={() => setShowNewAppointmentModal(false)}
                      className="flex-1 sm:flex-none px-6 py-3 bg-zinc-900/50 hover:bg-zinc-800 text-zinc-400 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all border border-white/5"
                    >
                      Cancelar
                    </button>
                    <button 
                      onClick={handleCreateManualAppointment}
                      disabled={loading || appointments.some(app => app.id !== editingAppointmentId && app.date === newAppointment.date && app.time === newAppointment.time && app.status !== 'cancelled')}
                      className="flex-1 sm:flex-none px-8 py-3 bg-brand-blue hover:bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-xl shadow-blue-500/20 disabled:opacity-50"
                    >
                      {loading ? 'Salvando...' : (editingAppointmentId ? 'Salvar Alterações' : 'Criar Agendamento')}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
        {showNewExpenseModal && (
          <div className="fixed inset-0 z-[100] flex items-start sm:items-center justify-center p-4 md:p-8 bg-black/90 backdrop-blur-xl overflow-y-auto pt-10 sm:pt-0">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className="w-full max-w-2xl bg-zinc-900 border border-white/10 rounded-[2.5rem] shadow-2xl overflow-hidden"
            >
              <div className="p-10 space-y-8">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <h3 className="text-2xl sm:text-3xl font-black text-white tracking-tight truncate">Lançar Despesa</h3>
                    <p className="text-xs sm:text-sm text-zinc-500 font-medium truncate">Controle seus custos operacionais</p>
                  </div>
                  <button 
                    onClick={() => setShowNewExpenseModal(false)}
                    className="w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center bg-zinc-950 text-zinc-500 rounded-2xl hover:text-white transition-all border border-white/5 flex-shrink-0"
                  >
                    <X className="w-5 h-5 sm:w-6 sm:h-6" />
                  </button>
                </div>

                <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-4 no-scrollbar">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Descrição</label>
                    <input 
                      type="text" 
                      placeholder="Ex: Aluguel, Produtos de Limpeza, Energia..."
                      value={newExpense.description}
                      onChange={(e) => setNewExpense(prev => ({ ...prev, description: e.target.value }))}
                      className="w-full bg-zinc-950/50 border border-white/5 rounded-2xl px-6 py-4 text-sm text-white focus:ring-2 focus:ring-emerald-500/50 outline-none transition-all"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Valor (R$)</label>
                      <input 
                        type="number" 
                        step="0.01"
                        placeholder="0,00"
                        value={newExpense.amount}
                        onChange={(e) => setNewExpense(prev => ({ ...prev, amount: e.target.value }))}
                        className="w-full bg-zinc-950/50 border border-white/5 rounded-2xl px-6 py-4 text-sm text-white focus:ring-2 focus:ring-emerald-500/50 outline-none transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Categoria</label>
                      <select 
                        value={newExpense.category}
                        onChange={(e) => setNewExpense(prev => ({ ...prev, category: e.target.value as Expense['category'] }))}
                        className="w-full bg-zinc-950/50 border border-white/5 rounded-2xl px-6 py-4 text-sm text-white focus:ring-2 focus:ring-emerald-500/50 outline-none transition-all"
                      >
                        <option value="products" className="bg-zinc-900">Produtos</option>
                        <option value="rent" className="bg-zinc-900">Aluguel</option>
                        <option value="electricity" className="bg-zinc-900">Energia</option>
                        <option value="water" className="bg-zinc-900">Água</option>
                        <option value="other" className="bg-zinc-900">Outros</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Data</label>
                    <input 
                      type="date" 
                      value={newExpense.date}
                      onChange={(e) => setNewExpense(prev => ({ ...prev, date: e.target.value }))}
                      className="w-full bg-zinc-950/50 border border-white/5 rounded-2xl px-6 py-4 text-sm text-white focus:ring-2 focus:ring-emerald-500/50 outline-none transition-all"
                    />
                  </div>
                </div>

                <div className="pt-8 border-t border-white/5 flex gap-4">
                  <button 
                    onClick={() => setShowNewExpenseModal(false)}
                    className="flex-1 py-4 bg-zinc-950 hover:bg-zinc-800 text-zinc-500 text-xs font-black uppercase tracking-widest rounded-2xl transition-all border border-white/5"
                  >
                    Cancelar
                  </button>
                  <button 
                    onClick={handleSaveExpense}
                    disabled={loading}
                    className="flex-1 py-4 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-black uppercase tracking-widest rounded-2xl transition-all shadow-xl shadow-emerald-500/20 disabled:opacity-50"
                  >
                    {loading ? 'Salvando...' : 'Salvar Despesa'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {showNewServiceModal && (
          <div className="fixed inset-0 z-[100] flex items-start sm:items-center justify-center p-4 md:p-8 bg-black/90 backdrop-blur-xl overflow-y-auto pt-10 sm:pt-0">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className="w-full max-w-2xl bg-zinc-900 border border-white/10 rounded-[2.5rem] shadow-2xl overflow-hidden"
            >
              <div className="p-10 space-y-8">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <h3 className="text-2xl sm:text-3xl font-black text-white tracking-tight truncate">
                      {(newService as any).id ? 'Editar Serviço' : 'Novo Serviço'}
                    </h3>
                    <p className="text-xs sm:text-sm text-zinc-500 font-medium truncate">Configure os detalhes do seu serviço</p>
                  </div>
                  <button 
                    onClick={() => setShowNewServiceModal(false)}
                    className="w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center bg-zinc-950 text-zinc-500 rounded-2xl hover:text-white transition-all border border-white/5 flex-shrink-0"
                  >
                    <X className="w-5 h-5 sm:w-6 sm:h-6" />
                  </button>
                </div>

                <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-4 no-scrollbar">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2 md:col-span-2">
                      <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Nome do Serviço</label>
                      <input 
                        type="text" 
                        placeholder="Ex: Lavagem Completa"
                        value={newService.name}
                        onChange={(e) => setNewService(prev => ({ ...prev, name: e.target.value }))}
                        className="w-full bg-zinc-950/50 border border-white/5 rounded-2xl px-6 py-4 text-sm text-white focus:ring-2 focus:ring-brand-blue/50 outline-none transition-all"
                      />
                    </div>

                    <div className="space-y-2 md:col-span-2">
                      <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Descrição</label>
                      <textarea 
                        rows={2}
                        placeholder="O que está incluído neste serviço?"
                        value={newService.description}
                        onChange={(e) => setNewService(prev => ({ ...prev, description: e.target.value }))}
                        className="w-full bg-zinc-950/50 border border-white/5 rounded-2xl px-6 py-4 text-sm text-white focus:ring-2 focus:ring-brand-blue/50 outline-none transition-all resize-none"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Categoria</label>
                      <select 
                        value={newService.category}
                        onChange={(e) => setNewService(prev => ({ ...prev, category: e.target.value }))}
                        className="w-full bg-zinc-950/50 border border-white/5 rounded-2xl px-6 py-4 text-sm text-white focus:ring-2 focus:ring-brand-blue/50 outline-none transition-all appearance-none"
                      >
                        <option value="lavagem">Lavagem</option>
                        <option value="estetica">Estética</option>
                        <option value="protecao">Proteção</option>
                        <option value="outros">Outros</option>
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Duração (minutos)</label>
                      <input 
                        type="number" 
                        value={newService.duration}
                        onChange={(e) => setNewService(prev => ({ ...prev, duration: parseInt(e.target.value) }))}
                        className="w-full bg-zinc-950/50 border border-white/5 rounded-2xl px-6 py-4 text-sm text-white focus:ring-2 focus:ring-brand-blue/50 outline-none transition-all"
                      />
                    </div>

                    <div className="md:col-span-2 pt-4">
                      <h4 className="text-xs font-black text-white uppercase tracking-widest mb-4 flex items-center gap-2">
                        <div className="w-1 h-4 bg-brand-blue rounded-full" />
                        Preços por Tipo de Veículo
                      </h4>
                      <div className="grid grid-cols-2 gap-4">
                        {(['hatch', 'sedan', 'suv', 'pickup'] as VehicleType[]).map((type) => (
                          <div key={type} className="space-y-2">
                            <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest ml-1">
                              {type === 'hatch' ? 'Hatch' : type === 'sedan' ? 'Sedan' : type === 'suv' ? 'SUV' : 'Pickup'}
                            </label>
                            <div className="relative">
                              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600 font-bold text-xs">R$</span>
                              <input 
                                type="number" 
                                value={newService.prices[type]}
                                onChange={(e) => setNewService(prev => ({
                                  ...prev,
                                  prices: {
                                    ...prev.prices,
                                    [type]: parseFloat(e.target.value) || 0
                                  }
                                }))}
                                className="w-full bg-zinc-950/50 border border-white/5 rounded-2xl pl-10 pr-6 py-4 text-sm text-white focus:ring-2 focus:ring-brand-blue/50 outline-none transition-all"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-8 border-t border-white/5 flex gap-4">
                  <button 
                    onClick={() => setShowNewServiceModal(false)}
                    className="flex-1 py-4 bg-zinc-950 hover:bg-zinc-800 text-zinc-500 text-xs font-black uppercase tracking-widest rounded-2xl transition-all border border-white/5"
                  >
                    Cancelar
                  </button>
                  <button 
                    onClick={handleSaveService}
                    disabled={loading}
                    className="flex-1 py-4 bg-brand-blue hover:bg-blue-600 text-white text-xs font-black uppercase tracking-widest rounded-2xl transition-all shadow-xl shadow-blue-500/20 disabled:opacity-50"
                  >
                    {loading ? 'Salvando...' : (newService as any).id ? 'Salvar Alterações' : 'Criar Serviço'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {showNewPromotionModal && (
          <div className="fixed inset-0 z-[100] flex items-start sm:items-center justify-center p-4 md:p-8 bg-black/90 backdrop-blur-xl overflow-y-auto pt-10 sm:pt-0">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className="w-full max-w-2xl bg-zinc-900 border border-white/10 rounded-[2.5rem] shadow-2xl overflow-hidden mb-10 sm:mb-0"
            >
              <div className="p-10 space-y-8">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight truncate">
                      {editingPromotionId ? 'Editar Promoção' : 'Nova Promoção'}
                    </h3>
                    <p className="text-[8px] sm:text-[10px] font-black text-brand-blue uppercase tracking-[0.2em] mt-1 truncate">Configurações da Oferta</p>
                  </div>
                  <button 
                    onClick={() => {
                      setShowNewPromotionModal(false);
                      setEditingPromotionId(null);
                      setNewPromotion({
                        id: undefined,
                        title: '',
                        description: '',
                        active: true,
                        imageUrl: '',
                        discountType: 'percentage',
                        discountValue: 0,
                        fixedPrice: 0,
                        serviceIds: []
                      });
                    }}
                    className="w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center bg-zinc-950 text-zinc-500 rounded-2xl hover:text-white transition-all border border-white/5 flex-shrink-0"
                  >
                    <X className="w-5 h-5 sm:w-6 sm:h-6" />
                  </button>
                </div>

                <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-4 no-scrollbar">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Título da Oferta</label>
                    <input 
                      type="text" 
                      placeholder="Ex: Combo Brilho Extremo"
                      value={newPromotion.title}
                      onChange={(e) => setNewPromotion(prev => ({ ...prev, title: e.target.value }))}
                      className="w-full bg-zinc-950/50 border border-white/5 rounded-2xl px-6 py-4 text-sm text-white focus:ring-2 focus:ring-brand-blue/50 outline-none transition-all"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Descrição Detalhada</label>
                    <textarea 
                      rows={3}
                      placeholder="Descreva o que está incluído na promoção..."
                      value={newPromotion.description}
                      onChange={(e) => setNewPromotion(prev => ({ ...prev, description: e.target.value }))}
                      className="w-full bg-zinc-950/50 border border-white/5 rounded-2xl px-6 py-4 text-sm text-white focus:ring-2 focus:ring-brand-blue/50 outline-none transition-all resize-none"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Tipo de Desconto</label>
                      <select 
                        value={newPromotion.discountType}
                        onChange={(e) => setNewPromotion(prev => ({ ...prev, discountType: e.target.value as any }))}
                        className="w-full bg-zinc-950/50 border border-white/5 rounded-2xl px-6 py-4 text-sm text-white focus:ring-2 focus:ring-brand-blue/50 outline-none transition-all appearance-none"
                      >
                        <option value="percentage">Porcentagem (%)</option>
                        <option value="fixed">Valor Fixo (R$)</option>
                        <option value="bundle">Pacote / Preço Fixo</option>
                      </select>
                    </div>

                    {newPromotion.discountType === 'bundle' ? (
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Preço do Pacote (R$)</label>
                        <input 
                          type="number" 
                          placeholder="Ex: 150"
                          value={newPromotion.fixedPrice}
                          onChange={(e) => setNewPromotion(prev => ({ ...prev, fixedPrice: Number(e.target.value) }))}
                          className="w-full bg-zinc-950/50 border border-white/5 rounded-2xl px-6 py-4 text-sm text-white focus:ring-2 focus:ring-brand-blue/50 outline-none transition-all"
                        />
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">
                          {newPromotion.discountType === 'percentage' ? 'Valor da Porcentagem (%)' : 'Valor do Desconto (R$)'}
                        </label>
                        <input 
                          type="number" 
                          placeholder={newPromotion.discountType === 'percentage' ? 'Ex: 10' : 'Ex: 20'}
                          value={newPromotion.discountValue}
                          onChange={(e) => setNewPromotion(prev => ({ ...prev, discountValue: Number(e.target.value) }))}
                          className="w-full bg-zinc-950/50 border border-white/5 rounded-2xl px-6 py-4 text-sm text-white focus:ring-2 focus:ring-brand-blue/50 outline-none transition-all"
                        />
                      </div>
                    )}
                  </div>

                  {newPromotion.serviceIds.length === 0 && (
                    <div className="p-4 bg-zinc-950/50 border border-white/5 border-dashed rounded-2xl text-center">
                      <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">
                        Selecione ao menos um serviço para ver o impacto estimado
                      </p>
                    </div>
                  )}

                  {newPromotion.serviceIds.length > 0 && (
                    <div className="p-4 bg-brand-blue/5 border border-brand-blue/20 rounded-2xl space-y-3">
                      <div className="flex items-center gap-2">
                        <Percent className="w-3 h-3 text-brand-blue" />
                        <span className="text-[10px] font-black text-brand-blue uppercase tracking-widest">Impacto Estimado por Veículo</span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        {(['hatch', 'sedan', 'suv', 'pickup'] as const).map(v => {
                          const selectedServices = services.filter(s => newPromotion.serviceIds.includes(s.id));
                          const total = selectedServices.reduce((sum, s) => sum + s.prices[v], 0);
                          let percentage = 0;
                          let discountedPrice = total;
                          
                          if (newPromotion.discountType === 'percentage') {
                            percentage = newPromotion.discountValue;
                            discountedPrice = total * (1 - percentage / 100);
                          } else if (total > 0) {
                            if (newPromotion.discountType === 'fixed') {
                              percentage = (newPromotion.discountValue / total) * 100;
                              discountedPrice = total - newPromotion.discountValue;
                            } else if (newPromotion.discountType === 'bundle' && newPromotion.fixedPrice) {
                              percentage = (1 - (newPromotion.fixedPrice / total)) * 100;
                              discountedPrice = newPromotion.fixedPrice;
                            }
                          }

                          return (
                            <div key={v} className="space-y-1 bg-zinc-950/30 p-2 rounded-xl border border-white/5">
                              <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">{v}</p>
                              <div className="flex flex-col">
                                <span className="text-[8px] text-zinc-600 line-through">R$ {total.toFixed(0)}</span>
                                <span className="text-[10px] font-black text-white">R$ {discountedPrice.toFixed(0)}</span>
                              </div>
                              <p className={`text-[10px] font-black ${percentage > 0 ? 'text-emerald-500' : 'text-zinc-400'}`}>
                                {percentage > 0 ? `${percentage.toFixed(1)}% OFF` : '--'}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                      <p className="text-[9px] text-zinc-500 italic">Calculado com base no valor total dos serviços selecionados.</p>
                    </div>
                  )}

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Serviços Aplicáveis</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto p-2 bg-zinc-950/30 rounded-2xl border border-white/5">
                      {services.length === 0 && (
                        <p className="text-[10px] text-zinc-500 p-4 text-center italic">Nenhum serviço cadastrado.</p>
                      )}
                      {services.map(service => (
                        <label key={service.id} className="flex items-center gap-3 p-3 bg-zinc-900/50 border border-white/5 rounded-xl cursor-pointer hover:bg-zinc-800 transition-all">
                          <input 
                            type="checkbox"
                            checked={newPromotion.serviceIds.includes(service.id)}
                            onChange={(e) => {
                              const ids = e.target.checked 
                                ? [...newPromotion.serviceIds, service.id]
                                : newPromotion.serviceIds.filter(id => id !== service.id);
                              setNewPromotion(prev => ({ ...prev, serviceIds: ids }));
                            }}
                            className="w-4 h-4 rounded border-white/10 bg-zinc-900 text-brand-blue focus:ring-brand-blue"
                          />
                          <span className="text-xs font-bold text-zinc-300">{service.name}</span>
                        </label>
                      ))}
                    </div>
                    <p className="text-[10px] text-zinc-500 italic ml-1">Selecione quais serviços esta promoção altera ou inclui.</p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Imagem da Promoção</label>
                    <div className="flex flex-col sm:flex-row gap-6 items-start">
                      <div className="w-full sm:w-40 aspect-video bg-zinc-950 rounded-2xl border border-white/5 flex items-center justify-center overflow-hidden shadow-xl">
                        {newPromotion.imageUrl ? (
                          <img 
                            src={newPromotion.imageUrl} 
                            alt="Preview" 
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <ImageIcon className="w-8 h-8 text-zinc-800" />
                        )}
                      </div>
                      <div className="flex-1 w-full space-y-4">
                        <div className="relative group">
                          <input 
                            type="text" 
                            placeholder="URL da imagem (opcional)"
                            value={newPromotion.imageUrl}
                            onChange={(e) => setNewPromotion(prev => ({ ...prev, imageUrl: e.target.value }))}
                            className="w-full bg-zinc-950/50 border border-white/5 rounded-2xl px-6 py-4 text-sm text-white focus:ring-2 focus:ring-brand-blue/50 outline-none transition-all"
                          />
                        </div>
                        
                        <div className="flex items-center gap-4">
                          <label className="flex-1 cursor-pointer group">
                            <div className="flex items-center justify-center gap-3 py-4 px-6 bg-zinc-950/50 border border-white/10 border-dashed rounded-2xl group-hover:border-brand-blue/50 group-hover:bg-brand-blue/5 transition-all">
                              <Upload className="w-4 h-4 text-zinc-500 group-hover:text-brand-blue" />
                              <span className="text-xs font-black text-zinc-500 group-hover:text-white uppercase tracking-widest">Upload da Imagem</span>
                            </div>
                            <input 
                              type="file" 
                              accept="image/*" 
                              capture="environment"
                              onChange={handlePromotionImageUpload} 
                              className="hidden" 
                            />
                          </label>
                          
                          {newPromotion.imageUrl && (
                            <button 
                              type="button"
                              onClick={() => setNewPromotion(prev => ({ ...prev, imageUrl: '' }))}
                              className="p-4 bg-red-500/10 text-red-500 rounded-2xl border border-red-500/20 hover:bg-red-500 hover:text-white transition-all"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-4 bg-zinc-950/50 border border-white/5 rounded-2xl">
                    <input 
                      type="checkbox" 
                      id="promo-active"
                      checked={newPromotion.active}
                      onChange={(e) => setNewPromotion(prev => ({ ...prev, active: e.target.checked }))}
                      className="w-5 h-5 rounded border-white/10 bg-zinc-900 text-brand-blue focus:ring-brand-blue"
                    />
                    <label htmlFor="promo-active" className="text-sm font-bold text-white cursor-pointer">Ativar promoção imediatamente</label>
                  </div>
                </div>

                <div className="pt-8 border-t border-white/5 flex gap-4">
                  <button 
                    onClick={() => {
                      setShowNewPromotionModal(false);
                      setEditingPromotionId(null);
                      setNewPromotion({
                        id: undefined,
                        title: '',
                        description: '',
                        active: true,
                        imageUrl: '',
                        discountType: 'percentage',
                        discountValue: 0,
                        fixedPrice: 0,
                        serviceIds: []
                      });
                    }}
                    className="flex-1 py-4 bg-zinc-950 hover:bg-zinc-800 text-zinc-500 text-xs font-black uppercase tracking-widest rounded-2xl transition-all border border-white/5"
                  >
                    Cancelar
                  </button>
                  <button 
                    onClick={handleSavePromotion}
                    disabled={loading}
                    className="flex-1 py-4 bg-brand-blue hover:bg-blue-600 text-white text-xs font-black uppercase tracking-widest rounded-2xl transition-all shadow-xl shadow-blue-500/20 disabled:opacity-50"
                  >
                    {loading ? 'Salvando...' : editingPromotionId ? 'Salvar Alterações' : 'Criar Promoção'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {deleteConfirmation && (
          <div className="fixed inset-0 z-[110] overflow-y-auto">
            <div className="flex min-h-full items-start sm:items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setDeleteConfirmation(null)}
                className="fixed inset-0 bg-black/90 backdrop-blur-xl cursor-pointer"
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-md bg-zinc-900 border border-white/10 rounded-[2.5rem] shadow-2xl overflow-hidden relative z-10 my-8 sm:my-auto"
              >
              <div className="p-10 space-y-8 text-center">
                <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center text-red-500 mx-auto border border-red-500/20">
                  <Trash2 className="w-10 h-10" />
                </div>
                
                <div className="space-y-2">
                  <h3 className="text-2xl font-black text-white tracking-tight">Confirmar Exclusão</h3>
                  <p className="text-sm text-zinc-500 font-medium leading-relaxed">
                    {deleteConfirmation.title}
                  </p>
                </div>

                <div className="flex gap-4">
                  <button 
                    onClick={() => setDeleteConfirmation(null)}
                    className="flex-1 py-4 bg-zinc-950 hover:bg-zinc-800 text-zinc-500 text-xs font-black uppercase tracking-widest rounded-2xl transition-all border border-white/5"
                  >
                    Cancelar
                  </button>
                  <button 
                    onClick={confirmDelete}
                    disabled={loading}
                    className="flex-1 py-4 bg-red-500 hover:bg-red-600 text-white text-xs font-black uppercase tracking-widest rounded-2xl transition-all shadow-xl shadow-red-500/20 disabled:opacity-50"
                  >
                    {loading ? 'Excluindo...' : 'Confirmar'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      )}
      </AnimatePresence>
    </div>
  );
}

function MobileMenuButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-4 px-6 py-5 rounded-2xl transition-all relative overflow-hidden ${
        active 
          ? 'bg-brand-blue text-white shadow-xl shadow-blue-500/20' 
          : 'bg-white/5 text-zinc-400 hover:text-white'
      }`}
    >
      <div className={`${active ? 'text-white' : 'text-brand-blue'} w-5 h-5 flex items-center justify-center`}>
        {icon}
      </div>
      <span className="font-black text-[11px] uppercase tracking-[0.2em]">{label}</span>
    </button>
  );
}

function MobileTab({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-2.5 rounded-t-xl transition-all duration-300 relative flex-shrink-0 ${
        active 
          ? 'bg-brand-blue text-white shadow-[0_-4px_10px_rgba(37,99,235,0.2)]' 
          : 'bg-zinc-900/50 text-zinc-500 border-x border-t border-white/5'
      }`}
    >
      <div className={active ? 'text-white' : 'text-zinc-600'}>{icon}</div>
      <span className="font-black text-[8px] uppercase tracking-widest whitespace-nowrap">{label}</span>
      {active && (
        <motion.div 
          layoutId="active-mobile-tab"
          className="absolute -bottom-1 left-0 right-0 h-1 bg-brand-blue"
        />
      )}
    </button>
  );
}

function NavButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-4 px-6 py-4.5 rounded-2xl transition-all duration-500 relative group overflow-hidden ${
        active 
          ? 'text-white shadow-2xl shadow-blue-500/20' 
          : 'text-zinc-500 hover:text-white'
      }`}
    >
      {active && (
        <motion.div 
          layoutId="active-nav"
          className="absolute inset-0 bg-gradient-to-r from-brand-blue to-blue-600 rounded-2xl -z-10"
          transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
        />
      )}
      
      {!active && (
        <div className="absolute inset-0 bg-white/0 group-hover:bg-white/5 transition-colors duration-300 -z-10" />
      )}

      <div className={`transition-all duration-500 ${active ? 'scale-110 drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]' : 'group-hover:scale-110 group-hover:text-zinc-300'}`}>
        {React.cloneElement(icon as React.ReactElement<any>, { className: 'w-5 h-5' })}
      </div>
      
      <span className={`font-black text-[11px] uppercase tracking-[0.2em] transition-all duration-500 ${active ? 'translate-x-1' : 'opacity-60 group-hover:opacity-100 group-hover:translate-x-1'}`}>
        {label}
      </span>

      {active && (
        <motion.div 
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          className="ml-auto"
        >
          <div className="w-1.5 h-1.5 bg-white rounded-full shadow-[0_0_8px_#fff]" />
        </motion.div>
      )}
    </button>
  );
}

function StatCard({ label, value, icon, color }: { label: string; value: string | number; icon: React.ReactNode; color: string }) {
  return (
    <motion.div 
      whileHover={{ y: -5, scale: 1.02 }}
      className="glass-card p-6 lg:p-8 border-white/5 hover:border-white/10 transition-all group overflow-hidden relative"
    >
      {/* Decorative background element */}
      <div className={`absolute -top-12 -right-12 w-32 h-32 ${color.replace('text-', 'bg-')} opacity-[0.03] rounded-full blur-3xl transition-transform group-hover:scale-150 duration-700`} />
      
      <div className="flex items-center justify-between mb-6 lg:mb-8 relative z-10">
        <div className="flex flex-col gap-1">
          <span className="text-zinc-500 text-[9px] lg:text-[10px] font-black uppercase tracking-[0.2em] lg:tracking-[0.3em] whitespace-nowrap">{label}</span>
          <div className="h-0.5 w-8 bg-brand-blue/30 rounded-full" />
        </div>
        <div className={`${color} bg-current/10 p-3 lg:p-4 rounded-2xl shadow-inner border border-current/5 transition-transform group-hover:rotate-6 duration-500`}>
          {React.cloneElement(icon as React.ReactElement<any>, { className: 'w-5 h-5 lg:w-6 lg:h-6' })}
        </div>
      </div>
      
      <div className="relative z-10">
        <div className="text-2xl lg:text-3xl xl:text-4xl font-black text-white tracking-tight mb-1 truncate" title={String(value)}>{value}</div>
        <div className="flex items-center gap-2 text-[9px] lg:text-[10px] text-zinc-500 font-bold uppercase tracking-widest">
          <TrendingUp className="w-3 h-3 text-emerald-500" />
          <span className="whitespace-nowrap">+12% este mês</span>
        </div>
      </div>
    </motion.div>
  );
}
