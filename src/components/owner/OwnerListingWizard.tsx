import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Home, Building2, Camera, Shield, FileText, CheckCircle, AlertCircle } from 'lucide-react';
import { OwnerListingData, OwnerListingStep1, OwnerListingStep2, OwnerListingStep3, OwnerListingStep4, OwnerListingStep5, OwnerListingStep6, OwnerListingStep7, OwnerListingStep8 } from '../../types';
import Step1PropertyDetails from './listing-steps/Step1PropertyDetails';
import Step2RoomsPricing from './listing-steps/Step2RoomsPricing';
import Step3Amenities from './listing-steps/Step3Amenities';
import Step4Photos from './listing-steps/Step4Photos';
import Step5Rules from './listing-steps/Step5Rules';
import Step6OwnerDetails from './listing-steps/Step6OwnerDetails';
import Step7Verification from './listing-steps/Step7Verification';
import Step8Preview from './listing-steps/Step8Preview';
import Step9Publish from './listing-steps/Step9Publish';

interface OwnerListingWizardProps {
  onComplete?: (listingData: OwnerListingData) => void;
  onCancel?: () => void;
  initialData?: Partial<OwnerListingData>;
}

const OwnerListingWizard: React.FC<OwnerListingWizardProps> = ({ onComplete, onCancel, initialData }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [listingData, setListingData] = useState<OwnerListingData>({
    step1: initialData?.step1 || getEmptyStep1(),
    step2: initialData?.step2 || getEmptyStep2(),
    step3: initialData?.step3 || getEmptyStep3(),
    step4: initialData?.step4 || getEmptyStep4(),
    step5: initialData?.step5 || getEmptyStep5(),
    step6: initialData?.step6 || getEmptyStep6(),
    step7: initialData?.step7 || getEmptyStep7(),
    step8: initialData?.step8 || getEmptyStep8(),
    currentStep: 1,
    listingStatus: 'Draft',
    createdAt: initialData?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  const [stepValidation, setStepValidation] = useState<Record<number, boolean>>({
    1: false,
    2: false,
    3: false,
    4: false,
    5: false,
    6: false,
    7: false,
    8: false,
    9: false,
  });

  const steps = [
    { number: 1, title: 'Property Details', icon: Building2 },
    { number: 2, title: 'Rooms & Pricing', icon: Home },
    { number: 3, title: 'Amenities', icon: Home },
    { number: 4, title: 'Photos', icon: Camera },
    { number: 5, title: 'Rules & Policies', icon: FileText },
    { number: 6, title: 'Owner Details', icon: Building2 },
    { number: 7, title: 'Verification', icon: Shield },
    { number: 8, title: 'Preview', icon: CheckCircle },
    { number: 9, title: 'Publish', icon: CheckCircle },
  ];

  const updateStepData = useCallback((step: number, data: any) => {
    setListingData(prev => ({
      ...prev,
      [`step${step}`]: data,
      updatedAt: new Date().toISOString(),
    }));
  }, []);

  const updateStepValidation = useCallback((step: number, isValid: boolean) => {
    setStepValidation(prev => ({
      ...prev,
      [step]: isValid,
    }));
  }, []);

  const goToNextStep = useCallback(() => {
    if (currentStep < 9 && stepValidation[currentStep]) {
      setCurrentStep(prev => prev + 1);
      setListingData(prev => ({ ...prev, currentStep: prev.currentStep + 1 }));
    }
  }, [currentStep, stepValidation]);

  const goToPreviousStep = useCallback(() => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
      setListingData(prev => ({ ...prev, currentStep: prev.currentStep - 1 }));
    }
  }, [currentStep]);

  const goToStep = useCallback((step: number) => {
    if (step >= 1 && step <= 9) {
      setCurrentStep(step);
      setListingData(prev => ({ ...prev, currentStep: step }));
    }
  }, []);

  const canProceed = stepValidation[currentStep];
  const isLastStep = currentStep === 9;

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <Step1PropertyDetails
            data={listingData.step1}
            onDataChange={(data) => updateStepData(1, data)}
            onValidationChange={(isValid) => updateStepValidation(1, isValid)}
          />
        );
      case 2:
        return (
          <Step2RoomsPricing
            data={listingData.step2}
            onDataChange={(data) => updateStepData(2, data)}
            onValidationChange={(isValid) => updateStepValidation(2, isValid)}
          />
        );
      case 3:
        return (
          <Step3Amenities
            data={listingData.step3}
            onDataChange={(data) => updateStepData(3, data)}
            onValidationChange={(isValid) => updateStepValidation(3, isValid)}
          />
        );
      case 4:
        return (
          <Step4Photos
            data={listingData.step4}
            onDataChange={(data) => updateStepData(4, data)}
            onValidationChange={(isValid) => updateStepValidation(4, isValid)}
          />
        );
      case 5:
        return (
          <Step5Rules
            data={listingData.step5}
            onDataChange={(data) => updateStepData(5, data)}
            onValidationChange={(isValid) => updateStepValidation(5, isValid)}
          />
        );
      case 6:
        return (
          <Step6OwnerDetails
            data={listingData.step6}
            onDataChange={(data) => updateStepData(6, data)}
            onValidationChange={(isValid) => updateStepValidation(6, isValid)}
          />
        );
      case 7:
        return (
          <Step7Verification
            data={listingData.step7}
            onDataChange={(data) => updateStepData(7, data)}
            onValidationChange={(isValid) => updateStepValidation(7, isValid)}
          />
        );
      case 8:
        return (
          <Step8Preview
            data={listingData.step8}
            fullListingData={listingData}
            onDataChange={(data) => updateStepData(8, data)}
            onValidationChange={(isValid) => updateStepValidation(8, isValid)}
            onEditStep={goToStep}
          />
        );
      case 9:
        return (
          <Step9Publish
            listingData={listingData}
            onComplete={onComplete}
            onSaveDraft={() => {
              // Save as draft logic
              console.log('Saving as draft:', listingData);
            }}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50">
      {/* Header */}
      <div className="bg-white border-b border-blue-100 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center">
                <Building2 className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900">List Your Property</h1>
                <p className="text-sm text-slate-600">Step {currentStep} of 9</p>
              </div>
            </div>
            {onCancel && (
              <button
                onClick={onCancel}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
              >
                Cancel
              </button>
            )}
          </div>

          {/* Progress Steps */}
          <div className="mt-6 flex items-center justify-between overflow-x-auto pb-2">
            {steps.map((step, index) => {
              const StepIcon = step.icon;
              const isActive = currentStep === step.number;
              const isCompleted = currentStep > step.number;
              const isValid = stepValidation[step.number];

              return (
                <div
                  key={step.number}
                  className="flex items-center gap-2 flex-shrink-0 cursor-pointer"
                  onClick={() => isCompleted && goToStep(step.number)}
                >
                  <div
                    className={`flex items-center justify-center w-8 h-8 rounded-full border-2 transition-all ${
                      isActive
                        ? 'border-blue-600 bg-blue-600 text-white'
                        : isCompleted
                        ? 'border-green-500 bg-green-500 text-white'
                        : 'border-slate-300 bg-white text-slate-400'
                    }`}
                  >
                    {isCompleted ? (
                      <CheckCircle className="w-4 h-4" />
                    ) : (
                      <StepIcon className="w-4 h-4" />
                    )}
                  </div>
                  <div className="hidden sm:block">
                    <p
                      className={`text-xs font-medium ${
                        isActive ? 'text-blue-600' : isCompleted ? 'text-green-600' : 'text-slate-500'
                      }`}
                    >
                      {step.title}
                    </p>
                    {isValid && isCompleted && (
                      <div className="flex items-center gap-1 mt-0.5">
                        <CheckCircle className="w-3 h-3 text-green-500" />
                        <span className="text-[10px] text-green-600">Complete</span>
                      </div>
                    )}
                  </div>
                  {index < steps.length - 1 && (
                    <div className="w-8 h-0.5 bg-slate-200 mx-2 hidden sm:block" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Step Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            {renderStep()}
          </motion.div>
        </AnimatePresence>

        {/* Navigation Buttons */}
        {currentStep < 9 && (
          <div className="mt-8 flex items-center justify-between border-t border-slate-200 pt-6">
            <button
              onClick={goToPreviousStep}
              disabled={currentStep === 1}
              className="flex items-center gap-2 px-6 py-3 rounded-xl border border-slate-300 text-slate-700 font-medium hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              <ChevronLeft className="w-5 h-5" />
              Back
            </button>

            <button
              onClick={goToNextStep}
              disabled={!canProceed}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all ${
                canProceed
                  ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-200'
                  : 'bg-slate-300 text-slate-500 cursor-not-allowed'
              }`}
            >
              {isLastStep ? 'Publish' : 'Next'}
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// Helper functions to create empty step data
function getEmptyStep1(): OwnerListingStep1 {
  return {
    propertyName: '',
    city: '',
    genderOccupancy: 'Unisex / Co-ed',
    locality: '',
    propertyType: 'PG',
    propertyDescription: '',
    fullAddress: '',
    pincode: '',
    nearbyLandmark: '',
  };
}

function getEmptyStep2(): OwnerListingStep2 {
  return { rooms: [] };
}

function getEmptyStep3(): OwnerListingStep3 {
  return {
    roomAmenities: [],
    propertyAmenities: [],
    foodAvailable: false,
    foodOptions: [],
    otherServices: [],
  };
}

function getEmptyStep4(): OwnerListingStep4 {
  return { photos: [] };
}

function getEmptyStep5(): OwnerListingStep5 {
  return {
    checkInTime: '10:00 AM',
    curfewTime: '11:00 PM',
    smokingAllowed: false,
    alcoholAllowed: false,
    visitorsAllowed: 'Allowed',
    petsAllowed: false,
    cookingAllowed: false,
    additionalRules: '',
    minimumStay: '1 Month',
    noticePeriod: '30 Days',
  };
}

function getEmptyStep6(): OwnerListingStep6 {
  return {
    fullName: '',
    mobileNumber: '',
    whatsappNumber: '',
    emailAddress: '',
    role: 'Property Owner',
    preferredContact: 'Phone',
  };
}

function getEmptyStep7(): OwnerListingStep7 {
  return {
    governmentId: {} as any,
    ownershipProof: {} as any,
    propertyDocuments: [],
    verificationStatus: 'Pending',
  };
}

function getEmptyStep8(): OwnerListingStep8 {
  return {
    qualityScore: {
      overall: 0,
      details: {
        propertyDetails: 0,
        photos: 0,
        amenities: 0,
        pricing: 0,
        location: 0,
      },
      missingItems: [],
    },
    previewData: null,
  };
}

export default OwnerListingWizard;