import { Route, Routes } from "react-router-dom";
import Home from "./Pages/Home";
import WhiteBoard from "./Pages/WhiteBoard";
import Projects from "./Pages/Projects";
import Toolz from "./Pages/Toolz";
import Games from "./Pages/Games";
const App = () => {
  return (
    <section>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/toolz" element={<Toolz/>}/>
        <Route path="/games" element={<Games/>}/>
        <Route path="/projects" element={<Projects />}/>
        <Route path="/white-board" element={<WhiteBoard />} />
      </Routes>
    </section>
  );
};

export default App;
