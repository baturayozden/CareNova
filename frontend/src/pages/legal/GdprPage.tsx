import React from 'react';
import NavBar from '../../components/landing/NavBar';
import Footer from '../../components/landing/Footer';
import SEOMeta from '../../components/SEOMeta';

export default function GdprPage() {
  return (
    <div className="min-h-screen bg-white">
      <SEOMeta
        title="GDPR & Data Protection | CareNova"
        description="How CareNova meets UK GDPR obligations: data processing, tenant isolation, encryption, and why patient data never trains third-party AI models."
        path="/gdpr"
      />
      <NavBar />
      <main className="pt-24 pb-24">
        <div className="max-w-3xl mx-auto px-6">

          <h1 className="text-3xl font-bold text-gray-900 mb-1">GDPR &amp; Data Protection</h1>
          <p className="text-sm text-gray-500 mb-10">Last updated: 5 May 2026</p>

          <p className="text-gray-700 leading-relaxed mb-8">
            At B4MIND Brand Consulting and Digital Marketing Ltd (operating as "CareNova"), data
            protection is central to how we build and operate our platform. This page explains our approach
            to the UK GDPR and EU GDPR and the commitments we make to clinics ("Customers") and the
            individuals whose data we process.
          </p>

          <h2 className="text-xl font-semibold text-gray-800 mt-10 mb-3">1. Our role</h2>
          <p className="text-gray-700 leading-relaxed mb-3">
            CareNova processes personal data in two capacities:
          </p>
          <ul className="list-disc ml-6 mb-4 space-y-2 text-gray-700 leading-relaxed">
            <li>
              <strong>Processor</strong> — for patient and lead data that clinics manage through the
              platform. The clinic is the controller; CareNova processes this data only on the clinic's
              documented instructions.
            </li>
            <li>
              <strong>Controller</strong> — for clinic user accounts and website visitors (see our{' '}
              <a href="/privacy" className="text-accent underline">Privacy Policy</a>).
            </li>
          </ul>
          <p className="text-gray-700 leading-relaxed mb-4">
            This page focuses on our commitments as a processor to our Customers.
          </p>

          <h2 className="text-xl font-semibold text-gray-800 mt-10 mb-3">2. Data Processing Agreement (DPA)</h2>
          <p className="text-gray-700 leading-relaxed mb-3">
            We can put a Data Processing Agreement in place with Customers as part of our contract; contact us to arrange one.
            Our DPA sets out:
          </p>
          <ul className="list-disc ml-6 mb-4 space-y-1.5 text-gray-700 leading-relaxed">
            <li>The subject matter, duration, nature, and purpose of processing</li>
            <li>The types of personal data and categories of data subjects</li>
            <li>Our obligation to process data only on documented instructions</li>
            <li>Confidentiality commitments from personnel</li>
            <li>Security measures (UK GDPR Art. 32)</li>
            <li>Sub-processor terms and prior notice of changes</li>
            <li>Assistance with data subject requests and breach notification</li>
            <li>Deletion or return of data on termination</li>
            <li>Audit and information rights</li>
          </ul>
          <p className="text-gray-700 leading-relaxed mb-4">
            To arrange a DPA, contact{' '}
            <a href="mailto:info@carenova.ai" className="text-accent underline">info@carenova.ai</a>.
          </p>

          <h2 className="text-xl font-semibold text-gray-800 mt-10 mb-3">3. Lawful basis and consent (important for clinics)</h2>
          <p className="text-gray-700 leading-relaxed mb-3">
            Because CareNova enables outbound WhatsApp messaging — including follow-up to leads who may
            not have initiated contact — clinics are responsible for ensuring a valid lawful basis and,
            where required, valid consent before adding leads or enabling AI follow-up. Our platform
            supports this by:
          </p>
          <ul className="list-disc ml-6 mb-4 space-y-1.5 text-gray-700 leading-relaxed">
            <li>Defaulting AI follow-up to off for manually and bulk-added leads</li>
            <li>Requiring an explicit consent record before AI follow-up can be enabled</li>
            <li>Including an opt-out mechanism in outbound messaging</li>
          </ul>
          <p className="text-gray-700 leading-relaxed mb-4">
            These features support, but do not replace, the clinic's own compliance obligations as controller.
          </p>

          <h2 className="text-xl font-semibold text-gray-800 mt-10 mb-3">4. Special category (health) data</h2>
          <p className="text-gray-700 leading-relaxed mb-4">
            Information about dental treatment may constitute health data, a special category under GDPR.
            Clinics, as controllers, are responsible for ensuring an appropriate Article 9 condition for
            processing such data. CareNova processes it only as processor, under appropriate safeguards.
          </p>

          <h2 className="text-xl font-semibold text-gray-800 mt-10 mb-3">5. Sub-processors</h2>
          <p className="text-gray-700 leading-relaxed mb-3">
            We use vetted sub-processors to deliver the Service (including database, hosting, AI, messaging,
            and email providers — see our{' '}
            <a href="/privacy" className="text-accent underline">Privacy Policy</a> for the current list).
            We:
          </p>
          <ul className="list-disc ml-6 mb-4 space-y-1.5 text-gray-700 leading-relaxed">
            <li>Impose data-protection obligations on each sub-processor by contract</li>
            <li>Maintain a current list available to Customers on request</li>
            <li>Provide prior notice of intended changes, allowing Customers to object</li>
          </ul>

          <h2 className="text-xl font-semibold text-gray-800 mt-10 mb-3">6. International transfers</h2>
          <p className="text-gray-700 leading-relaxed mb-4">
            Where personal data is transferred outside the UK/EEA, we rely on appropriate safeguards (UK
            IDTA, the UK Addendum to the EU SCCs, or an adequacy decision).
          </p>

          <h2 className="text-xl font-semibold text-gray-800 mt-10 mb-3">7. Security measures</h2>
          <p className="text-gray-700 leading-relaxed mb-4">
            Our technical and organisational measures include: encryption of sensitive credentials and
            tokens; encrypted transport (TLS); strict tenant isolation in our multi-tenant architecture;
            role-based access controls; least-privilege access; and secure authentication. We continually
            review and improve these measures.
          </p>

          <h2 className="text-xl font-semibold text-gray-800 mt-10 mb-3">8. Data subject rights</h2>
          <p className="text-gray-700 leading-relaxed mb-4">
            We assist Customers in responding to requests from individuals exercising their rights (access,
            rectification, erasure, restriction, objection, portability). Where an individual contacts us
            directly about data we process on a clinic's behalf, we will refer the request to the relevant
            clinic or act on its instructions.
          </p>

          <h2 className="text-xl font-semibold text-gray-800 mt-10 mb-3">9. Data breach notification</h2>
          <p className="text-gray-700 leading-relaxed mb-4">
            We maintain procedures to detect, investigate, and respond to personal data breaches, and will
            notify affected Customers without undue delay in accordance with our DPA and applicable law.
          </p>

          <h2 className="text-xl font-semibold text-gray-800 mt-10 mb-3">10. Data retention and deletion</h2>
          <p className="text-gray-700 leading-relaxed mb-4">
            Patient/lead data is retained and deleted in accordance with the relevant clinic's instructions.
            On termination, we make Customer Data available for export and then delete it, subject to any
            legal retention requirements.
          </p>

          <h2 className="text-xl font-semibold text-gray-800 mt-10 mb-3">11. Your supervisory authority</h2>
          <p className="text-gray-700 leading-relaxed mb-4">
            Individuals in the UK may contact the Information Commissioner's Office (ICO) at{' '}
            <a href="https://ico.org.uk" target="_blank" rel="noopener noreferrer" className="text-accent underline">
              ico.org.uk
            </a>. We are registered with the ICO under registration number ZB863194.
          </p>

          <h2 className="text-xl font-semibold text-gray-800 mt-10 mb-3">12. Contact</h2>
          <p className="text-gray-700 leading-relaxed mb-1">
            For data-protection enquiries, our DPA, or sub-processor information:
          </p>
          <p className="text-gray-700 leading-relaxed mb-1">B4MIND Brand Consulting and Digital Marketing Ltd (operating as CareNova)</p>
          <p className="text-gray-700 leading-relaxed mb-1">66 Paul Street, London, England, EC2A 4NA</p>
          <p className="text-gray-700 leading-relaxed mb-1">
            General enquiries:{' '}
            <a href="mailto:info@carenova.ai" className="text-accent underline">info@carenova.ai</a>
          </p>
          <p className="text-gray-700 leading-relaxed mb-10">
            Data Protection Officer: Mr Baturay Ozden
          </p>

        </div>
      </main>
      <Footer />
    </div>
  );
}
