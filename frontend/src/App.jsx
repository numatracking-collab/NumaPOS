import { BrowserRouter, HashRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import SignUpPage from './pages/SignUpPage';
import POSPage from './pages/POSPage';
import InventoryPage from './pages/InventoryPage';
import SettingsPage from './pages/SettingsPage';
import HistoryPage from './pages/HistoryPage';
import MarketingPage from './pages/MarketingPage';
import ReportsPage from './pages/ReportsPage';

// Electron carga la app como file:// — HashRouter funciona, BrowserRouter no.
// Web y Android siguen usando BrowserRouter sin ningún cambio.
const isElectron = typeof window !== 'undefined' && !!window.electronAPI;
const Router = isElectron ? HashRouter : BrowserRouter;

function App() {
    return (
        <AuthProvider>
            <Router>
                <Routes>
                    <Route path="/login"  element={<LoginPage />} />
                    <Route path="/signup" element={<SignUpPage />} />
                    <Route element={<ProtectedRoute />}>
                        <Route path="/"          element={<POSPage />} />
                        <Route path="/inventory" element={<InventoryPage />} />
                        <Route path="/settings"  element={<SettingsPage />} />
                        <Route path="/marketing" element={<MarketingPage />} />
                        <Route path="/history"   element={<HistoryPage />} />
                        <Route path="/reports"   element={<ReportsPage />} />
                    </Route>
                </Routes>
            </Router>
        </AuthProvider>
    );
}
export default App;