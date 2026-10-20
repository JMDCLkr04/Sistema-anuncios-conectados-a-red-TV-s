import { Route, Routes } from 'react-router-dom';

import { AnnouncementFormView } from '../views/admin/AnnouncementFormView';
import { AnnouncementsView } from '../views/admin/AnnouncementsView';
import { AuditView } from '../views/admin/AuditView';
import { AccountsView } from '../views/admin/AccountsView';
import { DashboardView } from '../views/admin/DashboardView';
import { ScreensView } from '../views/admin/ScreensView';
import { LoginView } from '../views/auth/LoginView';
import { AppLayout } from '../views/layouts/AppLayout';
import { LandingView } from '../views/public/LandingView';
import { DisplayView } from '../views/display/DisplayView';
import { ViewerView } from '../views/viewer/ViewerView';
import { ForbiddenView, NotFoundView, RequireAuth } from './guards';

/**
 * Tabla de rutas del monolito (frontend MVC).
 * Dos superficies diferenciadas:
 *   · Administrador → /admin/**  (crear, editar y eliminar anuncios)
 *   · Cliente       → /vision    (sólo observa) y /pantalla/:token (dispositivo)
 */
export function AppRouter() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<LandingView />} />
        <Route path="/login" element={<LoginView />} />
        <Route
          path="/vision"
          element={
            <RequireAuth>
              <ViewerView />
            </RequireAuth>
          }
        />

        {/* Superficie de administración */}
        <Route
          path="/admin"
          element={
            <RequireAuth roles={['admin']}>
              <DashboardView />
            </RequireAuth>
          }
        />
        <Route
          path="/admin/anuncios"
          element={
            <RequireAuth roles={['admin']}>
              <AnnouncementsView />
            </RequireAuth>
          }
        />
        <Route
          path="/admin/anuncios/nuevo"
          element={
            <RequireAuth roles={['admin']}>
              <AnnouncementFormView mode="create" />
            </RequireAuth>
          }
        />
        <Route
          path="/admin/anuncios/:id/editar"
          element={
            <RequireAuth roles={['admin']}>
              <AnnouncementFormView mode="edit" />
            </RequireAuth>
          }
        />
        <Route
          path="/admin/pantallas"
          element={
            <RequireAuth roles={['admin']}>
              <ScreensView />
            </RequireAuth>
          }
        />
        <Route
          path="/admin/cuentas"
          element={
            <RequireAuth roles={['admin']}>
              <AccountsView />
            </RequireAuth>
          }
        />
        <Route
          path="/admin/bitacora"
          element={
            <RequireAuth roles={['admin']}>
              <AuditView />
            </RequireAuth>
          }
        />
        <Route path="/403" element={<ForbiddenView />} />
        <Route path="*" element={<NotFoundView />} />
      </Route>

      {/* Superficie del dispositivo (pantalla física): ocupa toda la ventana */}
      <Route path="/pantalla/:token" element={<DisplayView />} />
    </Routes>
  );
}
