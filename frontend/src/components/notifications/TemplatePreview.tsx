import React from 'react';
import type { NotificationChannel } from '@/api/notifications.api';

interface TemplatePreviewProps {
  channel: NotificationChannel | string;
  subject?: string;
  body: string;
  sampleData?: Record<string, unknown>;
}

const DEFAULT_SAMPLE_DATA: Record<string, string> = {
  'passenger.firstName': 'John',
  'passenger.lastName': 'Smith',
  'passenger.phone': '+1 555-555-5555',
  'trip.departureDate': 'March 25, 2025',
  'trip.departureTime': '10:00 AM',
  'trip.boardingTime': '9:30 AM',
  'trip.fboName': 'Signature Flight Support',
  'trip.fboAddress': '1234 Airport Blvd, Miami, FL',
  'trip.pilots': 'Capt. James Wilson, FO Sarah Lee',
  'trip.returnTime': '5:00 PM',
  'trip.returnPilots': 'Capt. James Wilson',
  'trip.returnFbo': 'Signature Flight Support',
  'trip.surveyLink': 'https://survey.aerocomm.io/abc123',
  'tenant.companyName': 'SkyCharter Inc.',
  'tenant.supportPhone': '+1 800-SKY-CHART',
  'tenant.supportEmail': 'support@skycharter.com',
};

function interpolate(text: string, data: Record<string, string>): string {
  return text.replace(/\{\{([\w.]+)\}\}/g, (_, key) => {
    return data[key] ?? `{{${key}}}`;
  });
}

function SmsPreview({ body, data }: { body: string; data: Record<string, string> }) {
  const rendered = interpolate(body, data);
  return (
    <div className="flex justify-center">
      <div className="w-64 bg-gray-900 rounded-3xl p-4 shadow-2xl">
        <div className="bg-gray-800 rounded-2xl px-3 py-2 mb-3">
          <div className="flex items-center justify-center gap-1">
            <div className="w-16 h-1.5 bg-gray-600 rounded-full" />
          </div>
        </div>
        <div className="space-y-2 min-h-[100px]">
          <div className="flex justify-end">
            <div className="max-w-[85%] bg-blue-500 text-white text-xs rounded-2xl rounded-tr-sm px-3 py-2 leading-relaxed whitespace-pre-wrap">
              {rendered || <span className="opacity-40 italic">Message will appear here…</span>}
            </div>
          </div>
        </div>
        <div className="mt-3 flex items-center bg-gray-800 rounded-xl px-3 py-1.5 gap-2">
          <span className="text-gray-400 text-xs flex-1">iMessage</span>
          <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center">
            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.707l-3-3a1 1 0 00-1.414 0l-3 3a1 1 0 001.414 1.414L9 9.414V13a1 1 0 102 0V9.414l1.293 1.293a1 1 0 001.414-1.414z" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}

function EmailPreview({
  subject,
  body,
  data,
}: {
  subject?: string;
  body: string;
  data: Record<string, string>;
}) {
  const renderedSubject = subject ? interpolate(subject, data) : '(No subject)';
  const renderedBody = interpolate(body, data);
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden shadow-sm bg-white text-sm">
      <div className="bg-gray-50 border-b border-gray-200 px-4 py-3 space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400 w-12">From:</span>
          <span className="text-xs text-gray-700">{data['tenant.companyName'] ?? 'SkyCharter Inc.'} &lt;no-reply@aerocomm.io&gt;</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400 w-12">To:</span>
          <span className="text-xs text-gray-700">
            {data['passenger.firstName'] ?? 'John'} {data['passenger.lastName'] ?? 'Smith'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400 w-12">Subject:</span>
          <span className="text-xs font-medium text-gray-900">{renderedSubject}</span>
        </div>
      </div>
      <div className="px-4 py-4 min-h-[120px]">
        {renderedBody ? (
          <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{renderedBody}</p>
        ) : (
          <p className="text-sm text-gray-300 italic">Email body will appear here…</p>
        )}
      </div>
    </div>
  );
}

function WhatsAppPreview({ body, data }: { body: string; data: Record<string, string> }) {
  const rendered = interpolate(body, data);
  return (
    <div className="bg-[#ECE5DD] rounded-lg p-4 min-h-[120px]">
      <div className="flex items-center gap-2 mb-3 bg-[#075E54] text-white px-3 py-2 -mx-4 -mt-4 rounded-t-lg">
        <div className="w-8 h-8 rounded-full bg-[#25D366] flex items-center justify-center text-white text-xs font-bold">
          {(data['tenant.companyName'] ?? 'SC').charAt(0)}
        </div>
        <span className="text-sm font-medium">{data['tenant.companyName'] ?? 'SkyCharter'}</span>
      </div>
      <div className="flex justify-start mt-2">
        <div className="max-w-[85%] bg-white rounded-lg rounded-tl-none shadow-sm px-3 py-2 text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
          {rendered || <span className="text-gray-300 italic">WhatsApp message…</span>}
          <div className="text-right text-xs text-gray-400 mt-1">
            {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      </div>
    </div>
  );
}

function SlackPreview({ body, data }: { body: string; data: Record<string, string> }) {
  const rendered = interpolate(body, data);
  return (
    <div className="bg-[#1A1D21] rounded-lg p-4 text-sm min-h-[100px]">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded bg-[#4A154B] flex items-center justify-center shrink-0">
          <svg viewBox="0 0 54 54" className="w-5 h-5" fill="white">
            <path d="M19.712.133a5.381 5.381 0 0 0-5.376 5.387 5.381 5.381 0 0 0 5.376 5.386h5.376V5.52A5.381 5.381 0 0 0 19.712.133m0 14.365H5.376A5.381 5.381 0 0 0 0 19.884a5.381 5.381 0 0 0 5.376 5.386h14.336a5.381 5.381 0 0 0 5.376-5.386 5.381 5.381 0 0 0-5.376-5.386" />
          </svg>
        </div>
        <div>
          <div className="flex items-baseline gap-2 mb-1">
            <span className="text-white font-semibold text-sm">AeroComm Bot</span>
            <span className="text-gray-500 text-xs">Today at {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
          <p className="text-[#D1D2D3] whitespace-pre-wrap leading-relaxed">
            {rendered || <span className="text-gray-500 italic">Slack message…</span>}
          </p>
        </div>
      </div>
    </div>
  );
}

function TeamsPreview({ body, data }: { body: string; data: Record<string, string> }) {
  const rendered = interpolate(body, data);
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
      <div className="bg-[#6264A7] px-4 py-2 flex items-center gap-2">
        <div className="w-6 h-6 bg-white rounded flex items-center justify-center">
          <span className="text-[#6264A7] font-bold text-xs">T</span>
        </div>
        <span className="text-white text-sm font-medium">AeroComm</span>
      </div>
      <div className="px-4 py-3 border-l-4 border-[#6264A7]">
        <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
          {rendered || <span className="text-gray-300 italic">Teams message…</span>}
        </p>
      </div>
    </div>
  );
}

function InAppPreview({ body, data }: { body: string; data: Record<string, string> }) {
  const rendered = interpolate(body, data);
  return (
    <div className="flex justify-end">
      <div className="max-w-sm w-full bg-white border border-gray-200 rounded-xl shadow-lg p-4 flex items-start gap-3">
        <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center shrink-0">
          <svg className="w-4 h-4 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-gray-900 mb-0.5">AeroComm Notification</p>
          <p className="text-xs text-gray-600 leading-relaxed whitespace-pre-wrap">
            {rendered || <span className="text-gray-300 italic">In-app notification…</span>}
          </p>
          <p className="text-xs text-gray-400 mt-1">Just now</p>
        </div>
        <button className="text-gray-300 hover:text-gray-500 shrink-0">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}

export function TemplatePreview({ channel, subject, body, sampleData }: TemplatePreviewProps) {
  const data: Record<string, string> = {
    ...DEFAULT_SAMPLE_DATA,
    ...Object.fromEntries(
      Object.entries(sampleData ?? {}).map(([k, v]) => [k, String(v)]),
    ),
  };

  const channelUpper = channel.toUpperCase();

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Preview</h4>
        <span className="text-xs text-gray-400 italic">Sample data applied</span>
      </div>

      {channelUpper === 'SMS' && <SmsPreview body={body} data={data} />}
      {channelUpper === 'EMAIL' && <EmailPreview subject={subject} body={body} data={data} />}
      {channelUpper === 'WHATSAPP' && <WhatsAppPreview body={body} data={data} />}
      {channelUpper === 'SLACK' && <SlackPreview body={body} data={data} />}
      {channelUpper === 'TEAMS' && <TeamsPreview body={body} data={data} />}
      {channelUpper === 'IN_APP' && <InAppPreview body={body} data={data} />}
    </div>
  );
}

export default TemplatePreview;
