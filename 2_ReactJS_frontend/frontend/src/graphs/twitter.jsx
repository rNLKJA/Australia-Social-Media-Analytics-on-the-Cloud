import React from "react";
import { Typography } from "@mui/material";
import { BsTwitter } from "react-icons/bs";

function TwitterPlotHeader({ twitterData }) {
  return (
    <div
      style={{ display: "flex", alignItems: "center" }}
      className="pt-4 pl-4"
    >
      <BsTwitter
        style={{ color: "#094183", fontSize: "30px", margin: "10px" }}
      />
      <Typography variant="h6" component="div" color="#094183">
        {twitterData}
      </Typography>
    </div>
  );
}

export default function TwitterPlot({ twitterData }) {
  return (
    <div className="bg-white h-full rounded-md p-4 w-full">
      <TwitterPlotHeader twitterData={twitterData} />
    </div>
  );
}
