import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';

interface DriverModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export const DriverModal: React.FC<DriverModalProps> = ({ isOpen, onClose, onSaved }) => {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [documentId, setDocumentId] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [licenseExpiry, setLicenseExpiry] = useState('');
  const [documentImageUrl, setDocumentImageUrl] = useState('');
  const [phone, setPhone] = useState('');
  const [carrierId, setCarrierId] = useState('');
  const [carriers, setCarriers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchCarriers();
    }
  }, [isOpen]);

  const fetchCarriers = async () => {
    try {
      const res = await fetch('http://localhost:3000/api/v1/carriers', {
        headers: { Authorization: `Bearer ${localStorage.getItem('rusertech_token')}` }
      });
      if (res.ok) {
        setCarriers(await res.json());
      }
    } catch (e) {
      console.error(e);
    }
  };

  if (!isOpen) return null;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const formData = new FormData();
    formData.append('file', file);
    
    setLoading(true);
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
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('http://localhost:3000/api/v1/drivers', {
        method: 'POST',
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
          carrier_id: carrierId || undefined,
          status: 'active'
        }),
      });

      if (!res.ok) {
        throw new Error('Error al guardar chofer');
      }

      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-bgStart/80 backdrop-blur-sm p-4">
      <div className="bg-bgSurface rounded-2xl shadow-xl border border-borderDefault w-full max-w-lg overflow-hidden animate-fade-in-up">
        <div className="flex justify-between items-center p-6 border-b border-borderDefault bg-bgSurfaceHigh">
          <h2 className="text-xl font-display font-semibold text-white">
            Nuevo Chofer
          </h2>
          <button onClick={onClose} className="text-textMuted hover:text-white transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-statusDanger/10 border border-statusDanger/20 text-statusDanger rounded-lg text-sm">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-textSecondary mb-1">Nombre</label>
              <input
                type="text"
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full bg-bgStart border border-borderDefault rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-accentBlue focus:ring-1 focus:ring-accentBlue"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-textSecondary mb-1">Apellido</label>
              <input
                type="text"
                required
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full bg-bgStart border border-borderDefault rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-accentBlue focus:ring-1 focus:ring-accentBlue"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-textSecondary mb-1">Documento (DNI)</label>
              <input
                type="text"
                value={documentId}
                onChange={(e) => setDocumentId(e.target.value)}
                className="w-full bg-bgStart border border-borderDefault rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-accentBlue focus:ring-1 focus:ring-accentBlue"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-textSecondary mb-1">Licencia Nº</label>
              <input
                type="text"
                value={licenseNumber}
                onChange={(e) => setLicenseNumber(e.target.value)}
                className="w-full bg-bgStart border border-borderDefault rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-accentBlue focus:ring-1 focus:ring-accentBlue"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-textSecondary mb-1">Teléfono</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full bg-bgStart border border-borderDefault rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-accentBlue focus:ring-1 focus:ring-accentBlue"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-textSecondary mb-1">Transportista</label>
              <select
                value={carrierId}
                onChange={(e) => setCarrierId(e.target.value)}
                className="w-full bg-bgStart border border-borderDefault rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-accentBlue focus:ring-1 focus:ring-accentBlue"
              >
                <option value="">(Ninguno / Independiente)</option>
                {carriers.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-textSecondary mb-1">Vencimiento Licencia</label>
              <input
                type="date"
                value={licenseExpiry}
                onChange={(e) => setLicenseExpiry(e.target.value)}
                className="w-full bg-bgStart border border-borderDefault rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-accentBlue focus:ring-1 focus:ring-accentBlue"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-textSecondary mb-1">Foto Documento / Licencia</label>
              <input
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="w-full bg-bgStart border border-borderDefault rounded-lg px-4 py-2 text-white focus:outline-none focus:border-accentBlue file:mr-4 file:py-1 file:px-3 file:rounded file:border-0 file:bg-accentBlue/20 file:text-accentBlue file:font-medium"
              />
              {documentImageUrl && (
                <div className="mt-2 h-20 w-32 rounded-lg border border-borderDefault overflow-hidden">
                  <img src={documentImageUrl} alt="Preview" className="w-full h-full object-cover" />
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 mt-6 border-t border-borderDefault">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-textMuted hover:text-white transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-accentBlue text-bgStart font-medium rounded-lg hover:bg-accentBlue/90 transition-colors disabled:opacity-50"
            >
              {loading ? 'Guardando...' : 'Guardar Chofer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
