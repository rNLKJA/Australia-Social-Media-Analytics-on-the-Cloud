import React from "react";
import Welcome from "./welcome/welcome";
import PlotlyJSDemo from "./plotly_example/demo";

function App() {
  return (
    <div className="bg-blue-500 min-h-screen flex items-center justify-center">
      <div className="h-auto flex flex-col ">
        <Welcome />

        <PlotlyJSDemo />
      </div>
    </div>
  );
}

export default App;
