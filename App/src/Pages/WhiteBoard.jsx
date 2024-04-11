import { useEffect, useState } from "react";
import { Stage, Layer, Line } from "react-konva";
import { FaUndo } from "react-icons/fa";

const WhiteBoard = () => {
  const [lines, setLines] = useState([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [selectedColor, setSelectedColor] = useState("teal");

  const handleMouseDown = (e) => {
    setIsDrawing(true);
    const pos = e.target.getStage().getPointerPosition();
    setLines([...lines, { points: [pos.x, pos.y], color: selectedColor }]);
  };

  const handleMouseMove = (e) => {
    if (!isDrawing) return;
    const stage = e.target.getStage();
    const point = stage.getPointerPosition();
    let lastLine = lines[lines.length - 1];
    lastLine.points = lastLine.points.concat([point.x, point.y]);

    setLines([...lines.slice(0, lines.length - 1), lastLine]);
  };

  const handleMouseUp = () => {
    setIsDrawing(false);
  };

  const handleUndo = () => {
    setLines(lines.slice(0, lines.length - 1));
  };

  const handleColorChange = (color) => {
    setSelectedColor(color);
  };

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.ctrlKey && event.key === "z") {
        handleUndo();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="relative h-[80vh]">
      <Stage
        width={window.innerWidth}
        height={window.innerHeight - 80}
        onMouseDown={handleMouseDown}
        onMousemove={handleMouseMove}
        onMouseup={handleMouseUp}
      >
        <Layer>
          {lines.map((line, i) => (
            <Line
              key={i}
              points={line.points}
              stroke={line.color}
              strokeWidth={2}
            />
          ))}
        </Layer>
      </Stage>
      <div className="fixed inset-x-0 bottom-0 flex justify-center bg-slate-600 p-4">
        <button
          className="mx-2 px-4 py-2 bg-slate-800 text-white rounded-full text-sm"
          onClick={handleUndo}
        >
          <FaUndo />
        </button>
        <input
          className="mx-2 rounded-full w-8 border-none"
          type="color"
          onChange={(e) => handleColorChange(e.target.value)}
          value={selectedColor}
        />
      </div>
    </div>
  );
};

export default WhiteBoard;
