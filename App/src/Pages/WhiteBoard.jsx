import { useEffect, useState } from "react";
import { Stage, Layer, Line } from "react-konva";
import { FaUndo } from "react-icons/fa";
import { HexColorPicker } from "react-colorful";

const WhiteBoard = () => {
  const [lines, setLines] = useState([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
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
    const lastLine = lines[lines.length - 1];
    const newLine = {
      ...lastLine,
      points: [...lastLine.points, point.x, point.y],
    };
    setLines([...lines.slice(0, lines.length - 1), newLine]);
  };

  const handleMouseUp = () => {
    setIsDrawing(false);
  };

  const handleUndo = () => {
    setLines(lines.slice(0, lines.length - 1));
  };

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.ctrlKey && event.key === "z") {
        handleUndo();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [lines]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest(".color-picker-container")) {
        setShowPicker(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
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
              tension={0.5}
              lineCap="round"
              globalCompositeOperation="source-over"
            />
          ))}
        </Layer>
      </Stage>
      <div className="fixed inset-x-0 bottom-0 flex justify-center bg-slate-600 p-4">
        <button
          onClick={handleUndo}
          className="mx-2 flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-slate-800 rounded-full shadow-md transition hover:bg-slate-700 focus:outline-none focus:ring-1 focus:ring-teal focus:ring-offset-2"
        >
          <FaUndo className="text-white" />
        </button>
        <div className="relative">
          <button
            onClick={() => setShowPicker(!showPicker)}
            className="w-8 h-8 rounded-full border border-white"
            style={{ backgroundColor: selectedColor }}
          />
          {showPicker && (
            <div className="absolute bottom-12 z-10 color-picker-container">
              <HexColorPicker color={selectedColor} onChange={setSelectedColor} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WhiteBoard;
