/**
 * Emergency & Support Contact Configuration
 * Update these values to change the contact details shown in the
 * Support & Emergency Contact widget on all dashboards.
 */
export const EMERGENCY_CONFIG = {
  /** Tappable phone number for instant dialing */
  phoneNumber: '+1-800-LUMINAR',
  phoneDisplay: '+1-800-586-4627',

  /** Support email for immediate queries / emergency alerts */
  supportEmail: 'support@luminar.guide',

  /** Office hours text shown in the widget */
  officeHours: 'Mon–Fri, 9 AM – 6 PM IST',

  /** Emergency protocol note */
  emergencyProtocol:
    'For life-threatening emergencies, call 112 immediately. Our team responds to urgent emails within 2 hours during office hours.',

  /** Response time for non-emergency queries */
  responseTime: 'Standard queries: within 24 hours',
} as const;
