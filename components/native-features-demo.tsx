'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useNativeFeatures, initializePushNotifications, triggerHaptic, shareContent } from '@/lib/capacitor-utils';
import { ImpactStyle } from '@capacitor/haptics';

export function NativeFeaturesDemo() {
  const { haptic, share, isNative } = useNativeFeatures();
  const [pushToken, setPushToken] = useState<string>('');
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    // Initialize push notifications when component mounts
    if (isNative && !isInitialized) {
      initializePushNotifications().then(() => {
        setIsInitialized(true);
      });
    }
  }, [isNative, isInitialized]);

  const handleHapticLight = async () => {
    await haptic(ImpactStyle.Light);
  };

  const handleHapticMedium = async () => {
    await haptic(ImpactStyle.Medium);
  };

  const handleHapticHeavy = async () => {
    await haptic(ImpactStyle.Heavy);
  };

  const handleShare = async () => {
    await share(
      'Check out HKI!',
      'An amazing app built with Next.js and Capacitor',
      'https://hki.zone'
    );
  };

  const handleShareCurrentPage = async () => {
    await share(
      'HKI App',
      'Check out this page in the HKI app',
      window.location.href
    );
  };

  if (!isNative) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardHeader>
          <CardTitle>Native Features</CardTitle>
          <CardDescription>
            Native features are only available in the mobile app
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Download the HKI app to experience haptic feedback, native sharing, and push notifications.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6 w-full max-w-md mx-auto">
      {/* Haptic Feedback */}
      <Card>
        <CardHeader>
          <CardTitle>Haptic Feedback</CardTitle>
          <CardDescription>Feel the device vibration with different intensities</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button onClick={handleHapticLight} variant="outline" className="w-full">
            Light Haptic
          </Button>
          <Button onClick={handleHapticMedium} variant="outline" className="w-full">
            Medium Haptic
          </Button>
          <Button onClick={handleHapticHeavy} variant="outline" className="w-full">
            Heavy Haptic
          </Button>
        </CardContent>
      </Card>

      {/* Native Share */}
      <Card>
        <CardHeader>
          <CardTitle>Native Sharing</CardTitle>
          <CardDescription>Share content using the device's native share sheet</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button onClick={handleShare} className="w-full">
            Share HKI App
          </Button>
          <Button onClick={handleShareCurrentPage} variant="outline" className="w-full">
            Share Current Page
          </Button>
        </CardContent>
      </Card>

      {/* Push Notifications */}
      <Card>
        <CardHeader>
          <CardTitle>Push Notifications</CardTitle>
          <CardDescription>
            {isInitialized ? 'Push notifications are enabled' : 'Initializing push notifications...'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {pushToken ? (
            <div className="space-y-2">
              <p className="text-sm text-green-600">✅ Registered for push notifications</p>
              <p className="text-xs text-muted-foreground break-all">
                Token: {pushToken.substring(0, 20)}...
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Push notification token will appear here once registered
            </p>
          )}
        </CardContent>
      </Card>

      {/* Combined Action Example */}
      <Card>
        <CardHeader>
          <CardTitle>Combined Actions</CardTitle>
          <CardDescription>Multiple native features working together</CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={async () => {
              await haptic(ImpactStyle.Medium);
              setTimeout(async () => {
                await share(
                  'HKI Native Features',
                  'Just experienced haptic feedback before sharing!',
                  'https://hki.zone'
                );
              }, 100);
            }}
            className="w-full"
          >
            Haptic + Share
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export default NativeFeaturesDemo;