import React, { useState, useEffect } from 'react';
import { Camera, Upload, CheckCircle, AlertCircle, RefreshCw, Sparkles } from 'lucide-react';
import { OwnerListingStep4, PropertyPhoto, PhotoCategory } from '../../../types';
import { normalizeListingPhoto } from '../../../utils/photoEnhance';
import { uploadListingPhoto } from '../../../services/media';

interface Step4PhotosProps {
  data: OwnerListingStep4;
  onDataChange: (data: OwnerListingStep4) => void;
  onValidationChange: (isValid: boolean) => void;
}

const PHOTO_CATEGORIES: PhotoCategory[] = ['Exterior', 'Bedroom', 'Bathroom', 'Kitchen', 'Dining', 'Common Area', 'Amenities'];

const REQUIRED_PHOTOS = [
  { category: 'Exterior', label: 'Exterior', required: true },
  { category: 'Bedroom', label: 'Room Overview', required: true },
  { category: 'Bedroom', label: 'Bed', required: true },
  { category: 'Bathroom', label: 'Bathroom', required: true },
  { category: 'Common Area', label: 'Common Area', required: false },
  { category: 'Kitchen', label: 'Kitchen', required: false },
];

const Step4Photos: React.FC<Step4PhotosProps> = ({ data, onDataChange, onValidationChange }) => {
  const [isAICameraOpen, setIsAICameraOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<PhotoCategory>('Exterior');
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});

  const validate = () => {
    // Check if at least one photo is uploaded
    const isValid = data.photos.length > 0;
    onValidationChange(isValid);
    return isValid;
  };

  useEffect(() => {
    validate();
  }, [data]);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    Array.from(files).forEach((file: File) => {
      void (async () => {
        const normalized = await normalizeListingPhoto(file);
        let url = normalized.dataUrl;
        try {
          const uploaded = await uploadListingPhoto(normalized.blob, selectedCategory);
          if (uploaded.url) url = uploaded.url;
          else if (uploaded.dataUrl) url = uploaded.dataUrl;
        } catch {
          /* keep normalized photo */
        }
        const newPhoto: PropertyPhoto = {
          id: `photo-${Date.now()}-${Math.random()}`,
          url,
          category: selectedCategory,
          qualityScore: 88,
          aiAnalysis: {
            sharpness: true,
            lighting: true,
            visibility: true,
            composition: true,
            recommendation: 'Good quality photo',
          },
          uploadDate: new Date().toISOString(),
        };
        onDataChange({ ...data, photos: [...data.photos, newPhoto] });
      })();
    });
  };

  const deletePhoto = (photoId: string) => {
    onDataChange({
      ...data,
      photos: data.photos.filter(photo => photo.id !== photoId),
    });
  };

  const getPhotosByCategory = (category: PhotoCategory) => {
    return data.photos.filter(photo => photo.category === category);
  };

  const getCategoryCount = (category: PhotoCategory) => {
    return getPhotosByCategory(category).length;
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-slate-900 mb-2">Property Photos</h2>
        <p className="text-slate-600">Capture and upload photos of your property. Our AI will help you get the best quality photos.</p>
      </div>

      {/* AI Camera Feature */}
      <div className="mb-6 bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl p-6 text-white shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
              <Camera className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-bold mb-1">AI Camera</h3>
              <p className="text-blue-100 text-sm">Let AI guide you to capture professional-quality photos</p>
            </div>
          </div>
          <button
            onClick={() => setIsAICameraOpen(true)}
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-white text-blue-600 font-semibold hover:bg-blue-50 transition-all shadow-lg"
          >
            <Sparkles className="w-5 h-5" />
            Open AI Camera
          </button>
        </div>
      </div>

      {/* Category Selection */}
      <div className="mb-6">
        <label className="block text-sm font-semibold text-slate-700 mb-3">Select Photo Category</label>
        <div className="flex flex-wrap gap-2">
          {PHOTO_CATEGORIES.map((category) => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                selectedCategory === category
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {category} ({getCategoryCount(category)})
            </button>
          ))}
        </div>
      </div>

      {/* Upload Section */}
      <div className="mb-6">
        <div className="border-2 border-dashed border-slate-300 rounded-2xl p-8 bg-slate-50 hover:bg-slate-100 transition-colors">
          <div className="text-center">
            <Upload className="w-12 h-12 text-slate-400 mx-auto mb-4" />
            <p className="text-slate-600 font-medium mb-2">Upload photos for {selectedCategory}</p>
            <p className="text-slate-500 text-sm mb-4">Drag and drop or click to select files</p>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileUpload}
              className="hidden"
              id="photo-upload"
            />
            <label
              htmlFor="photo-upload"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors cursor-pointer"
            >
              <Upload className="w-5 h-5" />
              Select Photos
            </label>
          </div>
        </div>
      </div>

      {/* Photo Gallery */}
      <div className="space-y-6">
        {PHOTO_CATEGORIES.map((category) => {
          const categoryPhotos = getPhotosByCategory(category);
          if (categoryPhotos.length === 0) return null;

          return (
            <div key={category} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-900">{category}</h3>
                <span className="text-sm text-slate-500">{categoryPhotos.length} photos</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {categoryPhotos.map((photo) => (
                  <div key={photo.id} className="relative group">
                    <div className="aspect-square rounded-xl overflow-hidden border border-slate-200">
                      <img
                        src={photo.url}
                        alt={category}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => deletePhoto(photo.id)}
                        className="p-2 rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors"
                      >
                        <RefreshCw className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="absolute bottom-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded-lg">
                      {photo.qualityScore}%
                    </div>
                    {photo.aiAnalysis?.recommendation && (
                      <div className="absolute top-2 left-2 bg-white/90 text-slate-900 text-xs px-2 py-1 rounded-lg max-w-[120px]">
                        {photo.aiAnalysis.recommendation}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* AI Quality Analysis */}
      {data.photos.length > 0 && (
        <div className="mt-6 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-blue-600" />
            AI Quality Analysis
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.photos.slice(0, 4).map((photo) => (
              <div key={photo.id} className="flex items-center gap-4 p-4 rounded-xl bg-slate-50">
                <div className="w-16 h-16 rounded-lg overflow-hidden">
                  <img src={photo.url} alt="" className="w-full h-full object-cover" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    {photo.aiAnalysis?.sharpness && <CheckCircle className="w-4 h-4 text-green-600" />}
                    {photo.aiAnalysis?.lighting && <CheckCircle className="w-4 h-4 text-green-600" />}
                    {photo.aiAnalysis?.visibility && <CheckCircle className="w-4 h-4 text-green-600" />}
                    {photo.aiAnalysis?.composition && <CheckCircle className="w-4 h-4 text-green-600" />}
                  </div>
                  <p className="text-sm text-slate-600">Quality Score: {photo.qualityScore}%</p>
                  {photo.aiAnalysis?.recommendation && (
                    <p className="text-xs text-slate-500 mt-1">{photo.aiAnalysis.recommendation}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Required Photos Checklist */}
      <div className="mt-6 bg-yellow-50 rounded-2xl border border-yellow-200 p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-yellow-600" />
          Required Photos
        </h3>
        <div className="space-y-2">
          {REQUIRED_PHOTOS.map((req) => {
            const hasPhoto = data.photos.some(p => p.category === req.category);
            return (
              <div key={req.label} className="flex items-center gap-3">
                {hasPhoto ? (
                  <CheckCircle className="w-5 h-5 text-green-600" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-yellow-600" />
                )}
                <span className={`text-sm ${hasPhoto ? 'text-green-700' : 'text-yellow-700'}`}>
                  {req.label} {req.required && '(Required)'}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* AI Camera Modal */}
      {isAICameraOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 max-w-2xl w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-slate-900">AI Camera</h3>
              <button
                onClick={() => setIsAICameraOpen(false)}
                className="p-2 rounded-lg hover:bg-slate-100"
              >
                <RefreshCw className="w-5 h-5" />
              </button>
            </div>
            <div className="aspect-video bg-slate-100 rounded-xl flex items-center justify-center mb-4">
              <div className="text-center">
                <Camera className="w-16 h-16 text-slate-400 mx-auto mb-4" />
                <p className="text-slate-600">Camera functionality will be implemented with WebRTC</p>
                <p className="text-slate-500 text-sm mt-2">AI guidance: "Move slightly left for better framing"</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setIsAICameraOpen(false)}
                className="flex-1 px-4 py-3 rounded-xl border border-slate-300 text-slate-700 font-medium hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={() => setIsAICameraOpen(false)}
                className="flex-1 px-4 py-3 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700"
              >
                Capture Photo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Step4Photos;
