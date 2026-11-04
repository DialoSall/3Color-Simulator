import { lazy, Suspense } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import HomeScreen from "./components/HomeScreen";
import LevelMode from "./components/LevelMode";
import CustomMode from "./components/CustomMode";
import DailyMode from "./components/DailyMode";
import AnalyticsTracker from "./components/AnalyticsTracker";
import AppHeader from "./components/AppHeader";
import RouteMetadata from "./components/RouteMetadata";
import { IS_CRAZYGAMES } from "./platform";

const DevPreview = import.meta.env.DEV ? lazy(() => import("./dev/DevPreview.jsx")) : null;

function App() {
  const location = useLocation();
  const hasSeed = new URLSearchParams(location.search).has("seed");

  return (
    <>
      {!IS_CRAZYGAMES && <RouteMetadata />}
      {!IS_CRAZYGAMES && <AnalyticsTracker />}
      <AppHeader />

      {hasSeed && location.pathname !== "/custom" ? (
        <Navigate
          to={{ pathname: "/custom", search: location.search, hash: location.hash }}
          replace
        />
      ) : (
        <Routes>
          <Route path="/" element={IS_CRAZYGAMES ? <Navigate to="/levels/1" replace /> : <HomeScreen />} />
          <Route path="/levels" element={<Navigate to="/levels/1" replace />} />
          <Route path="/levels/:levelId" element={<LevelMode />} />
          <Route path="/custom" element={<CustomMode />} />
          <Route path="/daily" element={<DailyMode />} />
          <Route path="/daily/:dateKey" element={<DailyMode />} />
          <Route path="/daily/*" element={<DailyMode />} />
          {import.meta.env.DEV && <Route path="/dev/preview" element={
            <Suspense fallback={<p role="status">Loading development preview…</p>}><DevPreview /></Suspense>
          } />}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      )}
    </>
  );
}

export default App;
