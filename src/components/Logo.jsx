import React from "react";

function Logo() {
  return (
    <div className="flex items-center space-x-2">
      <h2 className="text-2xl font-semibold">Lang Trainer</h2>
      <span className="h-2 w-2 bg-green-400 rounded-full animate-ping"></span>
    </div>
  );
}

export default Logo;