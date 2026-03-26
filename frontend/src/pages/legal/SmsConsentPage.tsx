export default function SmsConsentPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <div className="mb-10">
          <div className="inline-flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-full px-4 py-1.5 mb-6">
            <span className="text-blue-700 text-xs font-semibold uppercase tracking-wide">SMS Opt-In Program</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">SMS Consent &amp; Opt-In Workflow</h1>
          <p className="text-sm text-gray-500 mt-2">How passengers consent to receive flight notifications via SMS</p>
        </div>

        {/* How opt-in works */}
        <div className="space-y-6 mb-12">
          <h2 className="text-lg font-semibold text-gray-900">How Opt-In Works</h2>
          <p className="text-sm text-gray-600">
            AeroComm collects SMS consent at the time a passenger is added to a charter flight booking.
            Consent is explicit — passengers are never enrolled automatically.
          </p>

          <div className="space-y-4">
            {[
              {
                step: '1',
                title: 'Passenger Added to Trip',
                description: 'A charter operator adds a passenger\'s contact information (name and phone number) when creating or modifying a booking in AeroComm.',
              },
              {
                step: '2',
                title: 'Opt-In Presented',
                description: 'The operator presents the passenger with opt-in language either verbally, via email, or through a paper/digital form. The opt-in language reads:',
                quote: '"By providing your phone number, you agree to receive SMS flight notifications from [Charter Company] powered by AeroComm, including booking confirmations, reminders, boarding times, and delay alerts. Message and data rates may apply. Reply STOP to opt out at any time. Reply HELP for help. View our Privacy Policy and Terms."',
              },
              {
                step: '3',
                title: 'Consent Recorded',
                description: 'The operator records consent in AeroComm by enabling the SMS opt-in flag on the passenger\'s contact record. No SMS messages are sent until this step is completed.',
              },
              {
                step: '4',
                title: 'Notifications Begin',
                description: 'Once opted in, passengers receive automated SMS notifications tied to their upcoming flights — confirmations, reminders, boarding calls, and post-trip follow-ups.',
              },
              {
                step: '5',
                title: 'Easy Opt-Out',
                description: 'Passengers can reply STOP at any time to immediately stop all messages. Opt-out is honored instantly and permanently unless the passenger re-opts in by replying START or UNSTOP.',
              },
            ].map((item) => (
              <div key={item.step} className="flex gap-4">
                <div className="shrink-0 w-8 h-8 rounded-full bg-blue-600 text-white text-sm font-bold flex items-center justify-center">
                  {item.step}
                </div>
                <div className="pt-1">
                  <h3 className="text-sm font-semibold text-gray-900">{item.title}</h3>
                  <p className="text-sm text-gray-600 mt-0.5">{item.description}</p>
                  {item.quote && (
                    <blockquote className="mt-2 pl-3 border-l-2 border-blue-300 text-sm text-gray-600 italic">
                      {item.quote}
                    </blockquote>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Message types */}
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 mb-10">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Types of Messages Sent</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              'Booking confirmation',
              '7-day pre-flight reminder',
              '2-day pre-flight reminder',
              'Day-before itinerary with pilot & FBO details',
              '2-hour boarding call',
              'Return flight reminder',
              'Post-trip thank-you & survey',
              'Weather or operational delay alert',
            ].map((msg) => (
              <div key={msg} className="flex items-center gap-2 text-sm text-gray-700">
                <span className="text-green-500">✓</span>
                {msg}
              </div>
            ))}
          </div>
        </div>

        {/* STOP / HELP / UNSTOP */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 mb-10">
          <h2 className="text-base font-semibold text-gray-900 mb-3">Keyword Commands</h2>
          <div className="space-y-2 text-sm">
            <div className="flex gap-3">
              <code className="font-mono font-bold text-gray-900 w-20 shrink-0">STOP</code>
              <span className="text-gray-700">Immediately unsubscribes you from all SMS messages.</span>
            </div>
            <div className="flex gap-3">
              <code className="font-mono font-bold text-gray-900 w-20 shrink-0">UNSTOP</code>
              <span className="text-gray-700">Re-subscribes you if you previously opted out.</span>
            </div>
            <div className="flex gap-3">
              <code className="font-mono font-bold text-gray-900 w-20 shrink-0">START</code>
              <span className="text-gray-700">Re-subscribes you if you previously opted out.</span>
            </div>
            <div className="flex gap-3">
              <code className="font-mono font-bold text-gray-900 w-20 shrink-0">HELP</code>
              <span className="text-gray-700">Returns support contact information.</span>
            </div>
          </div>
        </div>

        {/* Links */}
        <div className="border-t border-gray-200 pt-8 flex flex-wrap gap-6 text-sm">
          <a href="/privacy" className="text-blue-600 hover:underline">Privacy Policy</a>
          <a href="/terms" className="text-blue-600 hover:underline">Terms and Conditions</a>
          <a href="mailto:support@aerocomm.io" className="text-blue-600 hover:underline">support@aerocomm.io</a>
        </div>
      </div>
    </div>
  )
}
