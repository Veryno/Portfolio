import { ProfileCard } from "./components/ProfileCard";

export default function App() {
  return (
    <div className="min-h-screen flex items-center justify-center mobile-items-start md:p-8" style={{ backgroundColor: 'var(--bg-dark)' }}>
      <ProfileCard />
    </div>
  );
}
