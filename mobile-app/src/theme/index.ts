import { DefaultTheme } from 'react-native-paper';

export const theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: '#E53E3E', // Blood red
    secondary: '#2B6CB0', // Blue
    accent: '#38A169', // Green
    background: '#F7FAFC',
    surface: '#FFFFFF',
    error: '#E53E3E',
    text: '#1A202C',
    onSurface: '#1A202C',
    disabled: '#A0AEC0',
    placeholder: '#718096',
    backdrop: 'rgba(0, 0, 0, 0.5)',
    notification: '#E53E3E',
    white: '#FFFFFF',
    black: '#000000',
    gray: '#718096',
    lightGray: '#E2E8F0',
    darkGray: '#2D3748',
    success: '#38A169',
    warning: '#D69E2E',
    info: '#3182CE',
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },
  borderRadius: {
    sm: 4,
    md: 8,
    lg: 12,
    xl: 16,
    round: 50,
  },
  typography: {
    h1: {
      fontSize: 32,
      fontWeight: 'bold',
    },
    h2: {
      fontSize: 24,
      fontWeight: 'bold',
    },
    h3: {
      fontSize: 20,
      fontWeight: '600',
    },
    body: {
      fontSize: 16,
    },
    caption: {
      fontSize: 14,
    },
    small: {
      fontSize: 12,
    },
  },
}; 