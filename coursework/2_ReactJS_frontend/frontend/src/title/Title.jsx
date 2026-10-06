import React from "react";
import Button from "@mui/material/Button";
import { GrSave } from "react-icons/gr";
import { VscGraph } from "react-icons/vsc";

export default function Title() {
  return (
    <div className="flex flex-row justify-between items-center min-w-screen max-w-screen">
      <div className="">
        <h2 className="text-xl">Emotional Sentiments</h2>
      </div>
      <div className="grid grid-cols-2 gap-1 items-center justify-center w-auto">
        <Button
          variant="text"
          startIcon={<GrSave />}
          style={{ color: "#828587" }}
        >
          Download
        </Button>
        <Button
          variant="text"
          startIcon={<VscGraph />}
          style={{ color: "#828587" }}
        >
          Report
        </Button>
      </div>
    </div>
  );
}
