import React, { useState, useEffect } from 'react';
import { Check, Wifi, Camera, Shield, Utensils, Zap, Home } from 'lucide-react';
import { OwnerListingStep3 } from '../../../types';
import { AMENITIES } from '../../../utils/amenities';

interface Step3AmenitiesProps {
  data: OwnerListingStep3;
  onDataChange: (data: OwnerListingStep3) => void;
  onValidationChange: (isValid: boolean) => void;
}

const ROOM_AMENITIES = [
  { id: 'ac', name: 'AC', icon: '❄️' },
  { id: 'fan', name: 'Fan', icon: '🌀' },
  { id: 'bed', name: 'Bed', icon: '🛏️' },
  { id: 'mattress', name: 'Mattress', icon: '🛋️' },
  { id: 'wardrobe', name: 'Wardrobe', icon: '🚪' },
  { id: 'study-table', name: 'Study Table', icon: '📚' },
  { id: 'chair', name: 'Chair', icon: '🪑' },
  { id: 'tv', name: 'TV', icon: '📺' },
  { id: 'refrigerator', name: 'Refrigerator', icon: '🧊' },
  { id: 'attached-bathroom', name: 'Attached Bathroom', icon: '🚿' },
  { id: 'balcony', name: 'Balcony', icon: '🌅' },
  { id: 'geyser', name: 'Geyser', icon: '🔥' },
];

const PROPERTY_AMENITIES = [
  { id: 'high-speed-wifi', name: 'High-Speed Wi-Fi', icon: '📶' },
  { id: 'air-conditioning', name: 'Air Conditioning', icon: '❄️' },
  { id: 'homely-food', name: '3-Time Homely Food', icon: '🍱' },
  { id: 'washing-machine-iron', name: 'Washing Machine & Iron', icon: '🧺' },
  { id: 'attached-western-washroom', name: 'Attached Western Washroom', icon: '🚿' },
  { id: 'generator-backup', name: '24×7 Generator Backup', icon: '🔋' },
  { id: 'cctv-biometric-entry', name: 'CCTV & Biometric Entry', icon: '📹' },
  { id: 'fitness-gym-yoga', name: 'Fitness Gym & Yoga Zone', icon: '💪' },
  { id: 'mineral-ro-water', name: 'Mineral RO Water Dispenser', icon: '💧' },
  { id: 'daily-housekeeping', name: 'Daily Room Housekeeping', icon: '🧹' },
  { id: 'hot-water-geyser', name: 'Hot Water Geyser', icon: '🔥' },
  { id: 'covered-parking', name: 'Covered Bike & Car Parking', icon: '🚗' },
  { id: 'study-table-chair', name: 'Study Table & Chair', icon: '📚' },
  { id: 'refrigerator', name: 'Refrigerator', icon: '🧊' },
  { id: 'laundry-service', name: 'Laundry Service', icon: '👕' },
  { id: 'lift-elevator', name: 'Lift / Elevator', icon: '🛗' },
  { id: 'common-tv-lounge', name: 'Common TV Lounge', icon: '📺' },
  { id: 'rooftop-terrace', name: 'Rooftop Terrace', icon: '☀️' },
  { id: 'security-guard', name: 'Security Guard', icon: '👮' },
  { id: 'fire-safety-system', name: 'Fire Safety System', icon: '🧯' },
  { id: 'power-backup', name: 'Power Backup', icon: '⚡' },
  { id: 'drinking-water', name: 'Drinking Water', icon: '🥤' },
  { id: 'kitchen-access', name: 'Kitchen Access', icon: '🍳' },
  { id: 'balcony', name: 'Balcony', icon: '🌅' },
  { id: 'smart-tv', name: 'Smart TV', icon: '📺' },
];

const FOOD_OPTIONS = [
  { id: 'breakfast', name: 'Breakfast' },
  { id: 'lunch', name: 'Lunch' },
  { id: 'snacks', name: 'Snacks' },
  { id: 'dinner', name: 'Dinner' },
];

const CANONICAL_PROPERTY_AMENITIES = AMENITIES.map((amenity) => ({ ...amenity, icon: '' }));

const Step3Amenities: React.FC<Step3AmenitiesProps> = ({ data, onDataChange, onValidationChange }) => {
  const [customService, setCustomService] = useState('');

  const validate = () => {
    // Amenities are optional, so always valid
    onValidationChange(true);
    return true;
  };

  useEffect(() => {
    validate();
  }, [data]);

  const toggleRoomAmenity = (amenityId: string) => {
    const updatedAmenities = data.roomAmenities.map(amenity =>
      amenity.id === amenityId
        ? { ...amenity, selected: !amenity.selected }
        : amenity
    );
    onDataChange({ ...data, roomAmenities: updatedAmenities });
  };

  const togglePropertyAmenity = (amenityId: string) => {
    const updatedAmenities = data.propertyAmenities.map(amenity =>
      amenity.id === amenityId
        ? { ...amenity, selected: !amenity.selected }
        : amenity
    );
    onDataChange({ ...data, propertyAmenities: updatedAmenities });
  };

  const toggleFoodOption = (foodId: string) => {
    const updatedOptions = data.foodOptions.map(option =>
      option.id === foodId
        ? { ...option, selected: !option.selected }
        : option
    );
    onDataChange({ ...data, foodOptions: updatedOptions });
  };

  const addCustomService = () => {
    if (customService.trim() && !data.otherServices.includes(customService.trim())) {
      onDataChange({
        ...data,
        otherServices: [...data.otherServices, customService.trim()],
      });
      setCustomService('');
    }
  };

  const removeCustomService = (service: string) => {
    onDataChange({
      ...data,
      otherServices: data.otherServices.filter(s => s !== service),
    });
  };

  // Initialize amenities if empty
  useEffect(() => {
    if (data.roomAmenities.length === 0) {
      onDataChange({
        ...data,
        roomAmenities: ROOM_AMENITIES.map(a => ({ id: a.id, name: a.name, selected: false })),
      });
    }
    if (data.propertyAmenities.length === 0) {
      onDataChange({
        ...data,
        propertyAmenities: CANONICAL_PROPERTY_AMENITIES.map(a => ({ id: a.id, name: a.name, selected: false })),
      });
    }
    if (data.foodOptions.length === 0) {
      onDataChange({
        ...data,
        foodOptions: FOOD_OPTIONS.map(f => ({ id: f.id, name: f.name, selected: false })),
      });
    }
  }, []);

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-slate-900 mb-2">Amenities & Services</h2>
        <p className="text-slate-600">Select the amenities and services available at your property.</p>
      </div>

      <div className="space-y-8">
        {/* Room Amenities */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <h3 className="text-xl font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Home className="w-5 h-5 text-blue-600" />
            Room Amenities
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {data.roomAmenities.map((amenity) => (
              <button
                key={amenity.id}
                onClick={() => toggleRoomAmenity(amenity.id)}
                className={`p-4 rounded-xl border-2 transition-all ${
                  amenity.selected
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300'
                }`}
              >
                <div className="text-2xl mb-2">{ROOM_AMENITIES.find(a => a.id === amenity.id)?.icon}</div>
                <div className="text-sm font-medium">{amenity.name}</div>
                {amenity.selected && (
                  <Check className="w-4 h-4 mt-2 text-blue-600" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Property Amenities */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <h3 className="text-xl font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Wifi className="w-5 h-5 text-blue-600" />
            Property Amenities
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            {data.propertyAmenities.map((amenity) => (
              <button
                key={amenity.id}
                onClick={() => togglePropertyAmenity(amenity.id)}
                className={`p-4 rounded-xl border-2 transition-all ${
                  amenity.selected
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300'
                }`}
              >
                <div className="text-2xl mb-2">{CANONICAL_PROPERTY_AMENITIES.find(a => a.id === amenity.id)?.icon}</div>
                <div className="text-sm font-medium">{amenity.name}</div>
                {amenity.selected && (
                  <Check className="w-4 h-4 mt-2 text-blue-600" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Food */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <h3 className="text-xl font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Utensils className="w-5 h-5 text-blue-600" />
            Food Services
          </h3>
          <div className="mb-4">
            <label className="flex items-center gap-3 mb-4">
              <input
                type="checkbox"
                checked={data.foodAvailable}
                onChange={(e) => onDataChange({ ...data, foodAvailable: e.target.checked })}
                className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="font-medium text-slate-900">Food Available?</span>
            </label>
          </div>

          {data.foodAvailable && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {data.foodOptions.map((option) => (
                  <button
                    key={option.id}
                    onClick={() => toggleFoodOption(option.id)}
                    disabled={!data.foodAvailable}
                    className={`p-3 rounded-xl border-2 transition-all ${
                      option.selected
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-slate-200 bg-slate-50 text-slate-600'
                    } ${!data.foodAvailable ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{option.name}</span>
                      {option.selected && <Check className="w-4 h-4 text-blue-600" />}
                    </div>
                  </button>
                ))}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Food Charges (₹/month)</label>
                <input
                  type="number"
                  value={data.foodCharges || ''}
                  onChange={(e) => onDataChange({ ...data, foodCharges: parseInt(e.target.value) || 0 })}
                  placeholder="Enter monthly food charges"
                  className="w-full md:w-1/3 px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default Step3Amenities;
