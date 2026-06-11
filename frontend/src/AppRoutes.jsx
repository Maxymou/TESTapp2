import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
import App from './App.jsx';
import { ROUTES } from './router.js';
import { LoginPage } from './pages/LoginPage.jsx';
import { HomePage } from './pages/HomePage.jsx';
import { ModulePlaceholderPage } from './pages/ModulePlaceholderPage.jsx';
import { AboutPage } from './pages/AboutPage.jsx';
import { SettingsPage } from './pages/SettingsPage.jsx';
import { DevPage } from './pages/DevPage.jsx';
import { UserManagementPage } from './pages/UserManagementPage.jsx';
import { CustomizationPage } from './pages/CustomizationPage.jsx';
import { RequireAuth } from './components/RequireAuth.jsx';
import { RequireAdminMode } from './components/RequireAdminMode.jsx';

const router = createBrowserRouter([
  {
    path: ROUTES.login,
    element: <LoginPage />,
  },
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <RequireAuth><HomePage /></RequireAuth> },
      { path: ROUTES.module1,  element: <RequireAuth><ModulePlaceholderPage title="Module 1" /></RequireAuth> },
      { path: ROUTES.module2,  element: <RequireAuth><ModulePlaceholderPage title="Module 2" /></RequireAuth> },
      { path: ROUTES.settings, element: <RequireAuth><SettingsPage /></RequireAuth> },
      { path: ROUTES.about,    element: <RequireAuth><AboutPage /></RequireAuth> },
      {
        path: ROUTES.dev,
        element: (
          <RequireAuth>
            <RequireAdminMode>
              <DevPage />
            </RequireAdminMode>
          </RequireAuth>
        ),
      },
      {
        path: ROUTES.customization,
        element: (
          <RequireAuth>
            <RequireAdminMode>
              <CustomizationPage />
            </RequireAdminMode>
          </RequireAuth>
        ),
      },
      {
        path: ROUTES.users,
        element: (
          <RequireAuth>
            <RequireAdminMode>
              <UserManagementPage />
            </RequireAdminMode>
          </RequireAuth>
        ),
      },
      { path: '*', element: <Navigate to={ROUTES.home} replace /> },
    ],
  },
]);

export function AppRoutes() {
  return <RouterProvider router={router} />;
}
