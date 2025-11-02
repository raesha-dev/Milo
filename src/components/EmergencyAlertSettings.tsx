import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Trash2, Plus, Users } from 'lucide-react';
import { TrustedContact } from '@/lib/alertService';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const SETTINGS_KEY = 'emergency_alert_settings';

interface EmergencySettings {
  demoMode: boolean;
  contacts: TrustedContact[];
}

export const EmergencyAlertSettings: React.FC = () => {
  const [settings, setSettings] = useState<EmergencySettings>({
    demoMode: true, // Default to demo mode for safety
    contacts: [],
  });

  const [newContact, setNewContact] = useState<TrustedContact>({
    name: '',
    channel: 'sms',
    target: '',
  });

  // Load settings
  useEffect(() => {
    try {
      const stored = localStorage.getItem(SETTINGS_KEY);
      if (stored) {
        setSettings(JSON.parse(stored));
      }
    } catch {
      // Use defaults
    }
  }, []);

  // Save settings
  const saveSettings = (updated: EmergencySettings) => {
    setSettings(updated);
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));
  };

  const addContact = () => {
    if (!newContact.name.trim() || !newContact.target.trim()) {
      alert('Please fill in all contact fields');
      return;
    }

    const updated = {
      ...settings,
      contacts: [...settings.contacts, { ...newContact }],
    };
    saveSettings(updated);
    setNewContact({ name: '', channel: 'sms', target: '' });
  };

  const removeContact = (index: number) => {
    const updated = {
      ...settings,
      contacts: settings.contacts.filter((_, i) => i !== index),
    };
    saveSettings(updated);
  };

  return (
    <div className="space-y-4">
      {/* Demo Mode Toggle */}
      <Card className="bg-white/90 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-lg">Demo Mode</CardTitle>
          <CardDescription>
            When enabled, alerts are simulated and no real messages are sent
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-between">
          <div className="space-y-1">
            <Label htmlFor="demo-mode">Demo Mode (Recommended for Testing)</Label>
            <p className="text-xs text-muted-foreground">
              {settings.demoMode ? 'Alerts will be simulated' : 'Alerts will be sent for real'}
            </p>
          </div>
          <Switch
            id="demo-mode"
            checked={settings.demoMode}
            onCheckedChange={(checked) =>
              saveSettings({ ...settings, demoMode: checked })
            }
          />
        </CardContent>
      </Card>

      {/* Trusted Contacts */}
      <Card className="bg-white/90 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="w-5 h-5" />
            Trusted Contacts
          </CardTitle>
          <CardDescription>
            People who will receive alerts in an emergency
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Contact List */}
          {settings.contacts.length > 0 && (
            <div className="space-y-2">
              {settings.contacts.map((contact, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 border rounded-lg bg-muted/30"
                >
                  <div>
                    <p className="font-medium text-sm">{contact.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {contact.channel}: {contact.target}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeContact(idx)}
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Add New Contact Form */}
          <div className="space-y-3 pt-4 border-t">
            <h4 className="font-semibold text-sm">Add New Contact</h4>
            
            <div className="space-y-2">
              <Label htmlFor="contact-name">Name</Label>
              <Input
                id="contact-name"
                placeholder="e.g., Mom, Best Friend, etc."
                value={newContact.name}
                onChange={(e) =>
                  setNewContact({ ...newContact, name: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="contact-channel">Contact Method</Label>
              <Select
                value={newContact.channel}
                onValueChange={(value: 'sms' | 'email') =>
                  setNewContact({ ...newContact, channel: value })
                }
              >
                <SelectTrigger id="contact-channel">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sms">SMS / Text Message</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="contact-target">
                {newContact.channel === 'sms' ? 'Phone Number' : 'Email Address'}
              </Label>
              <Input
                id="contact-target"
                type={newContact.channel === 'sms' ? 'tel' : 'email'}
                placeholder={
                  newContact.channel === 'sms'
                    ? 'e.g., +1234567890'
                    : 'e.g., contact@example.com'
                }
                value={newContact.target}
                onChange={(e) =>
                  setNewContact({ ...newContact, target: e.target.value })
                }
              />
            </div>

            <Button onClick={addContact} className="w-full">
              <Plus className="w-4 h-4 mr-2" />
              Add Contact
            </Button>
          </div>

          {!settings.demoMode && settings.contacts.length > 0 && (
            <Badge variant="destructive" className="w-full justify-center">
              ⚠️ Demo mode OFF - Real alerts will be sent
            </Badge>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

// Export function to get current settings
export const getEmergencySettings = (): EmergencySettings => {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    return stored
      ? JSON.parse(stored)
      : { demoMode: true, contacts: [] };
  } catch {
    return { demoMode: true, contacts: [] };
  }
};
