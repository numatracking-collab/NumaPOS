import TopAppBar from '../components/TopAppBar';
import BottomNav from '../components/BottomNav';
import OnDevelopment from '../components/OnDevelopment';

export default function ReportsPage() {
    return (
        <div className="h-screen flex flex-col overflow-hidden bg-background">
            <TopAppBar hideActions placeholder="Buscar en reportes..." />

            <main className="flex-1 overflow-hidden">
                <OnDevelopment />
            </main>

            <BottomNav />
        </div>
    );
}