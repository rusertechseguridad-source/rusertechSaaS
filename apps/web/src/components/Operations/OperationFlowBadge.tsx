import React from 'react';
import { useTranslation } from 'react-i18next';
import { ShieldAlert, Map, Activity, Truck, Settings } from 'lucide-react';

interface OperationFlowBadgeProps {
  type: string | null | undefined;
}

export const OperationFlowBadge: React.FC<OperationFlowBadgeProps> = ({ type }) => {
  const { t } = useTranslation();
  
  const getBadgeConfig = (flowType: string | null | undefined) => {
    switch (flowType?.toLowerCase()) {
      case 'pronta_respuesta':
        return { 
          icon: ShieldAlert, 
          color: 'bg-red-500/20 text-red-400 border border-red-500/30',
          label: t('operations.flows.pronta_respuesta.label', 'Pronta Respuesta'),
          tooltip: t('operations.flows.pronta_respuesta.tooltip', 'Eventos de PÁNICO/SOS o solicitudes específicas del cliente.')
        };
      case 'geocerca_repartos':
        return { 
          icon: Map, 
          color: 'bg-orange-500/20 text-orange-400 border border-orange-500/30',
          label: t('operations.flows.geocerca_repartos.label', 'Geocerca Repartos'),
          tooltip: t('operations.flows.geocerca_repartos.tooltip', 'Repartos con geocerca configurada. Útil para última milla.')
        };
      case 'seguimiento_inteligente':
        return { 
          icon: Activity, 
          color: 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30',
          label: t('operations.flows.seguimiento_inteligente.label', 'Seguimiento Inteligente'),
          tooltip: t('operations.flows.seguimiento_inteligente.tooltip', 'Monitoreo adaptativo con RiskLevel reactivo. Operación estándar.')
        };
      case 'interplanta':
        return { 
          icon: Truck, 
          color: 'bg-purple-500/20 text-purple-400 border border-purple-500/30',
          label: t('operations.flows.interplanta.label', 'Interplanta'),
          tooltip: t('operations.flows.interplanta.tooltip', 'Viajes de planta a planta del cliente, generalmente larga distancia.')
        };
      case 'estandar':
      default:
        return { 
          icon: Settings, 
          color: 'bg-gray-500/20 text-gray-400 border border-gray-500/30',
          label: t('operations.flows.estandar.label', 'Estándar'),
          tooltip: t('operations.flows.estandar.tooltip', 'Operación sin categoría específica. Default.')
        };
    }
  };

  const config = getBadgeConfig(type);
  const Icon = config.icon;

  return (
    <div className={`group relative inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider cursor-help ${config.color}`}>
      <Icon className="w-3 h-3" />
      {config.label}
      
      {/* Tooltip */}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-[#0B1120] border border-[#2D3B6A] rounded-lg shadow-xl text-xs text-gray-300 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 text-center leading-relaxed">
        {config.tooltip}
        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[#2D3B6A]"></div>
      </div>
    </div>
  );
};

export const formatOperationOption = (option: any) => {
  return (
    <div className="flex items-center justify-between gap-3 w-full">
      <span className="truncate">{option.label}</span>
      {option.operation_flow_type && (
        <OperationFlowBadge type={option.operation_flow_type} />
      )}
    </div>
  );
};
