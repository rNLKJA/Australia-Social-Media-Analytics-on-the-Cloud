import React, { useState, useEffect } from "react";
import Plot from "react-plotly.js";

export default function PlotlyJSDemo() {
  const [plotData, setPlotData] = useState([]);

  useEffect(() => {
    fetch("./data/sunburst_plot.json")
      .then((response) => response.json())
      .then((data) => setPlotData(data))
      .catch((error) => console.error(error));
  }, []);

  return (
    <div className="plotly-demo">
      {console.log(plotData.data)}
      <Plot
        data={plotData.data}
        layout={plotData.layout}
        style={{ width: "100%", height: "100%" }}
      />
    </div>
  );
}
