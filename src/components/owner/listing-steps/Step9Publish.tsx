import React, { useState } from 'react';
import { CheckCircle, Rocket, Save, Eye, ExternalLink, RefreshCw } from 'lucide-react';
import { OwnerListingData } from '../../../types';

interface Step9PublishProps {
  listingData: OwnerListingData;
  onComplete?: (listingData: OwnerListingData) => void;
  onSaveDraft?: () => void;
}

const Step9Publish: React.FC<Step9PublishProps> = ({ listingData, onComplete, onSaveDraft }) => {
  const [isPublishing, setIsPublishing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [published, setPublished] = useState(false);
  const [listingId, setListingId] = useState('');

  const checklistItems = [
    { label: 'Property Details', completed: !!listingData.step1.propertyName },
    { label: 'Location', completed: !!listingData.step1.fullAddress },
    { label: 'Rooms & Pricing', completed: listingData.step2.rooms.length > 0 },
    { label: 'Amenities', completed: listingData.step3.propertyAmenities.some(a => a.selected) },
    { label: 'Photos', completed: listingData.step4.photos.length > 0 },
    { label: 'Rules & Policies', completed: !!listingData.step5.checkInTime },
    { label: 'Owner Details', completed: !!listingData.step6.fullName },
    { label: 'Verification Documents', completed: !!listingData.step7.governmentId.documentUrl },
  ];

  const allComplete = checklistItems.every(item => item.completed);

  const handlePublish = async () => {
    if (!allComplete) return;

    setIsPublishing(true);

    // Simulate API call
    setTimeout(() => {
      const newListingId = `PGW-${Date.now().toString().slice(-5)}`;
      setListingId(newListingId);
      setPublished(true);
      setIsPublishing(false);

      if (onComplete) {
        onComplete({
          ...listingData,
          listingId: newListingId,
          listingStatus: 'Published',
        });
      }
    }, 2000);
  };

  const handleSaveDraft = async () => {
    setIsSaving(true);

    // Simulate API call
    setTimeout(() => {
      setIsSaving(false);
      if (onSaveDraft) {
        onSaveDraft();
      }
    }, 1000);
  };

  if (published) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-2xl border border-green-200 p-8 shadow-sm text-center">
          <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-green-600" />
          </div>
          <h2 className="text-3xl font-bold text-slate-900 mb-2">Property Published Successfully!</h2>
          <p className="text-slate-600 mb-6">Your PG is now live on PGWALO and visible to potential residents.</p>

          <div className="bg-slate-50 rounded-xl p-4 mb-6 inline-block">
            <p className="text-sm text-slate-600 mb-1">Listing ID</p>
            <p className="text-2xl font-bold text-blue-600">{listingId}</p>
          </div>

          <div className="flex justify-center gap-4">
            <button className="flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors">
              <Eye className="w-5 h-5" />
              View Listing
            </button>
            <button className="flex items-center gap-2 px-6 py-3 rounded-xl border border-slate-300 text-slate-700 font-medium hover:bg-slate-50 transition-colors">
              <ExternalLink className="w-5 h-5" />
              Manage Property
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-slate-900 mb-2">Publish Your Property</h2>
        <p className="text-slate-600">Review your listing and publish it to start receiving inquiries.</p>
      </div>

      <div className="space-y-6">
        {/* Final Checklist */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <h3 className="text-xl font-semibold text-slate-900 mb-4">Final Checklist</h3>
          <div className="space-y-3">
            {checklistItems.map((item, index) => (
              <div key={index} className="flex items-center gap-3">
                {item.completed ? (
                  <CheckCircle className="w-5 h-5 text-green-600" />
                ) : (
                  <div className="w-5 h-5 rounded-full border-2 border-slate-300" />
                )}
                <span className={`text-sm ${item.completed ? 'text-slate-900' : 'text-slate-500'}`}>
                  {item.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Quality Score */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-semibold text-slate-900">Listing Quality Score</h3>
            <div className="text-right">
              <p className="text-3xl font-bold text-blue-600">{listingData.step8.qualityScore.overall}</p>
              <p className="text-sm text-slate-600">out of 100</p>
            </div>
          </div>
          <div className="w-full bg-slate-200 rounded-full h-3">
            <div
              className={`h-3 rounded-full transition-all ${
                listingData.step8.qualityScore.overall >= 80 ? 'bg-green-500' :
                listingData.step8.qualityScore.overall >= 60 ? 'bg-yellow-500' :
                'bg-red-500'
              }`}
              style={{ width: `${listingData.step8.qualityScore.overall}%` }}
            />
          </div>
        </div>

        {/* Final Confirmation */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl p-6 text-white shadow-lg">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
              <Rocket className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-bold">Your Listing Is Ready</h3>
              <p className="text-blue-100">Your property is ready to go live on PGWALO</p>
            </div>
          </div>

          {!allComplete && (
            <div className="bg-white/10 rounded-xl p-4 mb-4">
              <p className="text-sm text-blue-100">
                <strong>Note:</strong> Some required information is missing. Please complete all checklist items before publishing.
              </p>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={handleSaveDraft}
              disabled={isSaving}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-white/20 text-white font-medium hover:bg-white/30 transition-colors disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  Save as Draft
                </>
              )}
            </button>
            <button
              onClick={handlePublish}
              disabled={!allComplete || isPublishing}
              className={`flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-medium transition-all ${
                allComplete
                  ? 'bg-white text-blue-600 hover:bg-blue-50'
                  : 'bg-white/30 text-white/70 cursor-not-allowed'
              } disabled:opacity-50`}
            >
              {isPublishing ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  Publishing...
                </>
              ) : (
                <>
                  <Rocket className="w-5 h-5" />
                  Publish My Property
                </>
              )}
            </button>
          </div>
        </div>

        {/* What Happens Next */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <h3 className="text-xl font-semibold text-slate-900 mb-4">What Happens Next?</h3>
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                <span className="text-blue-600 font-bold text-sm">1</span>
              </div>
              <div>
                <p className="font-medium text-slate-900">Listing Review</p>
                <p className="text-sm text-slate-600">Our team will review your listing within 24-48 hours</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                <span className="text-blue-600 font-bold text-sm">2</span>
              </div>
              <div>
                <p className="font-medium text-slate-900">Go Live</p>
                <p className="text-sm text-slate-600">Once approved, your listing will be visible to thousands of residents</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                <span className="text-blue-600 font-bold text-sm">3</span>
              </div>
              <div>
                <p className="font-medium text-slate-900">Start Receiving Inquiries</p>
                <p className="text-sm text-slate-600">Residents can contact you directly through the platform</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Step9Publish;