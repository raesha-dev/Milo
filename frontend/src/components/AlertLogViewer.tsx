import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, getAlerts } from '@/lib/alertService';
import { CheckCircle, XCircle, Clock, AlertCircle } from 'lucide-react';

export const AlertLogViewer: React.FC = () => {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadAlerts = () => {
    setAlerts(getAlerts());
  };

  useEffect(() => {
    loadAlerts();
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sent':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'simulated':
        return <AlertCircle className="w-4 h-4 text-yellow-500" />;
      case 'queued':
        return <Clock className="w-4 h-4 text-blue-500" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      sent: 'default',
      failed: 'destructive',
      simulated: 'secondary',
      queued: 'outline',
    };
    return (
      <Badge variant={variants[status] || 'outline'} className="text-xs">
        {status.toUpperCase()}
      </Badge>
    );
  };

  const formatTimestamp = (iso: string) => {
    const date = new Date(iso);
    return date.toLocaleString();
  };

  return (
    <Card className="bg-white/90 backdrop-blur-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <CardTitle className="text-lg">Alert History</CardTitle>
        <Button variant="ghost" size="sm" onClick={loadAlerts}>
          Refresh
        </Button>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px] pr-4">
          {alerts.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              <p className="text-sm">No alerts sent yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {alerts.map((alert) => (
                <div
                  key={alert.id}
                  className="border rounded-lg p-3 space-y-2 hover:bg-muted/30 transition-colors cursor-pointer"
                  onClick={() => setExpandedId(expandedId === alert.id ? null : alert.id)}
                >
                  {/* Header */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(alert.status)}
                      {getStatusBadge(alert.status)}
                      <Badge variant="outline" className="text-xs">
                        {alert.severity.toUpperCase()}
                      </Badge>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {formatTimestamp(alert.createdAt)}
                    </span>
                  </div>

                  {/* Message Preview */}
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {alert.message}
                  </p>

                  {/* Expanded Details */}
                  {expandedId === alert.id && (
                    <div className="pt-2 border-t space-y-2">
                      <div>
                        <p className="text-xs font-semibold mb-1">Alert ID:</p>
                        <code className="text-xs bg-muted px-2 py-1 rounded">
                          {alert.id}
                        </code>
                      </div>

                      <div>
                        <p className="text-xs font-semibold mb-1">
                          Recipients ({alert.contacts.length}):
                        </p>
                        <ul className="text-xs space-y-1">
                          {alert.contacts.map((contact, idx) => (
                            <li key={idx} className="flex items-center justify-between">
                              <span>{contact.name}</span>
                              <span className="text-muted-foreground">
                                {contact.channel}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Delivery Log */}
                      {alert.deliveryLog.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold mb-1">Delivery Log:</p>
                          <ul className="text-xs space-y-1">
                            {alert.deliveryLog.map((log, idx) => (
                              <li
                                key={idx}
                                className="flex items-center gap-2 text-muted-foreground"
                              >
                                {log.success ? (
                                  <CheckCircle className="w-3 h-3 text-green-500" />
                                ) : (
                                  <XCircle className="w-3 h-3 text-red-500" />
                                )}
                                <span>
                                  {log.contact} via {log.channel}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
