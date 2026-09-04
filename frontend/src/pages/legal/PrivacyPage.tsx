import React from 'react';
import NavBar from '../../components/landing/NavBar';
import Footer from '../../components/landing/Footer';
import SEOMeta from '../../components/SEOMeta';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white">
      <SEOMeta
        title="Privacy Policy | CareNova"
        description="How CareNova collects, stores and processes personal data. UK GDPR compliant and ICO-registered."
        path="/privacy"
      />
      <NavBar />
      <main className="pt-24 pb-24">
        <div className="max-w-3xl mx-auto px-6">

          <h1 className="text-3xl font-bold text-gray-900 mb-1">Privacy Policy</h1>
          <p className="text-sm text-gray-500 mb-10">Last updated: 5 May 2026</p>

          <p className="text-gray-700 leading-relaxed mb-4">
            This Privacy Policy explains how B4MIND Brand Consulting and Digital Marketing Ltd ("CareNova",
            "we", "us", "our"), which operates the CareNova platform, collects, uses, and protects personal
            data in connection with the CareNova platform and website at carenova.ai (the "Service").
          </p>
          <p className="text-gray-700 leading-relaxed mb-4">
            We are a company registered in England and Wales (company number 11296210), with our registered
            office at 66 Paul Street, London, England, EC2A 4NA. We are registered with the UK Information
            Commissioner's Office (ICO) under registration number ZB863194.
          </p>
          <p className="text-gray-700 leading-relaxed mb-8">
            If you have any questions about this policy or your personal data, contact us at{' '}
            <a href="mailto:info@carenova.ai" className="text-gold underline">info@carenova.ai</a>.
            For data-protection matters you may also contact our Data Protection Officer, Mr Baturay Ozden.
          </p>

          <h2 className="text-xl font-semibold text-gray-800 mt-10 mb-3">1. Our two roles: controller and processor</h2>
          <p className="text-gray-700 leading-relaxed mb-3">
            CareNova processes personal data in two distinct capacities:
          </p>
          <ul className="list-disc ml-6 mb-4 space-y-2 text-gray-700 leading-relaxed">
            <li>
              <strong>As a data controller</strong> — for personal data of the clinic staff and administrators
              who hold CareNova user accounts (e.g. name, email, role), and for visitors to our website.
              We decide how and why this data is processed.
            </li>
            <li>
              <strong>As a data processor</strong> — for personal data of patients and prospective patients
              ("leads") that a dental clinic ("Customer") uploads to, or generates within, the platform
              (e.g. names, phone numbers, treatment interests, WhatsApp conversation content). Here, the
              clinic is the data controller and CareNova processes this data only on the clinic's documented
              instructions, under a Data Processing Agreement (see our GDPR page).
            </li>
          </ul>
          <p className="text-gray-700 leading-relaxed mb-4">
            This Privacy Policy primarily describes our processing as a controller. For data we process on
            behalf of clinics, the relevant clinic's own privacy notice and our Data Processing Agreement
            govern that processing.
          </p>

          <h2 className="text-xl font-semibold text-gray-800 mt-10 mb-3">2. Personal data we collect</h2>

          <h3 className="text-base font-semibold text-gray-700 mt-6 mb-2">Clinic users (controller):</h3>
          <ul className="list-disc ml-6 mb-4 space-y-1.5 text-gray-700 leading-relaxed">
            <li><strong>Identity and contact data:</strong> name, work email, telephone, job role</li>
            <li><strong>Account data:</strong> login credentials (passwords are stored hashed), authentication tokens</li>
            <li><strong>Usage data:</strong> log-in times, actions taken in the platform, IP address, device/browser information</li>
          </ul>

          <h3 className="text-base font-semibold text-gray-700 mt-6 mb-2">Website visitors (controller):</h3>
          <ul className="list-disc ml-6 mb-4 space-y-1.5 text-gray-700 leading-relaxed">
            <li>Information you provide via contact or demo-request forms (name, email, clinic name, message)</li>
            <li>Technical data: IP address, browser type, and similar collected via essential cookies (see our Cookie Policy)</li>
          </ul>

          <h3 className="text-base font-semibold text-gray-700 mt-6 mb-2">Patient/lead data (processor, on behalf of clinics):</h3>
          <ul className="list-disc ml-6 mb-4 space-y-1.5 text-gray-700 leading-relaxed">
            <li>Names, telephone numbers, preferred language, treatment interest, lead status</li>
            <li>WhatsApp message content exchanged between the lead and the clinic's AI coordinator</li>
            <li>Consent records relating to AI follow-up and messaging</li>
          </ul>
          <p className="text-gray-700 leading-relaxed mb-4">
            <strong>Special category data:</strong> Information relating to a person's dental treatment may, in
            some contexts, constitute health-related data (a "special category" under UK GDPR). Where clinics
            input such data, they act as controller and are responsible for ensuring an appropriate lawful basis
            and condition for processing. CareNova processes it solely as processor on the clinic's instructions.
          </p>

          <h2 className="text-xl font-semibold text-gray-800 mt-10 mb-3">3. How and why we use personal data (controller)</h2>
          <div className="overflow-x-auto mb-6">
            <table className="w-full text-sm border-collapse border border-gray-200 rounded-lg overflow-hidden">
              <thead>
                <tr className="bg-gray-50">
                  <th className="text-left px-4 py-3 font-semibold text-gray-800 border-b border-gray-200 w-3/5">Purpose</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-800 border-b border-gray-200">Lawful basis (UK GDPR Art. 6)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {[
                  ['Providing and maintaining your CareNova account', 'Performance of a contract'],
                  ['Authenticating users and securing the platform', 'Legitimate interests (security)'],
                  ['Responding to demo requests and enquiries', 'Legitimate interests / steps prior to a contract'],
                  ['Sending service and account communications', 'Performance of a contract'],
                  ['Sending marketing about CareNova (to business contacts)', 'Legitimate interests / consent where required'],
                  ['Improving and developing the Service', 'Legitimate interests'],
                  ['Complying with legal obligations', 'Legal obligation'],
                ].map(([purpose, basis]) => (
                  <tr key={purpose} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-gray-700 align-top">{purpose}</td>
                    <td className="px-4 py-3 text-gray-700 align-top">{basis}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-gray-700 leading-relaxed mb-4">
            You can object to processing based on legitimate interests, and withdraw consent at any time where
            consent is the basis.
          </p>

          <h2 className="text-xl font-semibold text-gray-800 mt-10 mb-3">4. Artificial intelligence processing</h2>
          <p className="text-gray-700 leading-relaxed mb-4">
            The Service uses AI (provided by Anthropic) to generate and assist with messaging to leads. AI
            processing is performed to deliver the core functionality clinics subscribe to. Message content
            may be transmitted to our AI sub-processor solely to generate responses. We do not use clinic or
            patient data to train third-party AI models, and our AI sub-processor processes data under
            contractual confidentiality and data-protection terms.
          </p>

          <h2 className="text-xl font-semibold text-gray-800 mt-10 mb-3">5. Sub-processors and third parties</h2>
          <p className="text-gray-700 leading-relaxed mb-3">
            We use carefully selected third parties to operate the Service. Current sub-processors include:
          </p>
          <ul className="list-disc ml-6 mb-4 space-y-1.5 text-gray-700 leading-relaxed">
            <li><strong>Supabase</strong> — database hosting (EU/Ireland)</li>
            <li><strong>Render</strong> — application/backend hosting</li>
            <li><strong>Vercel</strong> — frontend hosting</li>
            <li><strong>Anthropic</strong> — AI message generation</li>
            <li><strong>Meta Platforms (WhatsApp Business Platform)</strong> — messaging delivery</li>
            <li><strong>Resend</strong> — transactional email</li>
            <li><strong>Google (Calendar API)</strong> — calendar integration, where enabled by a clinic</li>
          </ul>
          <p className="text-gray-700 leading-relaxed mb-4">
            A current list of sub-processors is maintained and available on request. We require all
            sub-processors to provide appropriate safeguards for personal data.
          </p>

          <h2 className="text-xl font-semibold text-gray-800 mt-10 mb-3">6. International transfers</h2>
          <p className="text-gray-700 leading-relaxed mb-4">
            Where personal data is transferred outside the UK/EEA, we rely on appropriate safeguards such as
            the UK International Data Transfer Agreement (IDTA), the UK Addendum to the EU Standard
            Contractual Clauses, or an adequacy decision. Details are available on request.
          </p>

          <h2 className="text-xl font-semibold text-gray-800 mt-10 mb-3">7. Data retention</h2>
          <p className="text-gray-700 leading-relaxed mb-4">
            We retain personal data only as long as necessary for the purposes described, or as required by
            law. Clinic account data is retained for the duration of the subscription and a limited period
            afterwards. Patient/lead data is retained according to the instructions of the relevant clinic
            (controller) and is deleted or returned on termination, subject to legal retention requirements.
          </p>

          <h2 className="text-xl font-semibold text-gray-800 mt-10 mb-3">8. Your rights</h2>
          <p className="text-gray-700 leading-relaxed mb-4">
            Under UK GDPR, you have the right to: access your data; request rectification or erasure;
            restrict or object to processing; data portability; and to withdraw consent. You also have the
            right to lodge a complaint with the ICO (
            <a href="https://ico.org.uk" target="_blank" rel="noopener noreferrer" className="text-gold underline">ico.org.uk</a>
            ).
          </p>
          <p className="text-gray-700 leading-relaxed mb-4">
            To exercise any right, contact{' '}
            <a href="mailto:info@carenova.ai" className="text-gold underline">info@carenova.ai</a>.
            If your request concerns data we process on behalf of a clinic (as processor), we will refer
            you to, or act on the instructions of, that clinic.
          </p>

          <h2 className="text-xl font-semibold text-gray-800 mt-10 mb-3">9. Security</h2>
          <p className="text-gray-700 leading-relaxed mb-4">
            We implement appropriate technical and organisational measures, including encryption of sensitive
            tokens, encrypted transport (TLS), access controls, tenant isolation, and the principle of least
            privilege. No system is completely secure, and we cannot guarantee absolute security.
          </p>

          <h2 className="text-xl font-semibold text-gray-800 mt-10 mb-3">10. Changes to this policy</h2>
          <p className="text-gray-700 leading-relaxed mb-4">
            We may update this policy from time to time. Material changes will be notified through the
            Service or by email. The "Last updated" date reflects the latest version.
          </p>

          <h2 className="text-xl font-semibold text-gray-800 mt-10 mb-3">11. Contact</h2>
          <p className="text-gray-700 leading-relaxed mb-1">B4MIND Brand Consulting and Digital Marketing Ltd (operating as CareNova)</p>
          <p className="text-gray-700 leading-relaxed mb-1">66 Paul Street, London, England, EC2A 4NA</p>
          <p className="text-gray-700 leading-relaxed mb-1">
            General enquiries:{' '}
            <a href="mailto:info@carenova.ai" className="text-gold underline">info@carenova.ai</a>
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
