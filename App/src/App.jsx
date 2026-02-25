import { Route, Routes } from "react-router-dom";
import Home from "./Pages/Home";
import WhiteBoard from "./Pages/WhiteBoard";
import Projects from "./Pages/Projects";
import Toolz from "./Pages/Toolz";
const App = () => {
  return (
    <section>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/more-tools" element={<Toolz/>}/>
        <Route path="/projects" element={<Projects />}/>
        <Route path="/white-board" element={<WhiteBoard />} />
      </Routes>
    </section>
  );
};

export default App;
