import React, { useState } from 'react';
import { X } from 'lucide-react';

interface CarrierModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export const CarrierModal: React.FC<CarrierModalProps> = ({ isOpen, onClose, onSaved }) => {
  const [name, setName] = useState('');
  const [taxId, setTaxId] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [address, setAddress] = useState('');
  const [googleMapsLink, setGoogleMapsLink] = useState('');
  const [operatingBases, setOperatingBases] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('http://localhost:3000/api/v1/carriers', {
        method: 'POST',
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
          status: 'active'
        }),
      });

      if (!res.ok) {
        throw new Error('Error al guardar transportista');
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
            Nuevo Transportista
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

          <div>
            <label className="block text-sm font-medium text-textSecondary mb-1">Razón Social</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-bgStart border border-borderDefault rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-accentBlue focus:ring-1 focus:ring-accentBlue"
              placeholder="Ej: Transportes del Norte S.A."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-textSecondary mb-1">CUIT / RUT</label>
            <input
              type="text"
              value={taxId}
              onChange={(e) => setTaxId(e.target.value)}
              className="w-full bg-bgStart border border-borderDefault rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-accentBlue focus:ring-1 focus:ring-accentBlue"
            />
          </div>

          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-sm text-textSecondary mb-1">Nombre Completo del Contacto</label>
              <input type="text" className="w-full bg-bgStart border border-borderDefault rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-accentBlue focus:ring-1 focus:ring-accentBlue" value={contactName} onChange={e => setContactName(e.target.value)} />
            </div>
            <div className="flex-1">
              <label className="block text-sm text-textSecondary mb-1">Teléfono de Contacto</label>
              <input type="text" className="w-full bg-bgStart border border-borderDefault rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-accentBlue focus:ring-1 focus:ring-accentBlue" value={contactPhone} onChange={e => setContactPhone(e.target.value)} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-textSecondary mb-1">Email de Contacto</label>
            <input
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              className="w-full bg-bgStart border border-borderDefault rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-accentBlue focus:ring-1 focus:ring-accentBlue"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-textSecondary mb-1">Dirección Física</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Ej: Av. Libertador 1234, CABA"
                className="w-full bg-bgStart border border-borderDefault rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-accentBlue focus:ring-1 focus:ring-accentBlue"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-textSecondary mb-1">Link Google Maps</label>
              <input
                type="url"
                value={googleMapsLink}
                onChange={(e) => setGoogleMapsLink(e.target.value)}
                placeholder="https://maps.google.com/..."
                className="w-full bg-bgStart border border-borderDefault rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-accentBlue focus:ring-1 focus:ring-accentBlue"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-textSecondary mb-1">Información de Bases Operativas</label>
            <textarea
              value={operatingBases}
              onChange={(e) => setOperatingBases(e.target.value)}
              placeholder="Ej: Base principal en Pacheco, Base secundaria en Córdoba..."
              rows={3}
              className="w-full bg-bgStart border border-borderDefault rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-accentBlue focus:ring-1 focus:ring-accentBlue resize-none"
            />
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
              className="px-6 py-2 bg-accentGreen text-bgStart font-medium rounded-lg hover:bg-accentGreen/90 transition-colors disabled:opacity-50"
            >
              {loading ? 'Guardando...' : 'Guardar Transportista'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
