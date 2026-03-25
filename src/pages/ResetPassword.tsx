import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { LogIn, Lock, ArrowRight, ShieldCheck, Sparkles, Eye, EyeOff, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'motion/react';
import Background from '../components/Background';
import { useNavigate } from 'react-router-dom';
import { useLogo } from '../hooks/useLogo';
import { dbService } from '../services/dbService';
import { AppSettings } from '../types';

const DEFAULT_LOGO = 'https://lh3.googleusercontent.com/d/1cKe9DW0MFwXLqTrRaV9bemKXVda1nFi8';

export default function ResetPassword() {
  const cachedLogo = useLogo();
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [logoLoaded, setLogoLoaded] = useState(false);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const checkSession = async () => {
      // Pequeno delay para o Supabase processar o hash da URL
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        setHasSession(true);
        // Load settings for logo
        try {
          const s = await dbService.getSettings();
          setSettings(s);
        } catch (e) {
          console.error('Error loading settings:', e);
        }
      } else {
        // Se não houver sessão, pode ser que o link expirou ou é inválido
        toast.error('Sessão de recuperação não encontrada ou expirada.');
      }
      setCheckingSession(false);
    };

    checkSession();
  }, []);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!hasSession) {
      toast.error('Você precisa estar autenticado via link de recuperação para mudar a senha.');
      return;
    }

    if (password !== confirmPassword) {
      toast.error('As senhas não coincidem');
      return;
    }

    if (password.length < 6) {
      toast.error('A senha deve ter pelo menos 6 caracteres');
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: password
      });

      if (error) throw error;

      toast.success('Senha redefinida com sucesso!');
      // Logout para forçar novo login com a nova senha
      await supabase.auth.signOut();
      setTimeout(() => navigate('/'), 2000);
    } catch (error: any) {
      toast.error(error.message || 'Erro ao redefinir senha');
    } finally {
      setLoading(false);
    }
  };

  if (checkingSession) {
    return (
      <div className="min-h-screen bg-dark-bg flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-brand-blue border-t-transparent rounded-full animate-spin"></div>
          <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest">Validando link de segurança...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-dark-bg">
      <Background />
      
      <div 
        className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat scale-105 opacity-30 pointer-events-none"
        style={{ 
          backgroundImage: 'url("https://images.unsplash.com/photo-1520340356584-f9917d1eea6f?q=80&w=2000&auto=format&fit=crop")',
          filter: 'blur(4px) grayscale(0.2)'
        }}
      />
      
      <div className="absolute top-1/4 -left-20 w-80 h-80 bg-brand-blue/10 rounded-full blur-[120px] animate-pulse" />
      <div className="absolute bottom-1/4 -right-20 w-80 h-80 bg-brand-blue/10 rounded-full blur-[120px] animate-pulse delay-1000" />

      <motion.div 
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="glass-card w-full max-w-md p-10 relative z-10 border-white/10 shadow-2xl overflow-hidden"
      >
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-brand-blue/50 to-transparent" />
        
        <div className="flex flex-col items-center mb-12 relative">
          <div className="w-24 h-24 bg-black rounded-3xl flex items-center justify-center mb-6 shadow-2xl shadow-blue-500/40 border border-white/10 overflow-hidden relative">
            <AnimatePresence mode="wait">
              {!logoLoaded && (
                <motion.div 
                  key="placeholder"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 flex items-center justify-center bg-zinc-900"
                >
                  <Sparkles className="w-10 h-10 text-brand-blue animate-pulse" />
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
          
          <div className="text-center space-y-1">
            <h1 className="text-3xl font-black text-white tracking-tighter uppercase">Nova Senha</h1>
            <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.4em]">Defina sua nova credencial</p>
          </div>

          <div className="mt-8 flex items-center gap-2 px-4 py-1.5 bg-zinc-900/50 rounded-full border border-white/5">
            <ShieldCheck className="w-3 h-3 text-brand-blue" />
            <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Segurança Box Class</span>
          </div>
        </div>

        {!hasSession ? (
          <div className="text-center space-y-6">
            <div className="bg-red-500/10 border border-red-500/20 p-6 rounded-2xl">
              <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-4" />
              <h3 className="text-white font-black uppercase text-sm mb-2">Link Inválido ou Expirado</h3>
              <p className="text-zinc-500 text-xs leading-relaxed">
                O link de recuperação que você utilizou não é mais válido. Por favor, solicite um novo link na tela de login.
              </p>
            </div>
            <button
              onClick={() => navigate('/')}
              className="w-full bg-zinc-900 hover:bg-zinc-800 text-white font-black uppercase tracking-[0.2em] py-5 rounded-2xl transition-all text-xs"
            >
              Voltar para o Login
            </button>
          </div>
        ) : (
          <form onSubmit={handleReset} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] ml-1">Nova Senha</label>
              <div className="relative group">
                <Lock className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-600 group-focus-within:text-brand-blue transition-colors" />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-zinc-950/50 border border-white/5 rounded-2xl pl-14 pr-14 py-5 text-sm text-white focus:ring-2 focus:ring-brand-blue/50 outline-none transition-all placeholder:text-zinc-800"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-5 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-brand-blue transition-colors p-1"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] ml-1">Confirmar Senha</label>
              <div className="relative group">
                <Lock className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-600 group-focus-within:text-brand-blue transition-colors" />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-zinc-950/50 border border-white/5 rounded-2xl pl-14 pr-6 py-5 text-sm text-white focus:ring-2 focus:ring-brand-blue/50 outline-none transition-all placeholder:text-zinc-800"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full group relative overflow-hidden bg-brand-blue hover:bg-blue-600 text-white font-black uppercase tracking-[0.2em] py-5 rounded-2xl shadow-2xl shadow-blue-500/20 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed mt-4 text-xs"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
              <div className="flex items-center justify-center gap-3 relative z-10">
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Atualizando...</span>
                  </>
                ) : (
                  <>
                    <span>Salvar Nova Senha</span>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </div>
            </button>
          </form>
        )}

        <div className="mt-10 text-center">
          <button
            onClick={() => navigate('/')}
            className="text-zinc-500 hover:text-white text-[10px] font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 mx-auto"
          >
            <LogIn className="w-3 h-3" />
            Voltar para o Login
          </button>
        </div>
      </motion.div>
    </div>
  );
}
