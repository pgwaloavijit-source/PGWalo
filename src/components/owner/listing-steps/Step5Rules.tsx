import React, { useState, useEffect } from 'react';
import { Clock, Shield, Info } from 'lucide-react';
import { OwnerListingStep5 } from '../../../types';

interface Step5RulesProps {
  data: OwnerListingStep5;
  onDataChange: (data: OwnerListingStep5) => void;
  onValidationChange: (isValid: boolean) => void;
}

const MIN_STAY_OPTIONS = ['1 Month', '3 Months', '6 Months', '12 Months'];
const NOTICE_PERIOD_OPTIONS = ['15 Days', '30 Days', '60 Days', 'Custom'];

const Step5Rules: React.FC<Step5RulesProps> = ({ data, onDataChange, onValidationChange }) => {
  const [customNoticePeriod, setCustomNoticePeriod] = useState('');

  const validate = () => {
    const isValid = data.checkInTime && data.curfewTime;
    onValidationChange(!!isValid);
    return !!isValid;
  };

  useEffect(() => {
    validate();
  }, [data]);

  const handleChange = (field: keyof OwnerListingStep5, value: any) => {
    onDataChange({ ...data, [field]: value });
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-slate-900 mb-2">Rules & Policies</h2>
        <p className="text-slate-600">Set the rules and policies for your property to ensure smooth operations.</p>
      </div>

      <div className="space-y-6">
        {/* Check-in / Check-out */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <h3 className="text-xl font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-blue-600" />
            Check-in / Check-out
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Check-in Time</label>
              <input
                type="time"
                value={data.checkInTime}
                onChange={(e) => handleChange('checkInTime', e.target.value)}
                className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Curfew Time</label>
              <input
                type="time"
                value={data.curfewTime}
                onChange={(e) => handleChange('curfewTime', e.target.value)}
                className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>
        </div>

        {/* House Rules */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <h3 className="text-xl font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Shield className="w-5 h-5 text-blue-600" />
            House Rules
          </h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50">
              <div>
                <p className="font-medium text-slate-900">Smoking</p>
                <p className="text-sm text-slate-600">Allow smoking in the property</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={data.smokingAllowed}
                  onChange={(e) => handleChange('smokingAllowed', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-300 peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50">
              <div>
                <p className="font-medium text-slate-900">Alcohol</p>
                <p className="text-sm text-slate-600">Allow alcohol consumption</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={data.alcoholAllowed}
                  onChange={(e) => handleChange('alcoholAllowed', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-300 peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            <div className="p-4 rounded-xl bg-slate-50">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="font-medium text-slate-900">Visitors</p>
                  <p className="text-sm text-slate-600">Visitor policy</p>
                </div>
              </div>
              <div className="flex gap-2">
                {['Allowed', 'Restricted', 'Not Allowed'].map((option) => (
                  <button
                    key={option}
                    onClick={() => handleChange('visitorsAllowed', option as any)}
                    className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all ${
                      data.visitorsAllowed === option
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50">
              <div>
                <p className="font-medium text-slate-900">Pets</p>
                <p className="text-sm text-slate-600">Allow pets in the property</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={data.petsAllowed}
                  onChange={(e) => handleChange('petsAllowed', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-300 peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50">
              <div>
                <p className="font-medium text-slate-900">Cooking</p>
                <p className="text-sm text-slate-600">Allow cooking in rooms</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={data.cookingAllowed}
                  onChange={(e) => handleChange('cookingAllowed', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-300 peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
          </div>
        </div>

        {/* Additional Rules */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <h3 className="text-xl font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Info className="w-5 h-5 text-blue-600" />
            Additional Rules
          </h3>
          <textarea
            value={data.additionalRules}
            onChange={(e) => handleChange('additionalRules', e.target.value)}
            placeholder="Add any additional rules or instructions for residents..."
            rows={4}
            className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none resize-none"
          />
        </div>

        {/* Stay Requirements */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <h3 className="text-xl font-semibold text-slate-900 mb-4">Stay Requirements</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Minimum Stay</label>
              <select
                value={data.minimumStay}
                onChange={(e) => handleChange('minimumStay', e.target.value)}
                className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none"
              >
                {MIN_STAY_OPTIONS.map(option => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Notice Period</label>
              {data.noticePeriod === 'Custom' ? (
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={customNoticePeriod}
                    onChange={(e) => setCustomNoticePeriod(e.target.value)}
                    placeholder="Days"
                    className="flex-1 px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                  <button
                    onClick={() => handleChange('noticePeriod', `${customNoticePeriod} Days`)}
                    className="px-4 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700"
                  >
                    Set
                  </button>
                </div>
              ) : (
                <select
                  value={data.noticePeriod}
                  onChange={(e) => handleChange('noticePeriod', e.target.value)}
                  className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  {NOTICE_PERIOD_OPTIONS.map(option => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Step5Rules;