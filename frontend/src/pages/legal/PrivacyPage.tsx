export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-gray-900">Privacy Policy</h1>
          <p className="text-sm text-gray-500 mt-2">Last updated: March 26, 2026</p>
        </div>

        <div className="prose prose-gray max-w-none space-y-8 text-gray-700 text-sm leading-relaxed">

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">1. Introduction</h2>
            <p>
              AeroPulse ("we," "us," or "our") operates a charter aviation communications and operations
              platform. This Privacy Policy explains how we collect, use, disclose, and safeguard your
              information when you use our services or receive communications from us on behalf of charter
              companies using our platform.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">2. Information We Collect</h2>
            <p>We may collect the following types of information:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li><strong>Contact information:</strong> name, email address, phone number</li>
              <li><strong>Trip information:</strong> flight itineraries, departure and arrival details</li>
              <li><strong>Communications:</strong> SMS messages, support tickets, and related correspondence</li>
              <li><strong>Device and usage data:</strong> IP address, browser type, and access timestamps</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">3. SMS Communications</h2>
            <p>
              With your consent, we send SMS messages on behalf of charter operators using our platform.
              These messages may include flight confirmations, itinerary reminders, boarding notifications,
              delay alerts, and post-trip follow-ups.
            </p>
            <p className="mt-2">
              Message and data rates may apply. Message frequency varies based on your upcoming trips.
              You may opt out at any time by replying <strong>STOP</strong> to any message. Reply{' '}
              <strong>HELP</strong> for assistance. For more information, see our{' '}
              <a href="/terms" className="text-blue-600 hover:underline">Terms and Conditions</a> and{' '}
              <a href="/sms-consent" className="text-blue-600 hover:underline">SMS Consent</a> page.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">4. How We Use Your Information</h2>
            <p>We use collected information to:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Send flight-related SMS notifications and reminders</li>
              <li>Manage support tickets and passenger communications</li>
              <li>Improve our platform and services</li>
              <li>Comply with legal obligations</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">5. Information Sharing</h2>
            <p>
              We do not sell or rent your personal information to third parties. We may share information
              with charter operators whose services you are using, and with service providers (such as Twilio
              for SMS delivery) solely to facilitate communications on your behalf.
            </p>
            <p className="mt-2 font-medium">
              No mobile information will be shared with third parties or affiliates for marketing or
              promotional purposes. All other categories exclude text messaging originator opt-in data and
              consent; this information will not be shared with any third parties.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">6. Data Retention</h2>
            <p>
              We retain personal data for as long as necessary to provide services and fulfill the purposes
              described in this policy, or as required by law. SMS opt-out records are retained indefinitely
              to honor your preferences.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">7. Your Rights</h2>
            <p>You have the right to:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Access the personal information we hold about you</li>
              <li>Request correction of inaccurate data</li>
              <li>Request deletion of your data</li>
              <li>Opt out of SMS communications at any time by replying <strong>STOP</strong></li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">8. Security</h2>
            <p>
              We implement industry-standard security measures including encryption in transit and at rest,
              access controls, and regular security reviews to protect your information.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">9. Contact Us</h2>
            <p>
              If you have questions about this Privacy Policy or wish to exercise your data rights, please
              contact us at{' '}
              <a href="mailto:privacy@aerocomm.io" className="text-blue-600 hover:underline">
                privacy@aerocomm.io
              </a>
              .
            </p>
          </section>

        </div>
      </div>
    </div>
  )
}
