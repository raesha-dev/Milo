import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, Users } from 'lucide-react';

interface TrustedContact {
  name: string;
  channel: 'sms' | 'email';
  target: string;
}

interface AlertConfirmationModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  contacts: TrustedContact[];
  isDemo: boolean;
  message: string;
}

export const AlertConfirmationModal: React.FC<AlertConfirmationModalProps> = ({
  open,
  onClose,
  onConfirm,
  contacts,
  isDemo,
  message,
}) => {
  const [consentChecked, setConsentChecked] = useState(false);
  const [holdProgress, setHoldProgress] = useState(0);
  const [isHolding, setIsHolding] = useState(false);

  const handleMouseDown = () => {
    if (!consentChecked) return;
    setIsHolding(true);
    const interval = setInterval(() => {
      setHoldProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          onConfirm();
          handleClose();
          return 100;
        }
        return prev + 5;
      });
    }, 50);
  };

  const handleMouseUp = () => {
    setIsHolding(false);
    setHoldProgress(0);
  };

  const handleClose = () => {
    setConsentChecked(false);
    setHoldProgress(0);
    setIsHolding(false);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-destructive" />
            Confirm Emergency Alert
          </DialogTitle>
          <DialogDescription>
            Please review carefully before sending
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Demo Mode Banner */}
          {isDemo && (
            <Alert className="bg-yellow-50 border-yellow-200">
              <AlertDescription className="text-yellow-800 text-sm">
                <strong>Demo Mode Active:</strong> No real messages will be sent. This is a simulation.
              </AlertDescription>
            </Alert>
          )}

          {/* Alert Message */}
          <div className="space-y-2">
            <h4 className="font-semibold text-sm">Alert Message:</h4>
            <p className="text-sm text-muted-foreground border rounded-md p-3 bg-muted/30">
              {message}
            </p>
          </div>

          {/* Contacts List */}
          <div className="space-y-2">
            <h4 className="font-semibold text-sm flex items-center gap-2">
              <Users className="w-4 h-4" />
              Recipients ({contacts.length}):
            </h4>
            <div className="border rounded-md p-3 bg-muted/30 max-h-32 overflow-y-auto">
              {contacts.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">
                  No trusted contacts configured. Please add contacts in Settings.
                </p>
              ) : (
                <ul className="space-y-1">
                  {contacts.map((contact, idx) => (
                    <li key={idx} className="text-sm flex items-center justify-between">
                      <span className="font-medium">{contact.name}</span>
                      <span className="text-muted-foreground text-xs">
                        via {contact.channel} → {contact.target}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Consent Checkbox */}
          <div className="flex items-start space-x-2 pt-2">
            <Checkbox
              id="consent"
              checked={consentChecked}
              onCheckedChange={(checked) => setConsentChecked(checked === true)}
              disabled={contacts.length === 0}
            />
            <label
              htmlFor="consent"
              className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              I consent to send emergency alerts to my trusted contacts listed above.
              {isDemo && ' (Demo mode - no real messages will be sent)'}
            </label>
          </div>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          {/* Hold to Confirm Button */}
          <Button
            className="w-full relative overflow-hidden"
            variant="destructive"
            disabled={!consentChecked || contacts.length === 0}
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchStart={handleMouseDown}
            onTouchEnd={handleMouseUp}
          >
            <div
              className="absolute left-0 top-0 h-full bg-red-700 transition-all"
              style={{ width: `${holdProgress}%` }}
            />
            <span className="relative z-10">
              {holdProgress === 0 ? 'Hold to Confirm & Send Alert' : `${Math.floor(holdProgress)}%`}
            </span>
          </Button>

          <Button variant="ghost" onClick={handleClose} className="w-full">
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
