export type LegalSection = { heading: string; body: string };

export type LegalPolicy = {
  id: 'privacy' | 'terms' | 'refunds' | 'guidelines';
  title: string;
  summary: string;
  sections: LegalSection[];
};

export const legalStatus = {
  label: 'Launch review required',
  notice: 'Prepared from the India launch draft. Operator identity, grievance contact, effective dates, state-specific terms and final counsel approval must be completed before this is treated as a final legal notice.',
  version: '0.1 draft',
  lastUpdated: '25 September 2026',
};

export const legalPolicies: LegalPolicy[] = [
  {
    id: 'privacy',
    title: 'Privacy Policy',
    summary: 'How PGWALO collects, uses, shares, protects and deletes personal information.',
    sections: [
      { heading: 'Scope and role', body: 'PGWALO is a technology platform for discovering and managing paying guest and co-living accommodation. The property owner remains responsible for the accommodation relationship and for information they collect directly from residents. This notice covers information processed by PGWALO through its website, application, support channels and platform workflows.' },
      { heading: 'Information we may collect', body: 'Depending on the feature used, this may include account and contact details, resident preferences, owner and property details, identity or KYC documents when a lawful and necessary verification is requested, enquiries and stay information, support and safety reports, device and technical information, and cookie or analytics data.' },
      { heading: 'Why we use it', body: 'We use information to create accounts, show relevant listings, connect residents and owners, support enquiries and visits, operate subscriptions, prevent abuse, improve reliability, respond to safety issues, meet legal obligations and communicate service updates. A platform check does not replace the resident\'s own due diligence.' },
      { heading: 'Sharing and safeguards', body: 'Information may be shared with the owner or resident involved in a requested transaction, service providers needed to operate the platform, payment or communications providers, professional advisers, regulators or law enforcement where legally required, and a successor in a legitimate business transfer. We apply access controls and reasonable security measures. Specific encryption, vendor, data-location or cross-border claims must be verified before publication.' },
      { heading: 'Identity documents and Aadhaar', body: 'PGWALO should request an identity document only where the purpose is lawful, necessary and clearly explained. Aadhaar should not be required where a lawful alternative is reasonably available. Users should avoid sending identity documents through public chat or unapproved channels.' },
      { heading: 'Retention and user requests', body: 'We retain information only as long as needed for the stated purpose, a contract, dispute handling, security, accounting or another lawful requirement. Subject to applicable law and verification, users may ask for access, correction, deletion, withdrawal of optional consent or information about a grievance route by contacting support@pgwalo.com. Final retention periods and the designated grievance contact must be published before launch.' },
    ],
  },
  {
    id: 'terms',
    title: 'Terms of Use',
    summary: 'The rules for using PGWALO as a property discovery and management platform.',
    sections: [
      { heading: 'Platform role', body: 'PGWALO provides software and marketplace tools. Unless a separate written agreement says otherwise, PGWALO is not the landlord, property owner, accommodation provider, broker, employer or guarantor of any resident or owner. A listing, enquiry or visit request is not a confirmed booking or a promise that a room will be available.' },
      { heading: 'Accounts and accurate information', body: 'Users must be at least 18 years old, provide accurate information, protect their login details and promptly correct material changes. Owners must have authority to list the property. Users must not impersonate another person, upload misleading content, scrape the service, bypass security or use the platform for unlawful discrimination, harassment, fraud or abuse.' },
      { heading: 'Listings, visits and agreements', body: 'Owners are responsible for listing accuracy, availability, charges, house rules, safety disclosures and the legal right to offer the accommodation. Residents should inspect the property, confirm all commercial terms, verify the counterparty and sign the applicable owner-resident agreement before moving in. Stamp duty, registration, police verification and other local requirements depend on the applicable state and arrangement.' },
      { heading: 'Payments and subscriptions', body: 'Unless the checkout screen or a written agreement expressly states otherwise, rent, deposits, utilities and resident refunds are paid directly between owner and resident and are not held by PGWALO. Owner subscription or listing-plan charges are governed by the plan shown at purchase and the Refund Policy. Taxes, invoices and payment-provider rules apply where relevant.' },
      { heading: 'Suspension and complaints', body: 'PGWALO may restrict, suspend or remove an account or listing when there is a security, safety, legal, payment, verification or policy concern. Users can report misleading listings, unsafe conditions, privacy concerns or misconduct to support@pgwalo.com. Emergency situations should be reported to local emergency services first.' },
      { heading: 'Limits and governing law', body: 'To the extent allowed by law, each party is responsible for its own acts, representations and agreements. Nothing here removes non-waivable consumer or statutory rights. The final operator identity, jurisdiction, dispute route and state-specific terms must be completed after Indian legal review.' },
    ],
  },
  {
    id: 'refunds',
    title: 'Refund and Cancellation Policy',
    summary: 'How cancellations, owner plans and direct resident payments are handled.',
    sections: [
      { heading: 'Owner plans', body: 'Cancellation and refund eligibility for an owner subscription or listing plan depends on the plan, purchase screen, invoice and applicable law. The final plan-specific terms must be displayed before payment. Where a refund is approved, it is normally returned through the original payment method subject to the payment provider and applicable banking timelines.' },
      { heading: 'Resident rent and deposits', body: 'Unless PGWALO expressly receives the payment under a separate product, rent, security deposits, utilities, deductions and resident refunds are direct owner-resident transactions. The resident agreement must state notice, lock-in, deposit adjustment, inspection, checkout and refund terms. PGWALO does not promise a universal seven-day deposit settlement or a verified-bank-account payout.' },
      { heading: 'Duplicate or failed payments', body: 'Report a duplicate, failed or unauthorised platform payment promptly with the transaction reference. We will investigate with the payment provider and communicate the outcome. Users should not share a one-time password, card PIN or full banking credentials with support or another user.' },
      { heading: 'How to request help', body: 'Email support@pgwalo.com with the account email, transaction reference, amount, date and a short description. Do not include a full card number or identity document unless specifically requested through an approved secure flow.' },
    ],
  },
  {
    id: 'guidelines',
    title: 'House and Safety Guidelines',
    summary: 'Baseline conduct and safety expectations for owners, residents and visitors.',
    sections: [
      { heading: 'Owner responsibilities', body: 'Keep listing information, pricing, occupancy, amenities, restrictions and emergency contacts accurate. Maintain lawful occupancy, basic habitability, fire and electrical safety, sanitation and access arrangements required for the property. Disclose material hazards and respond to maintenance or safety reports without retaliation.' },
      { heading: 'Resident responsibilities', body: 'Follow the signed agreement and reasonable house rules, pay agreed charges, protect shared spaces, respect neighbours and other residents, report hazards promptly and do not create a fire, security, harassment, substance or nuisance risk. House rules must be disclosed before acceptance and cannot override applicable law.' },
      { heading: 'Privacy and surveillance', body: 'Hidden cameras, recording in bedrooms, bathrooms or other private areas, intimidation and unauthorised access are prohibited. Any lawful CCTV, access-control or visitor process should be disclosed, limited to a legitimate purpose and operated in accordance with applicable privacy and safety requirements.' },
      { heading: 'Reporting and emergencies', body: 'For immediate danger, contact local emergency services. For platform-related safety or conduct concerns, contact support@pgwalo.com with the property, date, people involved and any safe-to-share evidence. PGWALO may preserve records, restrict access or refer serious matters to the appropriate authority.' },
    ],
  },
];
