import { createContext, useContext } from 'react';
import { appConfig } from '../config/appConfig.js';

export const defaultCustomization = {
  appName: appConfig.appName,
  shortName: appConfig.shortName,
  description: appConfig.appDescription,
  welcomeText: 'Bienvenue sur TESTapp2',
  organizationName: '',
  supportEmail: '',
  primaryColor: appConfig.accentColor,
  secondaryColor: '#64748b',
  logoUrl: '/icons/icon-192.png',
  pwaIconUrl: '/icons/icon-512.png',
  githubUrl: '',
  websiteUrl: ''
};

export const AppCustomizationContext = createContext({
  customization: defaultCustomization,
  refreshCustomization: async () => defaultCustomization
});

export const useAppCustomization = () => useContext(AppCustomizationContext);
