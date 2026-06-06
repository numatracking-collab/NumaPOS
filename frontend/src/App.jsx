import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import SignUpPage from './pages/SignUpPage';
import POSPage from './pages/POSPage';
import InventoryPage from './pages/InventoryPage';
import SettingsPage from './pages/SettingsPage';
import HistoryPage from './pages/HistoryPage';   // ← NUEVO

function App() {
    return (
        <AuthProvider>
            <BrowserRouter>
                <Routes>
                    <Route path="/login"  element={<LoginPage />} />
                    <Route path="/signup" element={<SignUpPage />} />
                    <Route element={<ProtectedRoute />}>
                        <Route path="/"          element={<POSPage />} />
                        <Route path="/inventory" element={<InventoryPage />} />
                        <Route path="/settings"  element={<SettingsPage />} />
                        <Route path="/history"   element={<HistoryPage />} />  {/* ← NUEVO */}
                    </Route>
                </Routes>
            </BrowserRouter>
        </AuthProvider>
    );
}

export default App;