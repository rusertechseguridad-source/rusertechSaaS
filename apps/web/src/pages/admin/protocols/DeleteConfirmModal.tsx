import React from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, X } from 'lucide-react';
import type { OperationalProtocol } from './types';

interface DeleteConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  protocol: OperationalProtocol | null;
  isDeleting: boolean;
}

export const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  protocol,
  isDeleting
}) => {
  const { t } = useTranslation();

  if (!isOpen || !protocol) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-[#1A2346] border border-[#2D3B6A] rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex justify-between items-center p-5 border-b border-[#2D3B6A]">
          <div className="flex items-center gap-3 text-red-400">
            <AlertTriangle className="w-5 h-5" />
            <h2 className="text-lg font-semibold tracking-wide">{t('deleteModal.title')}</h2>
          </div>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
            disabled={isDeleting}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 text-gray-300">
          <p>
            {t('deleteModal.message').replace('{{name}}', protocol.name)}
          </p>
        </div>

        <div className="p-5 border-t border-[#2D3B6A] flex justify-end gap-3 bg-[#151B36]">
          <button
            onClick={onClose}
            disabled={isDeleting}
            className="px-4 py-2 bg-[#2D3B6A] hover:bg-[#3A4C8A] text-white rounded-lg transition-colors font-medium text-sm disabled:opacity-50"
          >
            {t('deleteModal.cancel')}
          </button>
          <button
            onClick={onConfirm}
            disabled={isDeleting}
            className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 rounded-lg transition-colors font-medium text-sm flex items-center gap-2 disabled:opacity-50"
          >
            {isDeleting ? (
              <>
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                Eliminando...
              </>
            ) : (
              t('deleteModal.confirm')
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
