import React, { useState, useEffect } from 'react';
import { Upload, Shield, CheckCircle, AlertCircle, FileText, Lock } from 'lucide-react';
import { OwnerListingStep7, VerificationDocument, VerificationStatus } from '../../../types';

interface Step7VerificationProps {
  data: OwnerListingStep7;
  onDataChange: (data: OwnerListingStep7) => void;
  onValidationChange: (isValid: boolean) => void;
}

const DOCUMENT_TYPES = ['Aadhaar', 'PAN', 'Passport', 'Other'];

const Step7Verification: React.FC<Step7VerificationProps> = ({ data, onDataChange, onValidationChange }) => {
  const [uploading, setUploading] = useState<string | null>(null);

  const validate = () => {
    const isValid = !!data.governmentId.documentUrl && !!data.ownershipProof.documentUrl;
    onValidationChange(isValid);
    return isValid;
  };

  useEffect(() => {
    validate();
  }, [data]);

  const handleDocumentUpload = (
    docType: 'governmentId' | 'ownershipProof' | 'propertyDocuments',
    index?: number,
    file?: File
  ) => {
    if (!file) return;

    setUploading(docType);

    // Simulate upload
    setTimeout(() => {
      const newDocument: VerificationDocument = {
        id: `doc-${Date.now()}-${Math.random()}`,
        documentType: docType === 'governmentId' ? 'Aadhaar' : 'Ownership Proof',
        documentUrl: URL.createObjectURL(file),
        uploadDate: new Date().toISOString(),
        status: 'Under Review',
      };

      if (docType === 'propertyDocuments' && typeof index === 'number') {
        const updatedDocs = [...data.propertyDocuments];
        updatedDocs[index] = newDocument;
        onDataChange({ ...data, propertyDocuments: updatedDocs });
      } else {
        onDataChange({ ...data, [docType]: newDocument });
      }

      setUploading(null);
    }, 1500);
  };

  const addPropertyDocument = () => {
    const newDoc: VerificationDocument = {
      id: `doc-${Date.now()}-${Math.random()}`,
      documentType: 'Property Document',
      documentUrl: '',
      uploadDate: new Date().toISOString(),
      status: 'Pending',
    };
    onDataChange({ ...data, propertyDocuments: [...data.propertyDocuments, newDoc] });
  };

  const removePropertyDocument = (index: number) => {
    const updatedDocs = data.propertyDocuments.filter((_, i) => i !== index);
    onDataChange({ ...data, propertyDocuments: updatedDocs });
  };

  const getStatusIcon = (status: VerificationStatus) => {
    switch (status) {
      case 'Verified':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'Under Review':
        return <AlertCircle className="w-5 h-5 text-yellow-600" />;
      case 'Rejected':
        return <AlertCircle className="w-5 h-5 text-red-600" />;
      default:
        return <AlertCircle className="w-5 h-5 text-slate-400" />;
    }
  };

  const DocumentUploadCard = ({
    title,
    description,
    document,
    docType,
    onUpload,
  }: {
    title: string;
    description: string;
    document: VerificationDocument;
    docType: 'governmentId' | 'ownershipProof';
    onUpload: (file: File) => void;
  }) => (
    <div className="border border-slate-200 rounded-xl p-6 bg-slate-50">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
            <FileText className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h4 className="font-semibold text-slate-900">{title}</h4>
            <p className="text-sm text-slate-600">{description}</p>
          </div>
        </div>
        {document.status && getStatusIcon(document.status)}
      </div>

      {document.documentUrl ? (
        <div className="bg-white rounded-lg p-4 border border-slate-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileText className="w-5 h-5 text-slate-400" />
              <div>
                <p className="text-sm font-medium text-slate-900">Document Uploaded</p>
                <p className="text-xs text-slate-500">{new Date(document.uploadDate).toLocaleDateString()}</p>
              </div>
            </div>
            <span className={`text-xs px-2 py-1 rounded-full ${
              document.status === 'Verified' ? 'bg-green-100 text-green-700' :
              document.status === 'Under Review' ? 'bg-yellow-100 text-yellow-700' :
              document.status === 'Rejected' ? 'bg-red-100 text-red-700' :
              'bg-slate-100 text-slate-700'
            }`}>
              {document.status}
            </span>
          </div>
        </div>
      ) : (
        <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center">
          <input
            type="file"
            accept="image/*,.pdf"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onUpload(file);
            }}
            className="hidden"
            id={`upload-${docType}`}
          />
          <label
            htmlFor={`upload-${docType}`}
            className="cursor-pointer"
          >
            <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
            <p className="text-sm text-slate-600 font-medium">Click to upload</p>
            <p className="text-xs text-slate-500 mt-1">PNG, JPG, PDF up to 5MB</p>
          </label>
        </div>
      )}

      {uploading === docType && (
        <div className="mt-3 flex items-center gap-2 text-sm text-blue-600">
          <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          Uploading...
        </div>
      )}
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-slate-900 mb-2">Property Verification</h2>
        <p className="text-slate-600">Upload documents to verify your property ownership and authorization.</p>
      </div>

      <div className="space-y-6">
        {/* Government ID */}
        <DocumentUploadCard
          title="Government ID"
          description="Upload your Aadhaar, PAN, or Passport for identity verification"
          document={data.governmentId}
          docType="governmentId"
          onUpload={(file) => handleDocumentUpload('governmentId', undefined, file)}
        />

        {/* Ownership Proof */}
        <DocumentUploadCard
          title="Ownership / Authorization Proof"
          description="Upload property ownership document or authorization letter"
          document={data.ownershipProof}
          docType="ownershipProof"
          onUpload={(file) => handleDocumentUpload('ownershipProof', undefined, file)}
        />

        {/* Property Documents */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <FileText className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h4 className="font-semibold text-slate-900">Property Documents</h4>
                <p className="text-sm text-slate-600">Additional property documents (optional)</p>
              </div>
            </div>
            <button
              onClick={addPropertyDocument}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-300 text-slate-700 font-medium hover:bg-slate-50 transition-colors"
            >
              <Upload className="w-4 h-4" />
              Add Document
            </button>
          </div>

          <div className="space-y-3">
            {data.propertyDocuments.map((doc, index) => (
              <div key={doc.id} className="border border-slate-200 rounded-lg p-4 bg-slate-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FileText className="w-5 h-5 text-slate-400" />
                    <div>
                      <p className="text-sm font-medium text-slate-900">Property Document {index + 1}</p>
                      {doc.uploadDate && (
                        <p className="text-xs text-slate-500">{new Date(doc.uploadDate).toLocaleDateString()}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {doc.status && getStatusIcon(doc.status)}
                    <button
                      onClick={() => removePropertyDocument(index)}
                      className="p-2 rounded-lg hover:bg-red-50 text-red-600 transition-colors"
                    >
                      <AlertCircle className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {!doc.documentUrl && (
                  <div className="mt-3">
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleDocumentUpload('propertyDocuments', index, file);
                      }}
                      className="hidden"
                      id={`upload-prop-${index}`}
                    />
                    <label
                      htmlFor={`upload-prop-${index}`}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-300 text-slate-700 font-medium hover:bg-slate-100 cursor-pointer transition-colors"
                    >
                      <Upload className="w-4 h-4" />
                      Upload Document
                    </label>
                  </div>
                )}
              </div>
            ))}

            {data.propertyDocuments.length === 0 && (
              <div className="text-center py-8 text-slate-500">
                <FileText className="w-12 h-12 mx-auto mb-2 text-slate-300" />
                <p className="text-sm">No additional documents added</p>
              </div>
            )}
          </div>
        </div>

        {/* Privacy Notice */}
        <div className="bg-blue-50 rounded-2xl border border-blue-200 p-6">
          <div className="flex items-start gap-3">
            <Lock className="w-5 h-5 text-blue-600 mt-0.5" />
            <div>
              <h4 className="font-semibold text-blue-900 mb-1">Privacy Notice</h4>
              <p className="text-sm text-blue-800">
                Your documents are securely stored and used only for property verification. They will not be displayed publicly on your listing. PGWALO follows strict data protection policies.
              </p>
            </div>
          </div>
        </div>

        {/* Verification Status */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Shield className="w-5 h-5 text-blue-600" />
            Verification Status
          </h3>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-3 h-3 rounded-full bg-slate-300" />
                <span className="text-sm text-slate-600">Documents Uploaded</span>
              </div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-3 h-3 rounded-full bg-yellow-400" />
                <span className="text-sm text-slate-600">Under Review</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <span className="text-sm text-slate-600">Verified</span>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-slate-600">Current Status</p>
              <p className="text-lg font-semibold text-yellow-600">Under Review</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Step7Verification;