import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import HomeScreen from "./components/HomeScreen";
import LevelMode from "./components/LevelMode";
import CustomMode from "./components/CustomMode";
import DailyMode from "./components/DailyMode";
import AnalyticsTracker from "./components/AnalyticsTracker";

function App() {
  const location = useLocation();
  const hasSeed = new URLSearchParams(location.search).has("seed");

  return (
    <>
      <AnalyticsTracker />

      {hasSeed && location.pathname !== "/custom" ? (
        <Navigate
          to={{ pathname: "/custom", search: location.search, hash: location.hash }}
          replace
        />
      ) : (
        <Routes>
          <Route path="/" element={<HomeScreen />} />
          <Route path="/levels" element={<Navigate to="/levels/1" replace />} />
          <Route path="/levels/:levelId" element={<LevelMode />} />
          <Route path="/custom" element={<CustomMode />} />
          <Route path="/daily" element={<DailyMode />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      )}
    </>
  );
}

export default App;
