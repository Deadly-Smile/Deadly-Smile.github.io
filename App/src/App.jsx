import { Route, Routes } from "react-router-dom";
import Home from "./Pages/Home";
import WhiteBoard from "./Pages/WhiteBoard";
const App = () => {
  return (
    <section>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/white-board" element={<WhiteBoard />} />
      </Routes>
    </section>
  );
};

export default App;
