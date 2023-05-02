import React from "react";

export default function Content() {
  return (
    <div className="h-auto min-w-screen max-w-screen grid grid-cols-5 gap-3 ">
      <div className="col-span-1 bg-white h-800 rounded-md ">
        Content Selection
      </div>
      <div className="col-span-1 bg-white h-800 rounded-md">Brief Summary</div>
      <div className="col-span-3 bg-white h-800 rounded-md">Graphs</div>
    </div>
  );
}
