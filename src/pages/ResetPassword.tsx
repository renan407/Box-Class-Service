import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { LogIn, Lock, ArrowRight, ShieldCheck, Sparkles, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'motion/react';
import Background from '../components/Background';
import { useNavigate } from 'react-router-dom';

export default function ResetPassword() {
  const [loading, setLoading] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    
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
      setTimeout(() => navigate('/'), 2000);
    } catch (error: any) {
      toast.error(error.message || 'Erro ao redefinir senha');
    } finally {
      setLoading(false);
    }
  };

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
            <Sparkles className="w-10 h-10 text-brand-blue animate-pulse" />
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
