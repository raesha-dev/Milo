// Mock alert service using localStorage
// Structured for easy replacement with Google Cloud backend

export interface TrustedContact {
  name: string;
  channel: 'sms' | 'email';
  target: string;
}

export interface AlertRequest {
  userId?: string;
  message: string;
  severity: 'high' | 'medium' | 'low';
  contacts: TrustedContact[];
  demo?: boolean;
}

export interface DeliveryLog {
  contact: string;
  channel: 'sms' | 'email';
  providerResponse: string;
  success: boolean;
  timestamp: string;
}

export interface Alert {
  id: string;
  userId: string;
  message: string;
  severity: 'high' | 'medium' | 'low';
  contacts: TrustedContact[];
  createdAt: string;
  status: 'queued' | 'simulated' | 'sent' | 'failed';
  deliveryLog: DeliveryLog[];
}

const STORAGE_KEY = 'emergency_alerts';
const COOLDOWN_KEY = 'last_alert_timestamp';
const COOLDOWN_MS = 60000; // 1 minute cooldown

// Rate limiting
const checkCooldown = (): { allowed: boolean; remainingMs: number } => {
  const lastAlertStr = localStorage.getItem(COOLDOWN_KEY);
  if (!lastAlertStr) {
    return { allowed: true, remainingMs: 0 };
  }

  const lastAlert = parseInt(lastAlertStr, 10);
  const now = Date.now();
  const elapsed = now - lastAlert;
  
  if (elapsed < COOLDOWN_MS) {
    return { allowed: false, remainingMs: COOLDOWN_MS - elapsed };
  }

  return { allowed: true, remainingMs: 0 };
};

// Generate unique ID
const generateId = (): string => {
  return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// Get all alerts
export const getAlerts = (): Alert[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

// Save alerts
const saveAlerts = (alerts: Alert[]): void => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(alerts));
};

// Simulate delivery
const simulateDelivery = async (contact: TrustedContact, isDemo: boolean): Promise<DeliveryLog> => {
  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 500 + Math.random() * 500));

  return {
    contact: contact.name,
    channel: contact.channel,
    providerResponse: isDemo ? 'DEMO_MODE_SIMULATED' : 'MOCK_SUCCESS',
    success: true,
    timestamp: new Date().toISOString(),
  };
};

// Send alert (mock implementation)
export const sendEmergencyAlert = async (
  request: AlertRequest
): Promise<{ alertId: string; status: string; createdAt: string }> => {
  // Check cooldown
  const cooldown = checkCooldown();
  if (!cooldown.allowed) {
    const secondsRemaining = Math.ceil(cooldown.remainingMs / 1000);
    throw new Error(
      `Please wait ${secondsRemaining} seconds before sending another alert (cooldown for safety).`
    );
  }

  // Validate
  if (!request.message || request.message.trim().length === 0) {
    throw new Error('Alert message cannot be empty');
  }

  if (request.contacts.length === 0) {
    throw new Error('No trusted contacts provided');
  }

  // Create alert
  const alertId = generateId();
  const createdAt = new Date().toISOString();
  const userId = request.userId || 'anonymous';

  const alert: Alert = {
    id: alertId,
    userId,
    message: request.message,
    severity: request.severity,
    contacts: request.contacts,
    createdAt,
    status: request.demo ? 'simulated' : 'queued',
    deliveryLog: [],
  };

  // Save immediately
  const alerts = getAlerts();
  alerts.unshift(alert); // Add to beginning
  saveAlerts(alerts);

  // Update cooldown
  localStorage.setItem(COOLDOWN_KEY, Date.now().toString());

  // Simulate sending (in real implementation, this would be a background job)
  setTimeout(async () => {
    const deliveryLogs: DeliveryLog[] = [];
    
    for (const contact of request.contacts) {
      try {
        const log = await simulateDelivery(contact, request.demo || false);
        deliveryLogs.push(log);
      } catch (error) {
        deliveryLogs.push({
          contact: contact.name,
          channel: contact.channel,
          providerResponse: `ERROR: ${error}`,
          success: false,
          timestamp: new Date().toISOString(),
        });
      }
    }

    // Update alert with delivery logs
    const updatedAlerts = getAlerts();
    const alertIndex = updatedAlerts.findIndex((a) => a.id === alertId);
    if (alertIndex !== -1) {
      updatedAlerts[alertIndex].deliveryLog = deliveryLogs;
      updatedAlerts[alertIndex].status = request.demo
        ? 'simulated'
        : deliveryLogs.every((log) => log.success)
        ? 'sent'
        : 'failed';
      saveAlerts(updatedAlerts);
    }
  }, 1000);

  return {
    alertId,
    status: alert.status,
    createdAt,
  };
};

// Get alert by ID
export const getAlertById = (alertId: string): Alert | null => {
  const alerts = getAlerts();
  return alerts.find((a) => a.id === alertId) || null;
};

// Clear old alerts (keep last 50)
export const pruneOldAlerts = (): void => {
  const alerts = getAlerts();
  if (alerts.length > 50) {
    saveAlerts(alerts.slice(0, 50));
  }
};
