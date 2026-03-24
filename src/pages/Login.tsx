import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { dbService } from '../services/dbService';
import { useLogo } from '../hooks/useLogo';
import { AppSettings } from '../types';
import { LogIn, Mail, Lock, User as UserIcon, ArrowRight, ShieldCheck, Sparkles, Eye, EyeOff, Key } from 'lucide-react';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'motion/react';
import Background from '../components/Background';

const DEFAULT_LOGO = 'https://images.unsplash.com/photo-1520340356584-f9917d1eea6f?q=80&w=200&auto=format&fit=crop';

export default function Login() {
  const cachedLogo = useLogo();
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState('');
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [logoLoaded, setLogoLoaded] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [sendingReset, setSendingReset] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const data = await dbService.getSettings();
      setSettings(data);
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
            },
          },
        });
        if (error) throw error;
        toast.success('Cadastro realizado! Se você desativou a confirmação no Supabase, já pode entrar.');
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) {
          if (error.message.includes('Email not confirmed')) {
            throw new Error('E-mail não confirmado. Como você desativou no Supabase, tente criar uma NOVA conta agora para testar.');
          }
          throw error;
        }
        toast.success('Bem-vindo de volta!');
      }
    } catch (error: any) {
      toast.error(error.message || 'Erro na autenticação');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail) {
      toast.error('Informe seu e-mail');
      return;
    }
    setSendingReset(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast.success('E-mail de recuperação enviado! Verifique sua caixa de entrada.');
      setShowForgotPassword(false);
    } catch (error: any) {
      toast.error(error.message || 'Erro ao enviar e-mail de recuperação');
    } finally {
      setSendingReset(false);
    }
  };


  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-dark-bg">
      <Background />
      
      {/* Background Image with Overlay */}
      <div 
        className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat scale-105 opacity-30 pointer-events-none"
        style={{ 
          backgroundImage: 'url("https://images.unsplash.com/photo-1520340356584-f9917d1eea6f?q=80&w=2000&auto=format&fit=crop")',
          filter: 'blur(4px) grayscale(0.2)'
        }}
      />
      
      {/* Decorative Glows */}
      <div className="absolute top-1/4 -left-20 w-80 h-80 bg-brand-blue/10 rounded-full blur-[120px] animate-pulse" />
      <div className="absolute bottom-1/4 -right-20 w-80 h-80 bg-brand-blue/10 rounded-full blur-[120px] animate-pulse delay-1000" />

      <motion.div 
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="glass-card w-full max-w-md p-10 relative z-10 border-white/10 shadow-2xl overflow-hidden"
      >
        {/* Top Accent Line */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-brand-blue/50 to-transparent" />
        
        <div className="flex flex-col items-center mb-12 relative">
          <motion.div 
            initial={{ scale: 0, rotate: -10 }}
            animate={{ scale: 1, rotate: 3 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
            className="w-32 h-32 bg-black rounded-3xl flex items-center justify-center mb-6 shadow-2xl shadow-blue-500/40 border border-white/10 overflow-hidden relative"
          >
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
          </motion.div>
          
          <div className="text-center space-y-1">
            <h1 className="text-4xl font-black text-white tracking-tighter">BOX CLASS</h1>
            <div className="flex items-center justify-center gap-3">
              <div className="h-[1px] w-6 bg-brand-blue/30" />
              <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.4em]">Estética Automotiva</p>
              <div className="h-[1px] w-6 bg-brand-blue/30" />
            </div>
          </div>

          <div className="mt-8 flex items-center gap-2 px-4 py-1.5 bg-zinc-900/50 rounded-full border border-white/5">
            <ShieldCheck className="w-3 h-3 text-brand-blue" />
            <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Acesso Seguro & Criptografado</span>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {showForgotPassword ? (
            <motion.form 
              key="forgot-password"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onSubmit={handleForgotPassword}
              className="space-y-6"
            >
              <div className="text-center mb-4">
                <h2 className="text-xl font-black text-white uppercase tracking-tight">Recuperar Senha</h2>
                <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest mt-1">Enviaremos um link para seu e-mail</p>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] ml-1">E-mail</label>
                <div className="relative group">
                  <Mail className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-600 group-focus-within:text-brand-blue transition-colors" />
                  <input
                    type="email"
                    required
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    className="w-full bg-zinc-950/50 border border-white/5 rounded-2xl pl-14 pr-6 py-5 text-sm text-white focus:ring-2 focus:ring-brand-blue/50 outline-none transition-all placeholder:text-zinc-800"
                    placeholder="seu@email.com"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={sendingReset}
                className="w-full group relative overflow-hidden bg-brand-blue hover:bg-blue-600 text-white font-black uppercase tracking-[0.2em] py-5 rounded-2xl shadow-2xl shadow-blue-500/20 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed mt-4 text-xs"
              >
                <div className="flex items-center justify-center gap-3 relative z-10">
                  {sendingReset ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Enviando...</span>
                    </>
                  ) : (
                    <>
                      <span>Enviar Link</span>
                      <Key className="w-4 h-4" />
                    </>
                  )}
                </div>
              </button>

              <button
                type="button"
                onClick={() => setShowForgotPassword(false)}
                className="w-full text-zinc-500 hover:text-white text-[10px] font-black uppercase tracking-[0.2em] transition-all"
              >
                Voltar para o Login
              </button>
            </motion.form>
          ) : (
            <motion.form 
              key={isSignUp ? 'signup' : 'login'}
            initial={{ opacity: 0, x: isSignUp ? 20 : -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: isSignUp ? -20 : 20 }}
            transition={{ duration: 0.3 }}
            onSubmit={handleAuth} 
            className="space-y-6"
          >
            {isSignUp && (
              <div className="space-y-2">
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] ml-1">Nome Completo</label>
                <div className="relative group">
                  <UserIcon className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-600 group-focus-within:text-brand-blue transition-colors" />
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full bg-zinc-950/50 border border-white/5 rounded-2xl pl-14 pr-6 py-5 text-sm text-white focus:ring-2 focus:ring-brand-blue/50 outline-none transition-all placeholder:text-zinc-800"
                    placeholder="Seu nome completo"
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] ml-1">E-mail</label>
              <div className="relative group">
                <Mail className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-600 group-focus-within:text-brand-blue transition-colors" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-zinc-950/50 border border-white/5 rounded-2xl pl-14 pr-6 py-5 text-sm text-white focus:ring-2 focus:ring-brand-blue/50 outline-none transition-all placeholder:text-zinc-800"
                  placeholder="seu@email.com"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">Senha de Acesso</label>
                {!isSignUp && (
                  <button 
                    type="button" 
                    onClick={() => setShowForgotPassword(true)}
                    className="text-[9px] font-black text-brand-blue/60 hover:text-brand-blue uppercase tracking-widest transition-colors"
                  >
                    Esqueceu?
                  </button>
                )}
              </div>
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
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
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
                    <span>Processando...</span>
                  </>
                ) : (
                  <>
                    {isSignUp ? 'Criar Conta Premium' : 'Acessar Painel'}
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </div>
            </button>
          </motion.form>
          )}
        </AnimatePresence>

        <div className="mt-10 text-center space-y-8">
          <button
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-zinc-500 hover:text-white text-[10px] font-black uppercase tracking-[0.2em] transition-all group"
          >
            {isSignUp ? (
              <>Já possui uma conta? <span className="text-brand-blue group-hover:underline underline-offset-4">Entrar agora</span></>
            ) : (
              <>Ainda não tem conta? <span className="text-brand-blue group-hover:underline underline-offset-4">Cadastre-se</span></>
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
