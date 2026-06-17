import { useState } from "react";
import HomeScreen from "./components/HomeScreen";
import LevelMode from "./components/LevelMode";
import CustomMode from "./components/CustomMode";

function App() {
  const [mode, setMode] = useState("home");

  if (mode === "levels") {
    return <LevelMode onBackHome={() => setMode("home")} />;
  }

  if (mode === "custom") {
    return <CustomMode onBackHome={() => setMode("home")} />;
  }

  return (
    <HomeScreen
      onPlayLevels={() => setMode("levels")}
      onCustomGraph={() => setMode("custom")}
    />
  );
}

export default App;