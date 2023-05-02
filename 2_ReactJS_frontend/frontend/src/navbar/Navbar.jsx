import React from "react";
// import { FaSoundcloud } from "react-icons/fa";
import Button from "@mui/material/Button";
import { GrSave } from "react-icons/gr";
import { VscGraph } from "react-icons/vsc";

const logo = require("./unimelb.png");

const Navbar = () => {
  return (
    <nav
      className="flex w-screen justify-center items-center fixed z-10 top-0"
      style={{ backgroundColor: "white" }}
    >
      <div className="container mx-auto flex flex-row justify-between items-center py-2">
        <div className="flex flex-row items-center text-center text-black">
          <img src={logo} alt="unimelb logo" className="h-8 mr-3" />
          <h1 className="text-lg font-bold">
            Team 57 Emotion Sentiment Analysis
          </h1>
        </div>

        <div className="flex items-center justify-center">
          <DownloadButton />
          <ReportGenerateButton />
        </div>
      </div>
    </nav>
  );
};

export default Navbar;

const DownloadButton = () => {
  return (
    <Button
      variant="text"
      startIcon={<GrSave />}
      style={{ color: "#828587" }}
      className="w-auto"
    >
      Download
    </Button>
  );
};

const ReportGenerateButton = () => {
  return (
    <Button
      variant="text"
      startIcon={<VscGraph />}
      style={{ color: "#828587" }}
      className="w-auto"
    >
      Report
    </Button>
  );
};
