'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { initializePushNotifications } from '@/lib/capacitor-utils';
import { Capacitor } from '@capacitor/core';

export default function TestPushPage() {
  const [pushToken, setPushToken] = useState<string>('');
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string>('');
  const [status, setStatus] = useState<string>('Not initialized');

  const isNative = Capacitor.getPlatform() !== 'web';

  useEffect(() => {
    if (isNative) {
      setStatus('Ready to initialize');
    } else {
      setStatus('Web platform - push notifications not available');
    }
  }, [isNative]);

  const initializePush = async () => {
    try {
      setStatus('Initializing push notifications...');
      setError('');

      if (!isNative) {
        throw new Error('Push notifications only work on native platforms');
      }

      // Initialize push notifications
      await initializePushNotifications();

      setIsInitialized(true);
      setStatus('Push notifications initialized');

      // The token will be logged in the console by the utility function
      // In a real app, you'd capture it from the registration listener

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      setStatus('Initialization failed');
      console.error('Push initialization error:', err);
    }
  };

  const testPushEndpoint = async () => {
    try {
      const response = await fetch('/api/register-push-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token: 'test_token_123456789'
        }),
      });

      const result = await response.json();
      console.log('API test result:', result);

      if (result.success) {
        setStatus('API endpoint tested successfully');
      } else {
        setError('API test failed: ' + result.error);
      }
    } catch (err) {
      setError('API test failed: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  return (
    <div className="container max-w-2xl mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Push Notification Test</CardTitle>
          <CardDescription>
            Test push notification setup and registration
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-2">
            <Badge variant={isNative ? 'default' : 'secondary'}>
              Platform: {Capacitor.getPlatform()}
            </Badge>
            <Badge variant={isInitialized ? 'default' : 'outline'}>
              {isInitialized ? 'Initialized' : 'Not Initialized'}
            </Badge>
          </div>

          <div className="space-y-2">
            <h4 className="font-medium">Status</h4>
            <p className="text-sm text-muted-foreground">{status}</p>
            {error && (
              <p className="text-sm text-red-600">{error}</p>
            )}
          </div>

          {pushToken && (
            <div className="space-y-2">
              <h4 className="font-medium">Device Token</h4>
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-xs font-mono break-all">{pushToken}</p>
              </div>
            </div>
          )}

          <div className="space-y-3">
            <Button
              onClick={initializePush}
              disabled={!isNative || isInitialized}
              className="w-full"
            >
              {isInitialized ? 'Push Notifications Initialized' : 'Initialize Push Notifications'}
            </Button>

            <Button
              onClick={testPushEndpoint}
              variant="outline"
              className="w-full"
            >
              Test API Endpoint
            </Button>
          </div>

          {!isNative && (
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800">
                📱 Push notifications are only available in the mobile app.
                Run this page in your Capacitor iOS app to test push notifications.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Instructions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <h4 className="font-medium">For Mobile Testing:</h4>
            <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
              <li>Run <code>npm run cap:dev</code> to sync the changes</li>
              <li>Open the app in Xcode: <code>npx cap open ios</code></li>
              <li>Enable Push Notifications capability in Xcode</li>
              <li>Run the app on a physical device (push notifications don't work in Simulator)</li>
              <li>Navigate to this page in the app</li>
              <li>Tap "Initialize Push Notifications"</li>
              <li>Allow push notification permissions when prompted</li>
              <li>Check the console for the device token</li>
            </ol>
          </div>

          <div className="space-y-2">
            <h4 className="font-medium">Next Steps:</h4>
            <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
              <li>Get your APNs .p8 key from Apple Developer portal</li>
              <li>Update the push notification script with your Key ID and Team ID</li>
              <li>Use the device token to send a test push notification</li>
            </ol>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}