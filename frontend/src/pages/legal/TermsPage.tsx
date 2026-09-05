import React from 'react';
import NavBar from '../../components/landing/NavBar';
import Footer from '../../components/landing/Footer';
import SEOMeta from '../../components/SEOMeta';

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-white">
      <SEOMeta
        title="Terms of Service | CareNova"
        description="The terms governing use of the CareNova WhatsApp AI platform for dental clinics."
        path="/terms"
      />
      <NavBar />
      <main className="pt-24 pb-24">
        <div className="max-w-3xl mx-auto px-6">

          <h1 className="text-3xl font-bold text-gray-900 mb-1">Terms of Service</h1>
          <p className="text-sm text-gray-500 mb-10">Last updated: 5 May 2026</p>

          <p className="text-gray-700 leading-relaxed mb-4">
            These Terms of Service ("Terms") govern access to and use of the CareNova platform and website
            (the "Service"), provided by B4MIND Brand Consulting and Digital Marketing Ltd ("CareNova",
            "we", "us"), a company registered in England and Wales (company number 11296210), registered
            office 66 Paul Street, London, England, EC2A 4NA.
          </p>
          <p className="text-gray-700 leading-relaxed mb-8">
            By creating an account, accessing, or using the Service, you ("Customer", "you") agree to these
            Terms. If you are entering into these Terms on behalf of a dental practice or other organisation,
            you confirm you have authority to bind that organisation.
          </p>

          <h2 className="text-xl font-semibold text-gray-800 mt-10 mb-3">1. The Service</h2>
          <p className="text-gray-700 leading-relaxed mb-4">
            CareNova provides a multi-tenant software platform that enables dental clinics to manage and
            recover leads through WhatsApp-based, multilingual, AI-assisted messaging, together with related
            features (lead management, reporting, commission tracking, calendar integration, and similar).
            Features may change, improve, or be discontinued over time.
          </p>

          <h2 className="text-xl font-semibold text-gray-800 mt-10 mb-3">2. Accounts and eligibility</h2>
          <ul className="list-disc ml-6 mb-4 space-y-2 text-gray-700 leading-relaxed">
            <li>You must provide accurate account information and keep it up to date.</li>
            <li>You are responsible for safeguarding login credentials and for all activity under your account.</li>
            <li>Accounts are provisioned on an invitation basis; you must not share credentials or allow unauthorised access.</li>
            <li>The Service is intended for business use by dental practices and their staff, not for consumers.</li>
          </ul>

          <h2 className="text-xl font-semibold text-gray-800 mt-10 mb-3">3. Customer responsibilities and acceptable use</h2>
          <p className="text-gray-700 leading-relaxed mb-3">
            You are responsible for your use of the Service and for the data you input. You agree that you will:
          </p>
          <ul className="list-disc ml-6 mb-4 space-y-2 text-gray-700 leading-relaxed">
            <li>
              Comply with all applicable laws, including data protection and electronic marketing laws (UK GDPR,
              the Privacy and Electronic Communications Regulations (PECR), and equivalent rules).
            </li>
            <li>
              Obtain all necessary consents and provide all required notices to patients and leads before
              adding them to the platform or sending them messages — including, where required, valid consent
              for WhatsApp marketing/follow-up messaging.
            </li>
            <li>
              Act as the data controller for patient/lead data you process via the Service, and use CareNova
              only as your processor in accordance with our Data Processing Agreement.
            </li>
            <li>
              Not use the Service to send unlawful, deceptive, harassing, or unsolicited messages, or to
              upload data you have no right to use.
            </li>
            <li>Comply with the WhatsApp Business Messaging Policy and Meta's applicable terms.</li>
          </ul>
          <p className="text-gray-700 leading-relaxed mb-4">
            You are solely responsible for the content of messages sent to your leads and for ensuring a
            lawful basis for contacting them.
          </p>

          <h2 className="text-xl font-semibold text-gray-800 mt-10 mb-3">4. Subscriptions, fees, and payment</h2>
          <ul className="list-disc ml-6 mb-4 space-y-2 text-gray-700 leading-relaxed">
            <li>
              Access to paid features requires an active subscription. Fees, billing frequency, and plan
              details are those set out in your order form or subscription confirmation at sign-up.
            </li>
            <li>Fees are exclusive of VAT and other applicable taxes unless stated otherwise.</li>
            <li>
              Messages delivered via the WhatsApp Business Platform may incur third-party charges levied by
              Meta. Unless your order states otherwise, such charges are your responsibility.
            </li>
            <li>Late or failed payments may result in suspension of the Service.</li>
          </ul>

          <h2 className="text-xl font-semibold text-gray-800 mt-10 mb-3">5. Intellectual property</h2>
          <p className="text-gray-700 leading-relaxed mb-4">
            The Service, including all software, design, and content (excluding Customer Data), is owned by
            CareNova or its licensors and is protected by intellectual property laws. We grant you a
            limited, non-exclusive, non-transferable right to use the Service during your subscription.
            You retain all rights in the data you input ("Customer Data").
          </p>

          <h2 className="text-xl font-semibold text-gray-800 mt-10 mb-3">6. Customer Data and AI processing</h2>
          <ul className="list-disc ml-6 mb-4 space-y-2 text-gray-700 leading-relaxed">
            <li>
              You grant us the rights necessary to host, process, and transmit Customer Data to provide the
              Service, including transmitting message content to our AI sub-processor to generate responses.
            </li>
            <li>
              We process Customer Data in accordance with our Privacy Policy and Data Processing Agreement.
            </li>
            <li>We do not sell Customer Data, and we do not use it to train third-party AI models.</li>
          </ul>

          <h2 className="text-xl font-semibold text-gray-800 mt-10 mb-3">7. Third-party services</h2>
          <p className="text-gray-700 leading-relaxed mb-4">
            The Service integrates with third-party platforms (e.g. WhatsApp/Meta, Google Calendar). Your
            use of those integrations is also subject to the relevant third party's terms. We are not
            responsible for third-party services or their availability.
          </p>

          <h2 className="text-xl font-semibold text-gray-800 mt-10 mb-3">8. Availability and support</h2>
          <p className="text-gray-700 leading-relaxed mb-4">
            We aim to provide a reliable Service using commercially reasonable efforts, but we do not
            guarantee uninterrupted or error-free operation and do not currently offer a contractual uptime
            service level unless separately agreed in your order. We may perform maintenance, and may modify
            or suspend the Service where reasonably necessary.
          </p>

          <h2 className="text-xl font-semibold text-gray-800 mt-10 mb-3">9. Warranties and disclaimers</h2>
          <p className="text-gray-700 leading-relaxed mb-4">
            The Service is provided "as is" and "as available". To the maximum extent permitted by law, we
            disclaim all implied warranties, including fitness for a particular purpose and non-infringement.
            We do not warrant that the AI will produce any particular result, booking, or commercial outcome.
          </p>

          <h2 className="text-xl font-semibold text-gray-800 mt-10 mb-3">10. Limitation of liability</h2>
          <p className="text-gray-700 leading-relaxed mb-3">To the maximum extent permitted by law:</p>
          <ul className="list-disc ml-6 mb-4 space-y-2 text-gray-700 leading-relaxed">
            <li>
              We are not liable for indirect, incidental, special, or consequential losses, or for loss of
              profits, revenue, goodwill, or data.
            </li>
            <li>
              Our total aggregate liability arising out of or relating to these Terms shall not exceed the
              fees paid by you to CareNova in the 12 months preceding the event giving rise to the claim.
            </li>
            <li>
              Nothing in these Terms excludes liability that cannot lawfully be excluded (e.g. for death or
              personal injury caused by negligence, or fraud).
            </li>
          </ul>

          <h2 className="text-xl font-semibold text-gray-800 mt-10 mb-3">11. Indemnity</h2>
          <p className="text-gray-700 leading-relaxed mb-4">
            You agree to indemnify CareNova against claims arising from your breach of these Terms, your
            unlawful use of the Service, or your failure to obtain required consents from leads/patients.
          </p>

          <h2 className="text-xl font-semibold text-gray-800 mt-10 mb-3">12. Suspension and termination</h2>
          <ul className="list-disc ml-6 mb-4 space-y-2 text-gray-700 leading-relaxed">
            <li>You may terminate by cancelling your subscription in accordance with your order.</li>
            <li>We may suspend or terminate access for breach of these Terms, non-payment, or unlawful use.</li>
            <li>
              On termination, your right to use the Service ends. We will make Customer Data available for
              export or deletion in accordance with our Data Processing Agreement for a limited period.
            </li>
          </ul>

          <h2 className="text-xl font-semibold text-gray-800 mt-10 mb-3">13. Changes to these Terms</h2>
          <p className="text-gray-700 leading-relaxed mb-4">
            We may update these Terms from time to time. Material changes will be notified through the
            Service or by email. Continued use after changes take effect constitutes acceptance.
          </p>

          <h2 className="text-xl font-semibold text-gray-800 mt-10 mb-3">14. Governing law and jurisdiction</h2>
          <p className="text-gray-700 leading-relaxed mb-4">
            These Terms are governed by the laws of England and Wales, and the courts of England and Wales
            have exclusive jurisdiction, subject to any mandatory rights you have under applicable law.
          </p>

          <h2 className="text-xl font-semibold text-gray-800 mt-10 mb-3">15. Contact</h2>
          <p className="text-gray-700 leading-relaxed mb-1">B4MIND Brand Consulting and Digital Marketing Ltd (operating as CareNova)</p>
          <p className="text-gray-700 leading-relaxed mb-1">66 Paul Street, London, England, EC2A 4NA</p>
          <p className="text-gray-700 leading-relaxed mb-10">
            Email:{' '}
            <a href="mailto:info@carenova.ai" className="text-accent underline">info@carenova.ai</a>
          </p>

        </div>
      </main>
      <Footer />
    </div>
  );
}
