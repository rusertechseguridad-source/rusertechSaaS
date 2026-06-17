import React, { useState } from 'react';
import { X, Building2, Phone, Mail, MapPin, Truck, FileText, CheckCircle, Download } from 'lucide-react';
import { exportToCsv } from '../../utils/export';

interface CarrierModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  carrierToEdit?: any | null;
}

export const CarrierModal: React.FC<CarrierModalProps> = ({ isOpen, onClose, onSaved, carrierToEdit }) => {
  const [name, setName] = useState('');
  const [taxId, setTaxId] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [address, setAddress] = useState('');
  const [googleMapsLink, setGoogleMapsLink] = useState('');
  const [operatingBases, setOperatingBases] = useState('');
  const [fleetSize, setFleetSize] = useState('');
  const [insuranceInfo, setInsuranceInfo] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    if (isOpen) {
      if (carrierToEdit) {
        setName(carrierToEdit.name || '');
        setTaxId(carrierToEdit.tax_id || '');
        setContactName(carrierToEdit.contact_name || '');
        setContactPhone(carrierToEdit.contact_phone || '');
        setContactEmail(carrierToEdit.contact_email || '');
        setAddress(carrierToEdit.address || '');
        setGoogleMapsLink(carrierToEdit.google_maps_link || '');
        setOperatingBases(carrierToEdit.operating_bases || '');
        setFleetSize(carrierToEdit.fleet_size ? String(carrierToEdit.fleet_size) : '');
        setInsuranceInfo(carrierToEdit.insurance_info || '');
        setNotes(carrierToEdit.notes || '');
      } else {
        setName('');
        setTaxId('');
        setContactName('');
        setContactPhone('');
        setContactEmail('');
        setAddress('');
        setGoogleMapsLink('');
        setOperatingBases('');
        setFleetSize('');
        setInsuranceInfo('');
        setNotes('');
      }
    }
  }, [isOpen, carrierToEdit]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const url = carrierToEdit 
        ? `http://localhost:3000/api/v1/carriers/${carrierToEdit.id}`
        : 'http://localhost:3000/api/v1/carriers';
      const method = carrierToEdit ? 'PUT' : 'POST';
      
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('rusertech_token')}`,
        },
        body: JSON.stringify({
          name,
          tax_id: taxId,
          contact_name: contactName,
          contact_phone: contactPhone,
          contact_email: contactEmail,
          address,
          google_maps_link: googleMapsLink,
          operating_bases: operatingBases,
          fleet_size: fleetSize ? Number(fleetSize) : undefined,
          insurance_info: insuranceInfo || undefined,
          notes: notes || undefined,
          status: carrierToEdit ? carrierToEdit.status : 'active'
        }),
      });

      if (!res.ok) throw new Error('Error al guardar transportista');

      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleExportDetail = () => {
    if (!carrierToEdit) return;
    const headers = ['Razón Social', 'RUT/CUIT', 'Contacto', 'Teléfono', 'Email', 'Dirección', 'Link Maps', 'Bases de Operación', 'Tamaño Flota', 'Seguro/ART', 'Notas'];
    const row = [name, taxId, contactName, contactPhone, contactEmail, address, googleMapsLink, operatingBases, fleetSize, insuranceInfo, notes];
    exportToCsv(`Transportista_${name}`, headers, [row]);
  };

  const inputClass = "w-full bg-bgStart border border-borderDefault rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-accentBlue focus:ring-1 focus:ring-accentBlue placeholder:text-textMuted transition-colors";
  const labelClass = "block text-xs font-semibold text-textSecondary uppercase tracking-wider mb-1.5";
  const sectionClass = "bg-bgStart/40 border border-borderDefault/50 rounded-xl p-5 space-y-4";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-bgStart/80 backdrop-blur-sm p-4">
      <div className="bg-bgSurface rounded-2xl shadow-[0_25px_60px_-15px_rgba(0,0,0,0.7)] border border-borderDefault w-full max-w-2xl overflow-hidden flex flex-col max-h-[92vh]">

        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-borderDefault bg-bgStart/60 shrink-0">
          <div>
            <h2 className="text-xl font-display font-bold text-white flex items-center gap-2">
              <Truck className="w-5 h-5 text-accentGreen" />
              {carrierToEdit ? 'Editar Transportista' : 'Nuevo Transportista'}
            </h2>
            <p className="text-xs text-textMuted mt-0.5">Complete los datos de la empresa transportista</p>
          </div>
          <div className="flex items-center gap-3">
            {carrierToEdit && (
              <button 
                type="button"
                onClick={handleExportDetail}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-bgSurfaceHigh hover:bg-bgSurface text-textPrimary text-xs font-medium rounded-md border border-borderDefault transition-colors"
              >
                <Download size={14} className="text-accentBlue" />
                Exportar
              </button>
            )}
            <button onClick={onClose} className="text-textMuted hover:text-white transition-colors p-1 rounded-lg hover:bg-bgSurfaceHigh">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-5">
            {error && (
              <div className="p-3 bg-statusDanger/10 border border-statusDanger/30 text-statusDanger rounded-lg text-sm flex items-center gap-2">
                <span className="shrink-0">⚠</span> {error}
              </div>
            )}

            {/* Sección 1: Datos Empresa */}
            <div className={sectionClass}>
              <h3 className="text-xs font-bold text-accentGreen uppercase tracking-widest flex items-center gap-2 pb-2 border-b border-borderDefault/50">
                <Building2 className="w-3.5 h-3.5" /> Datos de la Empresa
              </h3>
              <div>
                <label className={labelClass}>Razón Social *</label>
                <input type="text" required value={name} onChange={e => setName(e.target.value)} className={inputClass} placeholder="Ej: Transportes del Norte S.A." />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>CUIT / RUT</label>
                  <input type="text" value={taxId} onChange={e => setTaxId(e.target.value)} className={inputClass} placeholder="Ej: 30-12345678-9" />
                </div>
                <div>
                  <label className={labelClass}>Tamaño de Flota (vehículos)</label>
                  <input type="number" value={fleetSize} onChange={e => setFleetSize(e.target.value)} className={inputClass} placeholder="Ej: 15" min={0} />
                </div>
              </div>
            </div>

            {/* Sección 2: Contacto */}
            <div className={sectionClass}>
              <h3 className="text-xs font-bold text-accentBlue uppercase tracking-widest flex items-center gap-2 pb-2 border-b border-borderDefault/50">
                <Phone className="w-3.5 h-3.5" /> Contacto Principal
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Nombre del Contacto</label>
                  <input type="text" value={contactName} onChange={e => setContactName(e.target.value)} className={inputClass} placeholder="Ej: Carlos García" />
                </div>
                <div>
                  <label className={labelClass}>Teléfono</label>
                  <input type="text" value={contactPhone} onChange={e => setContactPhone(e.target.value)} className={inputClass} placeholder="+54 11 1234-5678" />
                </div>
              </div>
              <div>
                <label className={labelClass}><Mail className="w-3 h-3 inline mr-1" /> Email de Contacto</label>
                <input type="email" value={contactEmail} onChange={e => setContactEmail(e.target.value)} className={inputClass} placeholder="contacto@transportista.com" />
              </div>
            </div>

            {/* Sección 3: Ubicación */}
            <div className={sectionClass}>
              <h3 className="text-xs font-bold text-accentMint uppercase tracking-widest flex items-center gap-2 pb-2 border-b border-borderDefault/50">
                <MapPin className="w-3.5 h-3.5" /> Ubicación y Bases
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Dirección Física</label>
                  <input type="text" value={address} onChange={e => setAddress(e.target.value)} className={inputClass} placeholder="Ej: Av. Libertador 1234, CABA" />
                </div>
                <div>
                  <label className={labelClass}>Link Google Maps</label>
                  <input type="url" value={googleMapsLink} onChange={e => setGoogleMapsLink(e.target.value)} className={inputClass} placeholder="https://maps.google.com/..." />
                </div>
              </div>
              <div>
                <label className={labelClass}>Información de Bases Operativas</label>
                <textarea
                  value={operatingBases}
                  onChange={e => setOperatingBases(e.target.value)}
                  rows={2}
                  className={`${inputClass} resize-none`}
                  placeholder="Ej: Base principal en Pacheco, Base secundaria en Córdoba..."
                />
              </div>
            </div>

            {/* Sección 4: Datos Adicionales */}
            <div className={sectionClass}>
              <h3 className="text-xs font-bold text-statusWarning uppercase tracking-widest flex items-center gap-2 pb-2 border-b border-borderDefault/50">
                <FileText className="w-3.5 h-3.5" /> Datos Adicionales
              </h3>
              <div>
                <label className={labelClass}>Información de Seguros</label>
                <input type="text" value={insuranceInfo} onChange={e => setInsuranceInfo(e.target.value)} className={inputClass} placeholder="Ej: Póliza XYZ - Vto. 12/2026 - Aseguradora Mapfre" />
              </div>
              <div>
                <label className={labelClass}>Notas Internas</label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  rows={2}
                  className={`${inputClass} resize-none`}
                  placeholder="Observaciones internas, historial, condiciones especiales..."
                />
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 px-6 py-4 border-t border-borderDefault bg-bgStart/40 shrink-0">
            <button type="button" onClick={onClose} className="px-5 py-2 text-textMuted hover:text-white transition-colors rounded-lg hover:bg-bgSurfaceHigh">
              Cancelar
            </button>
            <button type="submit" disabled={loading} className="px-6 py-2 bg-accentGreen text-bgStart font-bold rounded-lg hover:bg-accentGreen/90 transition-colors disabled:opacity-50 shadow-[0_0_15px_rgba(124,255,60,0.2)] flex items-center gap-2">
              {loading ? 'Guardando...' : (<><CheckCircle className="w-4 h-4" /> Guardar Transportista</>)}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
