import React, { useState, useEffect } from 'react';
import {
  Settings,
  Lock,
  Building,
  KeyRound,
  Download,
  Trash2,
  ShieldCheck,
  Check,
  Loader2,
  Smartphone,
  LogOut,
} from 'lucide-react';
import { apiRequest, downloadBlob } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Setting } from '../types';

export const SettingsPage: React.FC = () => {
  const { user, refreshProfile, logoutAllDevices } = useAuth();
  const [settings, setSettings] = useState<Setting | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Form states
  const [businessName, setBusinessName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [taxId, setTaxId] = useState('');
  const [bankDetails, setBankDetails] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [invoicePrefix, setInvoicePrefix] = useState('INV-');
  const [nextInvoiceNumber, setNextInvoiceNumber] = useState('1001');
  const [taxType, setTaxType] = useState('GST');
  const [defaultTaxRate, setDefaultTaxRate] = useState('10');

  // 2FA Setup
  const [twoFaModal, setTwoFaModal] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [twoFaSecret, setTwoFaSecret] = useState('');
  const [totpVerifyCode, setTotpVerifyCode] = useState('');
  const [twoFaLoading, setTwoFaLoading] = useState(false);

  // Backup
  const [backupLoading, setBackupLoading] = useState(false);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const res = await apiRequest<{ success: boolean; data: Setting }>('/settings');
      if (res.data) {
        setSettings(res.data);
        setBusinessName(res.data.businessName || '');
        setEmail(res.data.email || '');
        setPhone(res.data.phone || '');
        setAddress(res.data.address || '');
        setTaxId(res.data.taxId || '');
        setBankDetails(res.data.bankDetails || '');
        setCurrency(res.data.currency || 'USD');
        setInvoicePrefix(res.data.invoicePrefix || 'INV-');
        setNextInvoiceNumber(String(res.data.nextInvoiceNumber || 1001));
        setTaxType(res.data.taxType || 'GST');
        setDefaultTaxRate(String(res.data.defaultTaxRate || 10));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMsg('');
    setErrorMsg('');

    try {
      await apiRequest('/settings', {
        method: 'PUT',
        body: JSON.stringify({
          businessName,
          email,
          phone,
          address,
          taxId,
          bankDetails,
          currency,
          invoicePrefix,
          nextInvoiceNumber: parseInt(nextInvoiceNumber, 10),
          taxType,
          defaultTaxRate: parseFloat(defaultTaxRate),
        }),
      });

      setSuccessMsg('Settings saved and encrypted successfully!');
      fetchSettings();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleStart2FASetup = async () => {
    setTwoFaLoading(true);
    try {
      const res = await apiRequest<{
        success: boolean;
        data: { secret: string; qrCodeDataUrl: string };
      }>('/auth/2fa/setup', { method: 'POST' });

      setQrCodeUrl(res.data.qrCodeDataUrl);
      setTwoFaSecret(res.data.secret);
      setTwoFaModal(true);
    } catch (err: any) {
      alert(err.message || 'Failed to setup 2FA');
    } finally {
      setTwoFaLoading(false);
    }
  };

  const handleConfirm2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    setTwoFaLoading(true);
    try {
      await apiRequest('/auth/2fa/verify', {
        method: 'POST',
        body: JSON.stringify({ token: totpVerifyCode }),
      });
      alert('2FA successfully enabled on your account!');
      setTwoFaModal(false);
      setTotpVerifyCode('');
      refreshProfile();
    } catch (err: any) {
      alert(err.message || 'Invalid 6-digit code');
    } finally {
      setTwoFaLoading(false);
    }
  };

  const handleExportBackup = async () => {
    try {
      setBackupLoading(true);
      const blob = await apiRequest<Blob>('/settings/backup');
      downloadBlob(blob, `FreelanceVault_Encrypted_Backup_${Date.now()}.vault`);
    } catch (err: any) {
      alert(err.message || 'Failed to generate backup');
    } finally {
      setBackupLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-4xl">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          Settings & Security
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Configure business details, banking instructions, and encryption settings
        </p>
      </div>

      {successMsg && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 rounded-xl border border-emerald-200 dark:border-emerald-800 flex items-center gap-2">
          <Check className="w-4 h-4" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 rounded-xl border border-red-200 dark:border-red-800">
          {errorMsg}
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSaveSettings} className="space-y-6">
        {/* Business Profile */}
        <div className="p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
            <Building className="w-5 h-5 text-brand-600" />
            <h2 className="font-bold text-slate-900 dark:text-white">Business Profile</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase mb-1">
                Business / Freelancer Name
              </label>
              <input
                type="text"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="Alex Vance Studio"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase mb-1">
                Business Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="invoices@vancestudio.dev"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm dark:text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase mb-1">
                Business Phone
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 555-0100"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase mb-1">
                Business Address (Appears on Invoices)
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="100 Innovation Way, San Francisco, CA"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm dark:text-white"
              />
            </div>
          </div>
        </div>

        {/* Encrypted Sensitive Fields */}
        <div className="p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Lock className="w-5 h-5 text-emerald-600" />
              <h2 className="font-bold text-slate-900 dark:text-white">
                Encrypted Credentials at Rest (AES-256-GCM)
              </h2>
            </div>
            <span className="text-[11px] text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full font-medium">
              Zero-Knowledge Encrypted
            </span>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase mb-1">
              Business Tax ID / EIN / VAT (Encrypted)
            </label>
            <input
              type="text"
              value={taxId}
              onChange={(e) => setTaxId(e.target.value)}
              placeholder="e.g. 12-3456789 or GB999 9999 73"
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-mono dark:text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase mb-1">
              Bank Account & Wire Routing Instructions (Encrypted)
            </label>
            <textarea
              rows={3}
              value={bankDetails}
              onChange={(e) => setBankDetails(e.target.value)}
              placeholder="Bank Name: Silicon Valley Bank&#10;Routing / ABA: 121000358&#10;Account #: 99281729182&#10;SWIFT / BIC: SVBUS6S"
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-mono dark:text-white"
            />
            <p className="text-xs text-slate-400 mt-1">
              This information is encrypted before saving and only decrypted when generating invoice PDFs.
            </p>
          </div>
        </div>

        {/* Invoice & Tax Defaults */}
        <div className="p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <h2 className="font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-3">
            Invoicing & Tax Defaults
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase mb-1">
                Currency
              </label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm dark:text-white"
              >
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="GBP">GBP (£)</option>
                <option value="CAD">CAD ($)</option>
                <option value="AUD">AUD ($)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase mb-1">
                Invoice Prefix
              </label>
              <input
                type="text"
                value={invoicePrefix}
                onChange={(e) => setInvoicePrefix(e.target.value)}
                placeholder="INV-"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase mb-1">
                Next Invoice Number
              </label>
              <input
                type="number"
                value={nextInvoiceNumber}
                onChange={(e) => setNextInvoiceNumber(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm dark:text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase mb-1">
                Tax Type
              </label>
              <select
                value={taxType}
                onChange={(e) => setTaxType(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm dark:text-white"
              >
                <option value="GST">GST (Goods and Services Tax)</option>
                <option value="VAT">VAT (Value Added Tax)</option>
                <option value="SALES_TAX">Sales Tax</option>
                <option value="NONE">No Tax</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase mb-1">
                Default Tax Rate (%)
              </label>
              <input
                type="number"
                step="0.1"
                value={defaultTaxRate}
                onChange={(e) => setDefaultTaxRate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm dark:text-white"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-white bg-brand-600 hover:bg-brand-500 rounded-xl shadow-sm transition-all"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            <span>Save Configuration</span>
          </button>
        </div>
      </form>

      {/* Security, 2FA, & Backups */}
      <div className="p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
        <h2 className="font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-3">
          Account Security & Backups
        </h2>

        {/* 2FA */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="font-semibold text-sm text-slate-900 dark:text-white flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-brand-600" />
              <span>Two-Factor Authentication (TOTP)</span>
              {user?.twoFactorEnabled && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                  Enabled
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Secure your vault login with Google Authenticator, Authy, or 1Password.
            </p>
          </div>

          {!user?.twoFactorEnabled ? (
            <button
              onClick={handleStart2FASetup}
              disabled={twoFaLoading}
              className="px-4 py-2 text-xs font-semibold text-brand-700 bg-brand-50 hover:bg-brand-100 rounded-xl whitespace-nowrap"
            >
              {twoFaLoading ? 'Generating...' : 'Enable 2FA'}
            </button>
          ) : (
            <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
              <Check className="w-4 h-4" /> 2FA Active
            </span>
          )}
        </div>

        {/* Invalidate all devices */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 border-t border-slate-100 dark:border-slate-800">
          <div>
            <div className="font-semibold text-sm text-slate-900 dark:text-white flex items-center gap-2">
              <LogOut className="w-4 h-4 text-slate-500" />
              <span>Session Invalidation</span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Instantly terminate all active sessions across laptops, phones, and tablets.
            </p>
          </div>

          <button
            onClick={logoutAllDevices}
            className="px-4 py-2 text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-xl whitespace-nowrap"
          >
            Log Out From All Devices
          </button>
        </div>

        {/* Encrypted Vault Backup */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 border-t border-slate-100 dark:border-slate-800">
          <div>
            <div className="font-semibold text-sm text-slate-900 dark:text-white flex items-center gap-2">
              <Download className="w-4 h-4 text-indigo-500" />
              <span>Full Encrypted Vault Export</span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Download an encrypted snapshot of your complete account database for offline backup.
            </p>
          </div>

          <button
            onClick={handleExportBackup}
            disabled={backupLoading}
            className="px-4 py-2 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-xl whitespace-nowrap"
          >
            {backupLoading ? 'Encrypting...' : 'Export Encrypted Backup'}
          </button>
        </div>
      </div>

      {/* 2FA Setup Modal */}
      {twoFaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
            <h3 className="font-bold text-slate-900 dark:text-white">Scan Authenticator QR Code</h3>
            <p className="text-xs text-slate-500">
              Open Google Authenticator or your password manager and scan the QR code below:
            </p>

            <div className="flex justify-center p-4 bg-white rounded-xl border border-slate-200">
              <img src={qrCodeUrl} alt="2FA QR Code" className="w-48 h-48" />
            </div>

            <div className="text-xs font-mono bg-slate-50 dark:bg-slate-800 p-2.5 rounded-lg text-center select-all dark:text-white">
              Manual Secret: {twoFaSecret}
            </div>

            <form onSubmit={handleConfirm2FA} className="space-y-3 pt-2">
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase">
                Enter 6-Digit Code to Confirm
              </label>
              <input
                type="text"
                maxLength={6}
                required
                value={totpVerifyCode}
                onChange={(e) => setTotpVerifyCode(e.target.value.replace(/\D/g, ''))}
                placeholder="123456"
                className="w-full text-center tracking-widest text-2xl font-mono px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl dark:text-white"
              />

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setTwoFaModal(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 rounded-lg hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={twoFaLoading}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-brand-600 hover:bg-brand-500 rounded-lg"
                >
                  {twoFaLoading ? 'Verifying...' : 'Enable 2FA'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
