import React, { useState, useEffect } from 'react';
import { getSettings, saveSettings, UserSettings } from '~/utils/storage';
import { Switch } from '@headlessui/react';
import { ArrowPathIcon } from '@heroicons/react/24/solid';

interface SettingsProps {
  onClose: () => void;
}

export default function Settings({ onClose }: SettingsProps) {
  const [settings, setSettings] = useState<UserSettings>({
    theme: 'light',
    showGridOverlay: true,
    preferredGradingCompany: 'all',
    calibrationFactor: 1.0
  });
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  
  useEffect(() => {
    loadSettings();
  }, []);
  
  const loadSettings = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const userSettings = await getSettings();
      setSettings(userSettings);
    } catch (error) {
      console.error('Failed to load settings:', error);
      setError('Failed to load settings. Using defaults.');
    }
    
    setLoading(false);
  };
  
  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSaveSuccess(false);
    
    try {
      await saveSettings(settings);
      setSaveSuccess(true);
      
      // Reset success message after 3 seconds
      setTimeout(() => {
        setSaveSuccess(false);
      }, 3000);
    } catch (error) {
      console.error('Failed to save settings:', error);
      setError('Failed to save settings. Please try again.');
    }
    
    setSaving(false);
  };
  
  const handleChange = (field: keyof UserSettings, value: any) => {
    setSettings(prev => ({
      ...prev,
      [field]: value
    }));
  };
  
  return (
    <div className="bg-white rounded-lg shadow-lg p-6 max-w-md mx-auto">
      <h2 className="text-2xl font-bold mb-6">Settings</h2>
      
      {loading ? (
        <div className="flex justify-center items-center h-40">
          <ArrowPathIcon className="h-8 w-8 text-blue-600 animate-spin" />
        </div>
      ) : (
        <>
          {error && (
            <div className="p-4 mb-6 bg-red-100 text-red-800 rounded-lg">
              {error}
            </div>
          )}
          
          {saveSuccess && (
            <div className="p-4 mb-6 bg-green-100 text-green-800 rounded-lg">
              Settings saved successfully.
            </div>
          )}
          
          <div className="space-y-6">
            {/* Theme Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Theme
              </label>
              <div className="flex space-x-4">
                <label className="inline-flex items-center">
                  <input
                    type="radio"
                    className="form-radio text-blue-600"
                    checked={settings.theme === 'light'}
                    onChange={() => handleChange('theme', 'light')}
                  />
                  <span className="ml-2">Light</span>
                </label>
                <label className="inline-flex items-center">
                  <input
                    type="radio"
                    className="form-radio text-blue-600"
                    checked={settings.theme === 'dark'}
                    onChange={() => handleChange('theme', 'dark')}
                  />
                  <span className="ml-2">Dark</span>
                </label>
              </div>
            </div>
            
            {/* Grid Overlay */}
            <div>
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-700">
                  Show Grid Overlay
                </label>
                <Switch
                  checked={settings.showGridOverlay}
                  onChange={value => handleChange('showGridOverlay', value)}
                  className={`${
                    settings.showGridOverlay ? 'bg-blue-600' : 'bg-gray-200'
                  } relative inline-flex h-6 w-11 items-center rounded-full transition-colors`}
                >
                  <span
                    className={`${
                      settings.showGridOverlay ? 'translate-x-6' : 'translate-x-1'
                    } inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
                  />
                </Switch>
              </div>
              <p className="text-sm text-gray-500 mt-1">
                Display grid lines over cards during analysis
              </p>
            </div>
            
            {/* Preferred Grading Company */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Preferred Grading Company
              </label>
              <select
                value={settings.preferredGradingCompany}
                onChange={e => handleChange('preferredGradingCompany', e.target.value)}
                className="block w-full rounded-md border border-gray-300 bg-white py-2 px-3 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
              >
                <option value="all">All Companies</option>
                <option value="PSA">PSA</option>
                <option value="BGS">BGS</option>
                <option value="CGC">CGC</option>
              </select>
              <p className="text-sm text-gray-500 mt-1">
                Prioritize grading standards from your preferred company
              </p>
            </div>
            
            {/* Calibration Factor */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Calibration Factor: {settings.calibrationFactor.toFixed(1)}
              </label>
              <input
                type="range"
                min="0.5"
                max="1.5"
                step="0.1"
                value={settings.calibrationFactor}
                onChange={e => handleChange('calibrationFactor', parseFloat(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
              <p className="text-sm text-gray-500 mt-1">
                Adjust measurement sensitivity (1.0 is standard)
              </p>
            </div>
            
            <div className="flex gap-4 pt-4">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:bg-gray-400"
              >
                {saving ? (
                  <>
                    <ArrowPathIcon className="inline-block h-5 w-5 animate-spin mr-2" />
                    Saving...
                  </>
                ) : 'Save Settings'}
              </button>
              <button
                onClick={onClose}
                className="flex-1 bg-gray-200 text-gray-800 py-2 px-4 rounded-lg hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
              >
                Cancel
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
} 