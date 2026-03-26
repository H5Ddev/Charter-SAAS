export default function TermsPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-gray-900">Terms and Conditions</h1>
          <p className="text-sm text-gray-500 mt-2">Last updated: March 26, 2026</p>
        </div>

        <div className="prose prose-gray max-w-none space-y-8 text-gray-700 text-sm leading-relaxed">

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">1. Acceptance of Terms</h2>
            <p>
              By providing your phone number and consenting to receive SMS communications from AeroComm
              or any charter operator using our platform, you agree to these Terms and Conditions. If you
              do not agree, do not provide your consent.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">2. SMS Messaging Program</h2>
            <p>
              AeroComm provides SMS notifications on behalf of charter aviation companies. By opting in,
              you may receive messages including:
            </p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Booking confirmations</li>
              <li>Pre-flight reminders (7-day, 2-day, 24-hour, and 2-hour)</li>
              <li>Boarding and departure notifications</li>
              <li>Return flight reminders</li>
              <li>Weather or operational delay alerts</li>
              <li>Post-trip thank-you and feedback requests</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">3. Message Frequency</h2>
            <p>
              Message frequency varies depending on the number of trips you have booked. You may receive
              up to 8 messages per trip. Additional messages may be sent in the event of operational
              changes or delays.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">4. Message and Data Rates</h2>
            <p>
              Message and data rates may apply depending on your mobile carrier and plan. AeroComm does
              not charge for SMS messages, but your carrier may. Check with your carrier for details.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">5. Opt-Out Instructions</h2>
            <p>
              You may opt out of receiving SMS messages at any time by replying <strong>STOP</strong> to
              any message. After opting out, you will receive one final confirmation message and will not
              receive further messages unless you opt back in.
            </p>
            <p className="mt-2">
              To opt back in after opting out, reply <strong>UNSTOP</strong> or <strong>START</strong> to
              the number that sent your messages.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">6. Help</h2>
            <p>
              Reply <strong>HELP</strong> to any message for assistance. You may also contact us directly
              at{' '}
              <a href="mailto:support@aerocomm.io" className="text-blue-600 hover:underline">
                support@aerocomm.io
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">7. Privacy</h2>
            <p>
              Your information is handled in accordance with our{' '}
              <a href="/privacy" className="text-blue-600 hover:underline">Privacy Policy</a>. We do not
              sell your phone number or personal information to third parties. No mobile information will
              be shared with third parties or affiliates for marketing or promotional purposes.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">8. Supported Carriers</h2>
            <p>
              Supported carriers include AT&T, Verizon, T-Mobile, Sprint, Boost, and most US carriers.
              Carrier support may vary.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">9. Changes to These Terms</h2>
            <p>
              We reserve the right to update these Terms at any time. Continued use of our SMS program
              after changes constitutes acceptance of the revised Terms.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">10. Contact</h2>
            <p>
              Questions about these Terms? Contact us at{' '}
              <a href="mailto:support@aerocomm.io" className="text-blue-600 hover:underline">
                support@aerocomm.io
              </a>
              .
            </p>
          </section>

        </div>
      </div>
    </div>
  )
}
