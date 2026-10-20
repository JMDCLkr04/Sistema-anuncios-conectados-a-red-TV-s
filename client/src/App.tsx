import { BrowserRouter } from 'react-router-dom';

import { AuthProvider } from './controllers/useAuth';
import { AppRouter } from './router';
import { ErrorBoundary } from './views/shared/ErrorBoundary';

/**
 * Raíz de la aplicación: compone el proveedor de sesión, el enrutador y el
 * límite de errores. Mantiene el patrón MVC: la raíz sólo conecta piezas.
 */
export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <AppRouter />
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
