
import React, { useEffect, useState } from 'react';
import { cacheService } from '../../services/cacheService';
import { WifiOff, Wifi, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function ConnectionStatus() {
  const [isOffline, setIsOffline] = useState(cacheService.getIsOffline());

  useEffect(() => {
    return cacheService.subscribe((status) => {
      setIsOffline(status);
    });
  }, []);

  return (
    <AnimatePresence>
      {isOffline && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="bg-amber-500 text-black px-4 py-2 flex items-center justify-center gap-2 overflow-hidden sticky top-0 z-[100] text-sm font-medium shadow-lg"
        >
          <AlertTriangle size={16} className="shrink-0" />
          <span>
            <b>Modo de Visualização Offline:</b> Problemas na conexão com o banco de dados. Você ainda pode ver seus dados, mas agendamentos e alterações não serão salvos até a conexão voltar.
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
