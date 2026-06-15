import React, { useState, useEffect } from 'react';
import { X, User, Phone, CreditCard, FileText, Car, Calendar, Upload, CheckCircle } from 'lucide-react';

interface DriverModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  driverToEdit?: any | null;
}

export const DriverModal: React.FC<DriverModalProps> = ({ isOpen, onClose, onSaved, driverToEdit }) => {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [documentId, setDocumentId] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [licenseExpiry, setLicenseExpiry] = useState('');
  const [documentImageUrl, setDocumentImageUrl] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [carrierId, setCarrierId] = useState('');
  const [carriers, setCarriers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchCarriers();
      if (driverToEdit) {
        const [first, ...rest] = (driverToEdit.full_name || '').split(' ');
        setFirstName(first || '');
        setLastName(rest.join(' ') || '');
        setDocumentId(driverToEdit.document || '');
        setLicenseNumber(driverToEdit.license_number || '');
        setLicenseExpiry(driverToEdit.license_expiry ? driverToEdit.license_expiry.split('T')[0] : '');
        setDocumentImageUrl(driverToEdit.document_image_url || '');
        setPhone(driverToEdit.phone || '');
        setEmail(driverToEdit.email || '');
        setAddress(driverToEdit.address || '');
        setNotes(driverToEdit.notes || '');
        setCarrierId(driverToEdit.carrier_id || '');
      } else {
        setFirstName(''); setLastName(''); setDocumentId('');
        setLicenseNumber(''); setLicenseExpiry(''); setDocumentImageUrl('');
        setPhone(''); setEmail(''); setAddress(''); setNotes(''); setCarrierId('');
      }
      setError(null);
    }
  }, [isOpen, driverToEdit]);

  const fetchCarriers = async () => {
    try {
      const res = await fetch('http://localhost:3000/api/v1/carriers', {
        headers: { Authorization: `Bearer ${localStorage.getItem('rusertech_token')}` }
      });
      if (res.ok) setCarriers(await res.json());
    } catch (e) { console.error(e); }
  };

  if (!isOpen) return null;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    setUploadingFile(true);
    try {
      const res = await fetch('http://localhost:3000/api/v1/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('rusertech_token')}` },
        body: formData
      });
      if (!res.ok) throw new Error('Error al subir imagen');
      const data = await res.json();
      setDocumentImageUrl(data.url);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploadingFile(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const url = driverToEdit 
        ? `http://localhost:3000/api/v1/drivers/${driverToEdit.id}`
        : 'http://localhost:3000/api/v1/drivers';
      const method = driverToEdit ? 'PUT' : 'POST';
      
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('rusertech_token')}`,
        },
        body: JSON.stringify({
          full_name: `${firstName} ${lastName}`.trim(),
          document: documentId,
          license_number: licenseNumber,
          license_expiry: licenseExpiry ? new Date(licenseExpiry).toISOString() : undefined,
          document_image_url: documentImageUrl || undefined,
          phone,
          email: email || undefined,
          address: address || undefined,
          notes: notes || undefined,
          carrier_id: carrierId || undefined,
          status: driverToEdit ? driverToEdit.status : 'active'
        }),
      });
      if (!res.ok) throw new Error('Error al guardar chofer');
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
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
              <User className="w-5 h-5 text-accentGreen" />
              {driverToEdit ? 'Editar Chofer' : 'Nuevo Chofer'}
            </h2>
            <p className="text-xs text-textMuted mt-0.5">Complete los datos del conductor</p>
          </div>
          <button onClick={onClose} className="text-textMuted hover:text-white transition-colors p-1 rounded-lg hover:bg-bgSurfaceHigh">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-5">
            {error && (
              <div className="p-3 bg-statusDanger/10 border border-statusDanger/30 text-statusDanger rounded-lg text-sm flex items-center gap-2">
                <span className="shrink-0">⚠</span> {error}
              </div>
            )}

            {/* Sección 1: Identidad */}
            <div className={sectionClass}>
              <h3 className="text-xs font-bold text-accentGreen uppercase tracking-widest flex items-center gap-2 pb-2 border-b border-borderDefault/50">
                <User className="w-3.5 h-3.5" /> Identidad del Chofer
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Nombre *</label>
                  <input type="text" required value={firstName} onChange={e => setFirstName(e.target.value)} className={inputClass} placeholder="Ej: Juan" />
                </div>
                <div>
                  <label className={labelClass}>Apellido *</label>
                  <input type="text" required value={lastName} onChange={e => setLastName(e.target.value)} className={inputClass} placeholder="Ej: Pérez" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>DNI / Documento</label>
                  <input type="text" value={documentId} onChange={e => setDocumentId(e.target.value)} className={inputClass} placeholder="Ej: 30.123.456" />
                </div>
                <div>
                  <label className={labelClass}>Dirección</label>
                  <input type="text" value={address} onChange={e => setAddress(e.target.value)} className={inputClass} placeholder="Ej: Av. Corrientes 1234" />
                </div>
              </div>
            </div>

            {/* Sección 2: Contacto */}
            <div className={sectionClass}>
              <h3 className="text-xs font-bold text-accentBlue uppercase tracking-widest flex items-center gap-2 pb-2 border-b border-borderDefault/50">
                <Phone className="w-3.5 h-3.5" /> Contacto
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Teléfono</label>
                  <input type="text" value={phone} onChange={e => setPhone(e.target.value)} className={inputClass} placeholder="+54 11 1234-5678" />
                </div>
                <div>
                  <label className={labelClass}>Email</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} className={inputClass} placeholder="chofer@email.com" />
                </div>
              </div>
            </div>

            {/* Sección 3: Licencia */}
            <div className={sectionClass}>
              <h3 className="text-xs font-bold text-accentMint uppercase tracking-widest flex items-center gap-2 pb-2 border-b border-borderDefault/50">
                <CreditCard className="w-3.5 h-3.5" /> Licencia de Conducir
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Número de Licencia</label>
                  <input type="text" value={licenseNumber} onChange={e => setLicenseNumber(e.target.value)} className={inputClass} placeholder="Ej: B-12345678" />
                </div>
                <div>
                  <label className={labelClass}>Vencimiento</label>
                  <input type="date" value={licenseExpiry} onChange={e => setLicenseExpiry(e.target.value)} className={inputClass} />
                </div>
              </div>
              <div>
                <label className={labelClass}>
                  <Upload className="w-3 h-3 inline mr-1" /> Foto Documento / Licencia
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="w-full bg-bgStart border border-borderDefault rounded-lg px-4 py-2 text-white focus:outline-none focus:border-accentBlue file:mr-4 file:py-1 file:px-3 file:rounded file:border-0 file:bg-accentBlue/20 file:text-accentBlue file:font-medium text-sm"
                />
                {uploadingFile && <p className="text-xs text-textMuted mt-1 animate-pulse">Subiendo imagen...</p>}
                {documentImageUrl && (
                  <div className="mt-2 flex items-center gap-3">
                    <div className="h-16 w-24 rounded-lg border border-borderDefault overflow-hidden shrink-0">
                      <img src={documentImageUrl} alt="Preview" className="w-full h-full object-cover" />
                    </div>
                    <span className="text-xs text-accentGreen flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Imagen cargada correctamente</span>
                  </div>
                )}
              </div>
            </div>

            {/* Sección 4: Asignación */}
            <div className={sectionClass}>
              <h3 className="text-xs font-bold text-statusWarning uppercase tracking-widest flex items-center gap-2 pb-2 border-b border-borderDefault/50">
                <Car className="w-3.5 h-3.5" /> Asignación
              </h3>
              <div>
                <label className={labelClass}>Transportista</label>
                <select value={carrierId} onChange={e => setCarrierId(e.target.value)} className={inputClass}>
                  <option value="">(Ninguno / Independiente)</option>
                  {carriers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}><FileText className="w-3 h-3 inline mr-1" /> Notas Internas</label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  rows={2}
                  className={`${inputClass} resize-none`}
                  placeholder="Observaciones, restricciones, historial relevante..."
                />
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 px-6 py-4 border-t border-borderDefault bg-bgStart/40 shrink-0">
            <button type="button" onClick={onClose} className="px-5 py-2 text-textMuted hover:text-white transition-colors rounded-lg hover:bg-bgSurfaceHigh">
              Cancelar
            </button>
            <button type="submit" disabled={loading} className="px-6 py-2 bg-accentBlue text-bgStart font-bold rounded-lg hover:bg-accentBlue/90 transition-colors disabled:opacity-50 shadow-[0_0_15px_rgba(42,179,255,0.3)] flex items-center gap-2">
              {loading ? 'Guardando...' : (<><CheckCircle className="w-4 h-4" /> Guardar Chofer</>)}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
