// components/TeamSpriteLogo.jsx
import logoSprite from "../assets/teams.jpg"; 

const spriteMap = {
  "BADBAADO FC": { x: 0, y: 0 },
  "DEKEDAHA FC": { x: 1, y: 0 },
  "ELMAN FC": { x: 2, y: 0 },
  "FC GANTALAAHA AFGOOYE": { x: 3, y: 0 },
  "GAADIIDKA FC": { x: 0, y: 1 },
  "HEEGAN FC": { x: 1, y: 1 },
  "HORSEED FC": { x: 2, y: 1 },
  "JAZEERA SC": { x: 3, y: 1 },
  "JEENYO UNITED FC": { x: 0, y: 2 },
  "JUBBA FC": { x: 1, y: 2 },
  "MOGADISHU CITY CLUB": { x: 2, y: 2 },
  "RAADSAN": { x: 3, y: 2 },
};
export default function TeamSpriteLogo({ teamName, className = "" }) {
  const pos = spriteMap[teamName];

  if (!pos) {
    return (
      <div className={`bg-gray-100 flex items-center justify-center text-xs ${className}`}>
        N/A
      </div>
    );
  }

  const cols = 4;
  const rows = 3;

  const posX = (pos.x / (cols - 1)) * 100;
  const posY = (pos.y / (rows - 1)) * 100;

  return (
    <div
      className={className}
      style={{
        backgroundImage: `url(${logoSprite})`,
        backgroundSize: `${cols * 100}% ${rows * 100}%`,
        backgroundPosition: `${posX}% ${posY}%`,
        backgroundRepeat: "no-repeat",
      }}
    />
  );
}
