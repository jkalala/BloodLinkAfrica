
import React, { createContext, useContext, useEffect } from 'react';
import PushNotification from 'react-native-push-notification';
import { getPushNotificationService } from '../../lib/push-notification-service';

const NotificationContext = createContext(null);

export const NotificationProvider = ({ children }) => {
  useEffect(() => {
    const pushService = getPushNotificationService();

    PushNotification.configure({
      onRegister: function (token) {
        console.log('TOKEN:', token);
      },
      onNotification: function (notification) {
        console.log('NOTIFICATION:', notification);
        notification.finish('UIBackgroundFetchResultNoData');
      },
      onAction: function (notification) {
        console.log('ACTION:', notification.action);
        console.log('NOTIFICATION:', notification);
      },
      onRegistrationError: function(err) {
        console.error(err.message, err);
      },
      permissions: {
        alert: true,
        badge: true,
        sound: true,
      },
      popInitialNotification: true,
      requestPermissions: true,
    });
  }, []);

  return (
    <NotificationContext.Provider value={null}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotification = () => {
  return useContext(NotificationContext);
};
