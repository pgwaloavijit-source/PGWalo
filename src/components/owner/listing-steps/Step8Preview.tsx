import React, { useState, useEffect } from 'react';
import { Star, MapPin, Edit, CheckCircle, AlertCircle, TrendingUp } from 'lucide-react';
import { OwnerListingStep8, OwnerListingData, ListingQualityScore } from '../../../types';

interface Step8PreviewProps {
  data: OwnerListingStep8;
  fullListingData: OwnerListingData;
  onDataChange: (data: OwnerListingStep8) => void;
  onValidationChange: (isValid: boolean) => void;
  onEditStep: (step: number) => void;
}

const Step8Preview: React.FC<Step8PreviewProps> = ({ data, fullListingData, onDataChange, onValidationChange, onEditStep }) => {
  const [qualityScore, setQualityScore] = useState<ListingQualityScore>({
    overall: 0,
    details: {
      propertyDetails: 0,
      photos: 0,
      amenities: 0,
      pricing: 0,
      location: 0,
    },
    missingItems: [],
  });

  useEffect(() => {
    // Calculate quality score
    const scores = {
      propertyDetails: calculatePropertyDetailsScore(),
      photos: calculatePhotosScore(),
      amenities: calculateAmenitiesScore(),
      pricing: calculatePricingScore(),
      location: calculateLocationScore(),
    };

    const overall = Math.round(
      (scores.propertyDetails + scores.photos + scores.amenities + scores.pricing + scores.location) / 5
    );

    const missingItems = [];
    if (scores.propertyDetails < 80) missingItems.push('Complete property details');
    if (scores.photos < 80) missingItems.push('More photos');
    if (scores.amenities < 80) missingItems.push('More amenities');
    if (scores.pricing < 80) missingItems.push('Complete pricing');
    if (scores.location < 80) missingItems.push('Better location info');

    setQualityScore({
      overall,
      details: scores,
      missingItems,
    });

    onDataChange({
      ...data,
      qualityScore: { overall, details: scores, missingItems },
      previewData: fullListingData,
    });

    onValidationChange(overall >= 70);
  }, [fullListingData]);

  const calculatePropertyDetailsScore = () => {
    const step1 = fullListingData.step1;
    let score = 0;
    if (step1.propertyName) score += 20;
    if (step1.city) score += 20;
    if (step1.locality) score += 20;
    if (step1.fullAddress) score += 20;
    if (step1.propertyDescription) score += 20;
    return score;
  };

  const calculatePhotosScore = () => {
    const photos = fullListingData.step4.photos;
    if (photos.length === 0) return 0;
    if (photos.length < 3) return 40;
    if (photos.length < 5) return 60;
    if (photos.length < 8) return 80;
    return 100;
  };

  const calculateAmenitiesScore = () => {
    const roomAmenities = fullListingData.step3.roomAmenities.filter(a => a.selected).length;
    const propertyAmenities = fullListingData.step3.propertyAmenities.filter(a => a.selected).length;
    const total = roomAmenities + propertyAmenities;
    if (total === 0) return 0;
    if (total < 3) return 40;
    if (total < 6) return 60;
    if (total < 10) return 80;
    return 100;
  };

  const calculatePricingScore = () => {
    const rooms = fullListingData.step2.rooms;
    if (rooms.length === 0) return 0;
    let score = 50;
    rooms.forEach(room => {
      room.beds.forEach(bed => {
        if (bed.monthlyRent > 0) score += 10;
        if (bed.securityDeposit > 0) score += 5;
      });
    });
    return Math.min(score, 100);
  };

  const calculateLocationScore = () => {
    const step1 = fullListingData.step1;
    let score = 0;
    if (step1.fullAddress) score += 40;
    if (step1.pincode) score += 30;
    if (step1.nearbyLandmark) score += 30;
    return score;
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreBackground = (score: number) => {
    if (score >= 80) return 'bg-green-100';
    if (score >= 60) return 'bg-yellow-100';
    return 'bg-red-100';
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-slate-900 mb-2">Listing Preview</h2>
        <p className="text-slate-600">Review your property listing before publishing.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Preview */}
        <div className="lg:col-span-2 space-y-6">
          {/* Property Card */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            {/* Cover Image */}
            <div className="aspect-video bg-gradient-to-br from-blue-400 to-blue-600 relative">
              {fullListingData.step4.photos.length > 0 && (
                <img
                  src={fullListingData.step4.photos[0].url}
                  alt="Property"
                  className="w-full h-full object-cover"
                />
              )}
              <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full text-sm font-medium">
                ✓ PGWALO Verified
              </div>
            </div>

            {/* Property Info */}
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-2xl font-bold text-slate-900 mb-1">
                    {fullListingData.step1.propertyName || 'Your Property Name'}
                  </h3>
                  <div className="flex items-center gap-2 text-slate-600">
                    <MapPin className="w-4 h-4" />
                    <span className="text-sm">
                      {fullListingData.step1.locality}, {fullListingData.step1.city}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-blue-600">
                    ₹{fullListingData.step2.rooms[0]?.beds[0]?.monthlyRent || '8,000'}
                  </p>
                  <p className="text-sm text-slate-600">/month onwards</p>
                </div>
              </div>

              {/* Tags */}
              <div className="flex flex-wrap gap-2 mb-4">
                <span className="px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-sm font-medium">
                  {fullListingData.step1.genderOccupancy}
                </span>
                <span className="px-3 py-1 rounded-full bg-green-100 text-green-700 text-sm font-medium">
                  {fullListingData.step2.rooms.length} Rooms
                </span>
                <span className="px-3 py-1 rounded-full bg-purple-100 text-purple-700 text-sm font-medium">
                  {fullListingData.step2.rooms.reduce((sum, room) => sum + room.numberOfBeds, 0)} Beds
                </span>
              </div>

              {/* Description */}
              <p className="text-slate-600 text-sm mb-4">
                {fullListingData.step1.propertyDescription || 'Your property description will appear here...'}
              </p>

              {/* Amenities */}
              <div className="mb-4">
                <h4 className="font-semibold text-slate-900 mb-2">Amenities</h4>
                <div className="flex flex-wrap gap-2">
                  {fullListingData.step3.propertyAmenities.filter(a => a.selected).slice(0, 6).map(amenity => (
                    <span key={amenity.id} className="px-2 py-1 rounded-lg bg-slate-100 text-slate-700 text-xs">
                      {amenity.name}
                    </span>
                  ))}
                  {fullListingData.step3.propertyAmenities.filter(a => a.selected).length > 6 && (
                    <span className="px-2 py-1 rounded-lg bg-slate-100 text-slate-700 text-xs">
                      +{fullListingData.step3.propertyAmenities.filter(a => a.selected).length - 6} more
                    </span>
                  )}
                </div>
              </div>

              {/* Rooms */}
              <div>
                <h4 className="font-semibold text-slate-900 mb-2">Available Rooms</h4>
                <div className="space-y-2">
                  {fullListingData.step2.rooms.slice(0, 3).map((room, index) => (
                    <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-slate-50">
                      <div>
                        <p className="font-medium text-slate-900">Room {room.roomNumber}</p>
                        <p className="text-xs text-slate-600">{room.sharingCapacity} Sharing</p>
                      </div>
                      <p className="font-semibold text-slate-900">
                        ₹{room.beds[0]?.monthlyRent || '8,000'}/month
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Edit Buttons */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h3 className="font-semibold text-slate-900 mb-4">Edit Sections</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <button
                onClick={() => onEditStep(1)}
                className="flex items-center gap-2 px-4 py-3 rounded-xl border border-slate-300 text-slate-700 font-medium hover:bg-slate-50 transition-colors"
              >
                <Edit className="w-4 h-4" />
                Property
              </button>
              <button
                onClick={() => onEditStep(2)}
                className="flex items-center gap-2 px-4 py-3 rounded-xl border border-slate-300 text-slate-700 font-medium hover:bg-slate-50 transition-colors"
              >
                <Edit className="w-4 h-4" />
                Rooms
              </button>
              <button
                onClick={() => onEditStep(4)}
                className="flex items-center gap-2 px-4 py-3 rounded-xl border border-slate-300 text-slate-700 font-medium hover:bg-slate-50 transition-colors"
              >
                <Edit className="w-4 h-4" />
                Photos
              </button>
              <button
                onClick={() => onEditStep(3)}
                className="flex items-center gap-2 px-4 py-3 rounded-xl border border-slate-300 text-slate-700 font-medium hover:bg-slate-50 transition-colors"
              >
                <Edit className="w-4 h-4" />
                Amenities
              </button>
            </div>
          </div>
        </div>

        {/* Quality Score */}
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-600" />
              Listing Quality
            </h3>
            <div className="text-center mb-4">
              <div className={`text-5xl font-bold ${getScoreColor(qualityScore.overall)}`}>
                {qualityScore.overall}
              </div>
              <p className="text-slate-600 text-sm">out of 100</p>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-slate-200 rounded-full h-3 mb-4">
              <div
                className={`h-3 rounded-full transition-all ${
                  qualityScore.overall >= 80 ? 'bg-green-500' :
                  qualityScore.overall >= 60 ? 'bg-yellow-500' :
                  'bg-red-500'
                }`}
                style={{ width: `${qualityScore.overall}%` }}
              />
            </div>

            {/* Score Breakdown */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Property Details</span>
                <span className={`text-sm font-semibold ${getScoreColor(qualityScore.details.propertyDetails)}`}>
                  {qualityScore.details.propertyDetails}%
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Photos</span>
                <span className={`text-sm font-semibold ${getScoreColor(qualityScore.details.photos)}`}>
                  {qualityScore.details.photos}%
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Amenities</span>
                <span className={`text-sm font-semibold ${getScoreColor(qualityScore.details.amenities)}`}>
                  {qualityScore.details.amenities}%
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Pricing</span>
                <span className={`text-sm font-semibold ${getScoreColor(qualityScore.details.pricing)}`}>
                  {qualityScore.details.pricing}%
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Location</span>
                <span className={`text-sm font-semibold ${getScoreColor(qualityScore.details.location)}`}>
                  {qualityScore.details.location}%
                </span>
              </div>
            </div>

            {/* Missing Items */}
            {qualityScore.missingItems.length > 0 && (
              <div className="mt-4 p-4 rounded-xl bg-yellow-50 border border-yellow-200">
                <h4 className="font-semibold text-yellow-900 mb-2 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  Improve Your Listing
                </h4>
                <ul className="space-y-1">
                  {qualityScore.missingItems.map((item, index) => (
                    <li key={index} className="text-sm text-yellow-800">• {item}</li>
                  ))}
                </ul>
              </div>
            )}

            {qualityScore.overall >= 80 && (
              <div className="mt-4 p-4 rounded-xl bg-green-50 border border-green-200">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <span className="font-semibold text-green-900">Great listing quality!</span>
                </div>
                <p className="text-sm text-green-800 mt-1">Your listing is ready to attract residents.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Step8Preview;