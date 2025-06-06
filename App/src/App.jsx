import { Route, Routes } from "react-router-dom";
import Home from "./Pages/Home";
import WhiteBoard from "./Pages/WhiteBoard";
import Projects from "./Pages/Projects";
const App = () => {
  return (
    <section>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/white-board" element={<WhiteBoard />} />
        <Route path="/projects" element={<Projects />}/>
      </Routes>
    </section>
  );
};

export default App;
