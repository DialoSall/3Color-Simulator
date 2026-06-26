import { Navigate, Route, Routes } from "react-router-dom";
import HomeScreen from "./components/HomeScreen";
import LevelMode from "./components/LevelMode";
import CustomMode from "./components/CustomMode";

function App() {
  return (
    <Routes>
      <Route path="/" element={<HomeScreen />} />
      <Route path="/levels" element={<Navigate to="/levels/1" replace />} />
      <Route path="/levels/:levelId" element={<LevelMode />} />
      <Route path="/custom" element={<CustomMode />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;