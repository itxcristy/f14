import { useEffect, useState } from 'react';
import { useNotifications } from '@/hooks/use-notifications';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Bell, X, Settings, AlertCircle } from 'lucide-react';

export function NotificationPermissionPrompt() {
  const { 
    permission, 
    isLoading,
    requestPermission 
  } = useNotifications();
  const [showDialog, setShowDialog] = useState(false);
  const [hasShownBefore, setHasShownBefore] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);

  useEffect(() => {
    // Check if we've shown this dialog before
    const shownBefore = localStorage.getItem('notification-prompt-shown');
    setHasShownBefore(!!shownBefore);

    // Check if notifications are blocked
    const blocked = 'Notification' in window && Notification.permission === 'denied';
    setIsBlocked(blocked);

    // Only show if:
    // 1. Notifications are supported
    // 2. Permission is default (not asked yet) OR blocked
    // 3. We haven't shown it before (for default state only)
    // 4. Not loading
    if (
      'Notification' in window &&
      (permission.state === 'default' || blocked) &&
      (!shownBefore || blocked) &&
      !isLoading
    ) {
      // Wait 10 seconds after page load to show the dialog
      const timer = setTimeout(() => {
        setShowDialog(true);
      }, 10000); // Show after 10 seconds

      return () => clearTimeout(timer);
    }
  }, [permission.state, isLoading]);

  const handleEnable = async () => {
    // Don't close dialog immediately - wait for permission result
    // This ensures the user gesture is preserved for the permission request
    try {
      console.log('User clicked Enable - requesting permission...');
      console.log('Current permission state:', Notification.permission);
      
      const granted = await requestPermission();
      
      console.log('Permission request result:', granted);
      
      // Close dialog after permission request
      setShowDialog(false);
      localStorage.setItem('notification-prompt-shown', 'true');
      
      if (!granted) {
        // If denied, don't show again
        localStorage.setItem('notification-prompt-shown', 'true');
      }
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      setShowDialog(false);
      localStorage.setItem('notification-prompt-shown', 'true');
    }
  };

  const handleDismiss = () => {
    setShowDialog(false);
    localStorage.setItem('notification-prompt-shown', 'true');
  };

  // Don't show if already shown before (and not blocked) or permission is granted
  if ((hasShownBefore && !isBlocked) || permission.state === 'granted' || isLoading) {
    return null;
  }

  // Blocked notification dialog
  if (isBlocked) {
    return (
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
                <AlertCircle className="w-6 h-6 text-destructive" />
              </div>
              <DialogTitle>Notifications Are Blocked</DialogTitle>
            </div>
            <DialogDescription className="text-left pt-2">
              To receive event reminders, please enable notifications in your browser settings
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-lg bg-muted border border-border">
                <p className="text-sm font-medium mb-3">How to Enable Notifications:</p>
                <div className="space-y-2.5 text-sm text-muted-foreground">
                  <div className="flex items-start gap-2">
                    <span className="font-semibold text-foreground flex-shrink-0">1.</span>
                    <span className="flex-1">Click the lock icon (🔒) or info icon (ℹ️) in your browser's address bar</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="font-semibold text-foreground flex-shrink-0">2.</span>
                    <span className="flex-1">Find "Notifications" in the permissions list</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="font-semibold text-foreground flex-shrink-0">3.</span>
                    <span className="flex-1">Change it from "Block" to "Allow"</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="font-semibold text-foreground flex-shrink-0">4.</span>
                    <span className="flex-1">Refresh this page</span>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-lg bg-primary/5 border border-primary/20 flex flex-col justify-center">
                <p className="text-sm font-medium text-foreground mb-2">📱 Mobile Users</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  On mobile devices, you may need to enable notifications in your phone's browser settings as well. Check your device settings for browser permissions.
                </p>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={handleDismiss}
              className="w-full"
            >
              <X className="w-4 h-4 mr-2" />
              Close
            </Button>
            <Button
              onClick={() => {
                window.location.reload();
              }}
              className="w-full"
            >
              <Settings className="w-4 h-4 mr-2" />
              I've Enabled It - Refresh
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // Default permission request dialog - SIMPLIFIED
  return (
    <Dialog open={showDialog} onOpenChange={setShowDialog}>
      <DialogContent className="max-w-md sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center justify-center mb-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Bell className="w-8 h-8 text-primary" />
            </div>
          </div>
          <DialogTitle className="text-center text-xl">Get Event Reminders</DialogTitle>
          <DialogDescription className="text-center pt-2">
            We'll send you notifications about upcoming important events
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4">
          <div className="text-center space-y-2 mb-6">
            <p className="text-sm text-muted-foreground">
              Never miss important dates like birthdays and anniversaries
            </p>
            <p className="text-xs text-muted-foreground">
              Works even when the website is closed
            </p>
          </div>

          <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 mb-4">
            <p className="text-xs text-center text-muted-foreground">
              You'll receive a test notification in 1-2 minutes to confirm it's working
            </p>
          </div>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button
            variant="outline"
            onClick={handleDismiss}
            className="w-full sm:w-auto order-2 sm:order-1"
          >
            <X className="w-4 h-4 mr-2" />
            Not Now
          </Button>
          <Button
            onClick={handleEnable}
            disabled={isLoading}
            className="w-full sm:w-auto order-1 sm:order-2"
          >
            <Bell className="w-4 h-4 mr-2" />
            {isLoading ? "Enabling..." : "Yes, Enable"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
